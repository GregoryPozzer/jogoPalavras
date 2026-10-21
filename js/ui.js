/**
 * ui.js — Módulo de UI do LEXO
 * Toda manipulação do DOM está aqui.
 */

import { MAX_ATTEMPTS, WORD_LENGTH } from './game.js';

// ============================================================
// Referências DOM (memoizadas)
// ============================================================
const $ = id => document.getElementById(id);

export const DOM = {
  get screenHome()   { return $('screen-home'); },
  get screenGame()   { return $('screen-game'); },
  get gameGrid()     { return $('game-grid'); },
  get keyboard()     { return $('keyboard'); },
  get attemptCounter(){ return $('attempt-counter'); },
  get gameCategoryLabel(){ return $('game-category-label'); },
  get streakBadge()  { return $('streak-badge'); },
  get streakCount()  { return $('streak-count'); },
  get homeCategoryValue(){ return $('home-category-value'); },
  get homeWordLen()  { return $('home-word-len'); },
  get toast()        { return $('toast'); },
  get gameOverBanner(){ return $('game-over-banner'); },

  // Modais
  get modalResult()  { return $('modal-result'); },
  get modalStats()   { return $('modal-stats'); },
  get modalHelp()    { return $('modal-help'); },

  // Resultado
  get resultTitle()  { return $('result-title'); },
  get resultSubtitle(){ return $('result-subtitle'); },
  get resultWord()   { return $('result-word'); },
  get resultEmoji()  { return $('result-emoji'); },
  get resultAttempts(){ return $('result-attempts'); },
  get resultStreak() { return $('result-streak'); },

  // Stats modal
  get statTotalGames(){ return $('stat-total-games'); },
  get statWinRate()  { return $('stat-win-rate'); },
  get statStreak()   { return $('stat-streak'); },
  get statBestStreak(){ return $('stat-best-streak'); },
  get distContainer(){ return $('dist-container'); },
};

// ============================================================
// Navegação entre telas
// ============================================================
export function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = $('screen-' + name);
  if (target) {
    target.classList.add('active');
  }
}

export function openModal(name) {
  closeAllModals();
  const overlay = $('modal-' + name);
  if (overlay) overlay.classList.add('active');
}

export function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

// ============================================================
// Header
// ============================================================
export function updateStreakBadge(streak) {
  if (DOM.streakCount) DOM.streakCount.textContent = streak;
  const badge = DOM.streakBadge;
  if (badge) badge.style.display = streak > 0 ? 'flex' : 'none';
}

// ============================================================
// Tela Inicial
// ============================================================
export function renderHomeScreen({ category, categoryEmoji, wordLength }) {
  if (DOM.homeCategoryValue) {
    DOM.homeCategoryValue.textContent = `${categoryEmoji} ${category}`;
  }
  if (DOM.homeWordLen) {
    DOM.homeWordLen.textContent = `${wordLength} letras`;
  }
}

// ============================================================
// Grid de Letras
// ============================================================

/** Gera o grid vazio de tiles */
export function buildGrid() {
  const grid = DOM.gameGrid;
  if (!grid) return;
  grid.innerHTML = '';

  for (let r = 0; r < MAX_ATTEMPTS; r++) {
    const row = document.createElement('div');
    row.classList.add('grid-row');
    row.setAttribute('role', 'row');
    row.dataset.row = r;

    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement('div');
      tile.classList.add('tile');
      tile.setAttribute('role', 'gridcell');
      tile.setAttribute('aria-label', 'vazio');
      tile.dataset.row = r;
      tile.dataset.col = c;
      row.appendChild(tile);
    }
    grid.appendChild(row);
  }
}

