/**
 * main.js — Orquestrador principal do LEXO
 * Inicializa o jogo, coordena módulos e gerencia eventos
 */

import { getWordOfTheDay, getTodayKey } from './words.js';
import {
  createGameState, restoreGameState,
  addLetter, removeLetter, submitGuess,
  MAX_ATTEMPTS, WORD_LENGTH
} from './game.js';
import {
  loadData, saveData, isTodaySession, updateStats
} from './storage.js';
import {
  DOM, showScreen, openModal, closeAllModals,
  updateStreakBadge, renderHomeScreen,
  buildGrid, buildKeyboard,
  addLetterToTile, removeLetterFromTile, updateCursor,
  revealRow, restoreRows, shakeRow, bounceRow,
  updateKeyStates, updateAttemptCounter,
  showToast, showGameOverBanner,
  renderResultModal, renderStatsModal,
} from './ui.js';
import { generateShareText, shareResult } from './share.js';

// ============================================================
// Estado global
// ============================================================
let gameState = null;
let appData   = null;
let wordInfo  = null;

// ============================================================
// Inicialização
// ============================================================
async function init() {
  // 1. Carregar dados salvos
  appData  = loadData();
  wordInfo = getWordOfTheDay();
  const todayKey = getTodayKey();

  // 2. Verificar se há sessão de hoje salva
  const hasTodaySession = isTodaySession(appData.today, todayKey);

  if (hasTodaySession) {
    // Restaurar estado existente
    gameState = restoreGameState(wordInfo.word, appData.today);
  } else {
    // Nova sessão
    gameState = createGameState(wordInfo.word);
    appData.today = {
      date: todayKey,
      word: wordInfo.word,
      guesses: [],
      keyStates: {},
      status: 'playing',
    };
    saveData(appData);
  }

  // 3. Construir DOM
  buildGrid();
  buildKeyboard(handleKeyInput);

  // 4. Renderizar tela inicial
  renderHomeScreen(wordInfo);
  updateStreakBadge(appData.stats.currentStreak);

  // 5. Se sessão restaurada, reconstruir grid e teclado
  if (hasTodaySession && gameState.guesses.length > 0) {
    restoreRows(gameState.guesses);
    updateKeyStates(gameState.keyStates);
    updateAttemptCounter(gameState.currentRow, MAX_ATTEMPTS);
  }

  // 6. Configurar listeners de eventos
  setupEventListeners();

  // 7. Se partida já concluída, mostrar tela de jogo + banner
  if (gameState.status !== 'playing') {
    showScreen('game');
    updateGameCategory();
    showGameOverBanner(gameState.status, () => openResultModal());
  } else {
    showScreen('home');
  }
}

// ============================================================
// Setup de Event Listeners
// ============================================================
function setupEventListeners() {
  // Botão "Jogar" na tela inicial
  document.getElementById('btn-play')?.addEventListener('click', startGame);

  // Teclado físico
  document.addEventListener('keydown', handlePhysicalKeyboard);

  // Botões do header
  document.getElementById('btn-stats')?.addEventListener('click', () => openStatsModal());
  document.getElementById('btn-help')?.addEventListener('click', () => openModal('help'));

  // Fechar modais
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeAllModals();
    });
  });

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  // Botão compartilhar no modal de resultado
  document.getElementById('btn-share')?.addEventListener('click', handleShare);

  // Botão "ver estatísticas" no modal de resultado
  document.getElementById('btn-goto-stats')?.addEventListener('click', () => openStatsModal());

  // Banner de jogo encerrado
  DOM.gameOverBanner?.addEventListener('click', openResultModal);
}

// ============================================================
// Iniciar Jogo
// ============================================================
function startGame() {
  showScreen('game');
  updateGameCategory();
  updateAttemptCounter(gameState.currentRow, MAX_ATTEMPTS);
  updateCursor(gameState.currentRow, gameState.currentCol);
}

function updateGameCategory() {
  if (DOM.gameCategoryLabel) {
    DOM.gameCategoryLabel.textContent =
      `${wordInfo.categoryEmoji} ${wordInfo.category.toUpperCase()}`;
  }
}