/** Retorna o elemento tile */
function getTile(row, col) {
  return DOM.gameGrid?.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

/** Adiciona uma letra no tile atual */
export function addLetterToTile(row, col, letter) {
  const tile = getTile(row, col);
  if (!tile) return;
  tile.textContent = letter;
  tile.classList.add('filled');
  tile.setAttribute('aria-label', letter);
  // Animação pop
  tile.classList.remove('anim-pop');
  void tile.offsetWidth; // reflow
  tile.classList.add('anim-pop');
}

/** Remove a letra do tile */
export function removeLetterFromTile(row, col) {
  const tile = getTile(row, col);
  if (!tile) return;
  tile.textContent = '';
  tile.classList.remove('filled', 'cursor');
  tile.setAttribute('aria-label', 'vazio');
}

/** Atualiza o cursor visual (borda no tile atual) */
export function updateCursor(row, col) {
  // Remove cursor de todos
  DOM.gameGrid?.querySelectorAll('.tile.cursor').forEach(t => t.classList.remove('cursor'));
  // Adiciona no atual
  const tile = getTile(row, col);
  if (tile && !tile.textContent) tile.classList.add('cursor');
}

/**
 * Revela uma linha com animação de flip
 * @param {number} row
 * @param {{char: string, state: string}[]} letterObjects
 * @returns {Promise} resolve quando animação terminar
 */
export function revealRow(row, letterObjects) {
  return new Promise(resolve => {
    const FLIP_DURATION = 300;
    const FLIP_DELAY = 250;

    letterObjects.forEach(({ char, state }, col) => {
      const tile = getTile(row, col);
      if (!tile) return;

      setTimeout(() => {
        // Fase 1: flip para baixo (já feito no CSS mid-point)
        tile.style.transition = `transform ${FLIP_DURATION}ms ease-in-out`;
        tile.style.transform = 'rotateX(-90deg)';

        setTimeout(() => {
          // Fase 2: aplicar cor e flip de volta
          tile.classList.remove('filled', 'cursor');
          tile.classList.add(state);
          tile.setAttribute('aria-label', `${char} — ${stateLabel(state)}`);
          tile.style.transform = 'rotateX(0deg)';

          // Limpar inline styles após animação completa (BUG-02)
          setTimeout(() => {
            tile.style.transform = '';
            tile.style.transition = '';
          }, FLIP_DURATION + 50);

          // Resolve na última tile
          if (col === WORD_LENGTH - 1) {
            setTimeout(resolve, FLIP_DURATION);
          }
        }, FLIP_DURATION / 2);
      }, col * FLIP_DELAY);
    });
  });
}

/** Restaura linhas já jogadas sem animação */
export function restoreRows(guesses) {
  guesses.forEach((letterObjects, row) => {
    letterObjects.forEach(({ char, state }, col) => {
      const tile = getTile(row, col);
      if (!tile) return;
      tile.textContent = char;
      tile.classList.remove('filled', 'cursor');
      tile.classList.add(state);
      tile.setAttribute('aria-label', `${char} — ${stateLabel(state)}`);
    });
  });
}

/** Animação de shake na linha atual (tentativa inválida) */
export function shakeRow(row) {
  const rowEl = DOM.gameGrid?.querySelector(`[data-row="${row}"]`);
  if (!rowEl) return;
  rowEl.classList.remove('anim-shake');
  void rowEl.offsetWidth;
  rowEl.classList.add('anim-shake');
  rowEl.addEventListener('animationend', () => rowEl.classList.remove('anim-shake'), { once: true });
}

/** Animação de bounce na linha vencedora */
export function bounceRow(row) {
  for (let col = 0; col < WORD_LENGTH; col++) {
    const tile = getTile(row, col);
    if (!tile) continue;
    setTimeout(() => {
      tile.classList.add('anim-bounce');
      tile.addEventListener('animationend', () => tile.classList.remove('anim-bounce'), { once: true });
    }, col * 80);
  }
}

// ============================================================
// Teclado Virtual
// ============================================================
const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','DEL'],
];

export function buildKeyboard(onKey) {
  const kb = DOM.keyboard;
  if (!kb) return;
  kb.innerHTML = '';

  KEYBOARD_ROWS.forEach(keys => {
    const row = document.createElement('div');
    row.classList.add('kb-row');

    keys.forEach(key => {
      const btn = document.createElement('button');
      btn.classList.add('key');
      btn.setAttribute('data-key', key);
      btn.setAttribute('aria-label', keyLabel(key));

      if (key === 'ENTER' || key === 'DEL') {
        btn.classList.add('wide');
        if (key === 'ENTER') btn.classList.add('enter');
        btn.textContent = key;
      } else {
        btn.textContent = key;
      }

      btn.addEventListener('click', () => onKey(key));
      row.appendChild(btn);
    });

    kb.appendChild(row);
  });
}

/** Atualiza cores das teclas com estados revelados */
export function updateKeyStates(keyStates) {
  if (!DOM.keyboard) return;
  Object.entries(keyStates).forEach(([letter, state]) => {
    const btn = DOM.keyboard.querySelector(`[data-key="${letter}"]`);
    if (!btn) return;
    // Prioridade: correct > present > absent
    if (btn.classList.contains('correct')) return;
    if (btn.classList.contains('present') && state === 'absent') return;
    btn.classList.remove('correct', 'present', 'absent');
    btn.classList.add(state);
  });
}

// ============================================================
// Contador de tentativas
// ============================================================
export function updateAttemptCounter(current, max) {
  if (DOM.attemptCounter) {
    DOM.attemptCounter.textContent = `TENTATIVA ${current + 1} DE ${max}`;
  }
}

// ============================================================
// Toast
// ============================================================
let toastTimer = null;

export function showToast(message, duration = 2000) {
  const toast = DOM.toast;
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// ============================================================
// Banner de jogo concluído
// ============================================================
export function showGameOverBanner(status, onClick) {
  const banner = DOM.gameOverBanner;
  if (!banner) return;
  banner.textContent = status === 'won'
    ? '🏆 Você venceu! Clique para ver o resultado'
    : '📊 Jogo encerrado — clique para ver o resultado';
  banner.classList.add('show');
  banner.onclick = onClick;
}

// ============================================================
// Modal de Resultado
// ============================================================
export function renderResultModal({ status, word, guesses, stats }) {
  const won = status === 'won';

  if (DOM.resultTitle) {
    DOM.resultTitle.textContent = won ? '🏆 Parabéns!' : '😤 Fim de jogo';
  }
  if (DOM.resultSubtitle) {
    DOM.resultSubtitle.textContent = won
      ? `Você acertou em ${guesses.length} tentativa${guesses.length > 1 ? 's' : ''}!`
      : 'Não foi dessa vez. Tente amanhã!';
  }
  if (DOM.resultWord) {
    DOM.resultWord.textContent = word;
  }

  // Grade de emojis
  if (DOM.resultEmoji) {
    const STATE_EMOJI = { correct: '🟨', present: '🟥', absent: '⬛' };
    DOM.resultEmoji.textContent = guesses
      .map(g => g.map(({ state }) => STATE_EMOJI[state]).join(''))
      .join('\n');
  }

  if (DOM.resultAttempts) {
    DOM.resultAttempts.textContent = won ? guesses.length : 'X';
  }
  if (DOM.resultStreak) {
    DOM.resultStreak.textContent = stats.currentStreak;
  }
}

// ============================================================
// Modal de Estatísticas
// ============================================================
export function renderStatsModal(stats) {
  if (DOM.statTotalGames) DOM.statTotalGames.textContent = stats.totalGames;

  if (DOM.statWinRate) {
    const rate = stats.totalGames > 0
      ? Math.round((stats.totalWins / stats.totalGames) * 100)
      : 0;
    DOM.statWinRate.textContent = `${rate}%`;
  }

  if (DOM.statStreak) DOM.statStreak.textContent = stats.currentStreak;
  if (DOM.statBestStreak) DOM.statBestStreak.textContent = stats.bestStreak;

  // Distribuição
  if (DOM.distContainer) {
    const dist = stats.guessDistribution;
    const max = Math.max(...Object.values(dist), 1);
    DOM.distContainer.innerHTML = '';

    for (let i = 1; i <= 6; i++) {
      const count = dist[i] || 0;
      const pct = Math.round((count / max) * 100);

      const row = document.createElement('div');
      row.classList.add('distribution-row');

      const label = document.createElement('span');
      label.classList.add('dist-label');
      label.textContent = i;

      const bar = document.createElement('div');
      bar.classList.add('dist-bar');
      bar.style.width = `${Math.max(pct, 8)}%`;

      const span = document.createElement('span');
      span.textContent = count;
      bar.appendChild(span);

      row.appendChild(label);
      row.appendChild(bar);
      DOM.distContainer.appendChild(row);
    }
  }
}

// ============================================================
// Helpers
// ============================================================
function stateLabel(state) {
  const labels = { correct: 'posição correta', present: 'letra existe', absent: 'letra ausente' };
  return labels[state] || state;
}

function keyLabel(key) {
  if (key === 'ENTER') return 'Confirmar tentativa';
  if (key === 'DEL') return 'Apagar letra';
  return `Letra ${key}`;
}