// ============================================================
// Input do Teclado
// ============================================================
function handlePhysicalKeyboard(e) {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (DOM.modalResult?.classList.contains('active')) return;
  if (DOM.modalStats?.classList.contains('active')) return;
  if (DOM.modalHelp?.classList.contains('active')) return;

  const key = e.key;

  if (key === 'Enter') {
    handleKeyInput('ENTER');
  } else if (key === 'Backspace' || key === 'Delete') {
    handleKeyInput('DEL');
  } else if (key && key.length === 1) {
    const normalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (/^[A-Z]$/.test(normalized)) {
      handleKeyInput(normalized);
    }
  }
}

function handleKeyInput(key) {
  if (!gameState || gameState.status !== 'playing') return;

  if (key === 'ENTER') {
    handleSubmit();
  } else if (key === 'DEL' || key === 'BACKSPACE') {
    handleDelete();
  } else if (/^[A-Z]$/.test(key)) {
    handleLetter(key);
  }
}

// ============================================================
// Ações do Jogo
// ============================================================
function handleLetter(letter) {
  const { state, changed } = addLetter(gameState, letter);
  if (!changed) return;
  gameState = state;

  addLetterToTile(gameState.currentRow, gameState.currentCol - 1, letter);
  updateCursor(gameState.currentRow, gameState.currentCol);
}

function handleDelete() {
  const { state, changed } = removeLetter(gameState);
  if (!changed) return;
  gameState = state;

  removeLetterFromTile(gameState.currentRow, gameState.currentCol);
  updateCursor(gameState.currentRow, gameState.currentCol);
}

async function handleSubmit() {
  const { state, result, evaluation } = submitGuess(gameState);

  if (result === 'incomplete') {
    showToast('Complete a palavra primeiro!');
    shakeRow(gameState.currentRow);
    return;
  }

  if (result === 'invalid') {
    showToast('Palavra não encontrada!');
    shakeRow(gameState.currentRow);
    return;
  }

  if (result === 'duplicate') {
    showToast('Você já tentou essa palavra!');
    shakeRow(gameState.currentRow);
    return;
  }

  // Resultado OK — revelar
  const rowBeforeSubmit = gameState.currentRow;
  gameState = state;

  // Persiste tentativa imediatamente
  persistGuess();

  // Animar revelação
  await revealRow(rowBeforeSubmit, gameState.guesses[rowBeforeSubmit]);

  // Atualizar teclado
  updateKeyStates(gameState.keyStates);
  updateAttemptCounter(gameState.currentRow, MAX_ATTEMPTS);
  updateCursor(gameState.currentRow, gameState.currentCol);

  // Verificar fim de jogo
  if (gameState.status === 'won') {
    bounceRow(rowBeforeSubmit);
    finalizeGame(); // BUG-04: persistir antes do timeout
    setTimeout(() => {
      openResultModal();
    }, 800);
  } else if (gameState.status === 'lost') {
    finalizeGame(); // BUG-04: persistir antes do timeout
    setTimeout(() => {
      openResultModal();
    }, 500);
  }
}

// ============================================================
// Persistência
// ============================================================
function persistGuess() {
  appData.today.guesses = gameState.guesses;
  appData.today.keyStates = gameState.keyStates;
  appData.today.status = gameState.status;
  saveData(appData);
}

function finalizeGame() {
  const todayKey = getTodayKey();
  const won = gameState.status === 'won';
  const attemptsUsed = gameState.guesses.length;

  appData.stats = updateStats(appData.stats, won, attemptsUsed, todayKey);
  saveData(appData);
  updateStreakBadge(appData.stats.currentStreak);
}

// ============================================================
// Modais
// ============================================================
function openResultModal() {
  renderResultModal({
    status: gameState.status,
    word: wordInfo.word,
    guesses: gameState.guesses,
    stats: appData.stats,
  });
  openModal('result');
}

function openStatsModal() {
  renderStatsModal(appData.stats);
  openModal('stats');
}

// ============================================================
// Compartilhamento
// ============================================================
async function handleShare() {
  const text = generateShareText({
    guesses: gameState.guesses,
    status: gameState.status,
    word: wordInfo.word,
  });

  const outcome = await shareResult(text);
  if (outcome === 'copied') {
    showToast('Copiado! Cole e compartilhe 🎉');
  } else if (outcome === 'shared') {
    showToast('Compartilhado!');
  } else {
    showToast('Não foi possível compartilhar.');
  }
}

// ============================================================
// Start
// ============================================================
document.addEventListener('DOMContentLoaded', init);
