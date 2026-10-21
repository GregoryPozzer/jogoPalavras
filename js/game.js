/**
 * game.js — Engine de jogo do LEXO
 * Gerencia estado puro, sem tocar no DOM
 */

import { isValidWord } from './words.js';

export const MAX_ATTEMPTS = 6;
export const WORD_LENGTH = 5;

/**
 * Cria um estado de jogo zerado
 * @param {string} word - palavra secreta (uppercase)
 * @returns {object}
 */
export function createGameState(word) {
  return {
    word: word.toUpperCase(),
    currentRow: 0,
    currentCol: 0,
    currentGuess: [],       // letras da tentativa em andamento
    guesses: [],            // [[{char, state}, ...], ...]
    keyStates: {},          // { 'A': 'correct'|'present'|'absent' }
    status: 'playing',      // 'playing' | 'won' | 'lost'
    usedGuesses: new Set(), // palavras já tentadas
  };
}

/**
 * Restaura estado a partir de dados salvos
 * @param {string} word
 * @param {object} savedToday
 * @returns {object}
 */
export function restoreGameState(word, savedToday) {
  const state = createGameState(word);
  state.guesses = savedToday.guesses || [];
  state.keyStates = savedToday.keyStates || {};
  state.status = savedToday.status || 'playing';
  state.currentRow = state.guesses.length;
  state.usedGuesses = new Set(state.guesses.map(g => g.map(l => l.char).join('')));
  return state;
}

/**
 * Adiciona uma letra à tentativa atual
 * @param {object} state
 * @param {string} letter
 * @returns {{ state: object, changed: boolean }}
 */
export function addLetter(state, letter) {
  if (state.status !== 'playing') return { state, changed: false };
  if (state.currentCol >= WORD_LENGTH) return { state, changed: false };

  const newState = { ...state, currentGuess: [...state.currentGuess, letter.toUpperCase()] };
  newState.currentCol = newState.currentGuess.length;
  return { state: newState, changed: true };
}

/**
 * Remove a última letra da tentativa atual
 * @param {object} state
 * @returns {{ state: object, changed: boolean }}
 */
export function removeLetter(state) {
  if (state.status !== 'playing') return { state, changed: false };
  if (state.currentCol === 0) return { state, changed: false };

  const newState = { ...state, currentGuess: state.currentGuess.slice(0, -1) };
  newState.currentCol = newState.currentGuess.length;
  return { state: newState, changed: true };
}

/**
 * Submete a tentativa atual
 * @param {object} state
 * @returns {{ state: object, result: 'ok'|'incomplete'|'invalid'|'duplicate', evaluation: array|null }}
 */
export function submitGuess(state) {
  if (state.status !== 'playing') return { state, result: 'invalid', evaluation: null };

  if (state.currentGuess.length < WORD_LENGTH) {
    return { state, result: 'incomplete', evaluation: null };
  }

  const guessWord = state.currentGuess.join('');

  if (!isValidWord(guessWord)) {
    return { state, result: 'invalid', evaluation: null };
  }

  if (state.usedGuesses.has(guessWord)) {
    return { state, result: 'duplicate', evaluation: null };
  }

  // Avaliar letras
  const evaluation = evaluateGuess(guessWord, state.word);
  const letterObjects = state.currentGuess.map((char, i) => ({
    char,
    state: evaluation[i],
  }));

  // Novo estado
  const newState = { ...state };
  newState.guesses = [...state.guesses, letterObjects];
  newState.usedGuesses = new Set([...state.usedGuesses, guessWord]);
  newState.currentRow = newState.guesses.length;
  newState.currentCol = 0;
  newState.currentGuess = [];

  // Atualizar estados das teclas
  newState.keyStates = updateKeyStates({ ...state.keyStates }, state.currentGuess, evaluation);

  // Verificar fim de jogo
  if (guessWord === state.word) {
    newState.status = 'won';
  } else if (newState.currentRow >= MAX_ATTEMPTS) {
    newState.status = 'lost';
  }

  return { state: newState, result: 'ok', evaluation };
}

/**
 * Avalia uma tentativa contra a palavra secreta
 * Lida corretamente com letras duplicadas (algoritmo Wordle)
 * @param {string} guess - 5 letras uppercase
 * @param {string} word  - 5 letras uppercase
 * @returns {string[]} ['correct'|'present'|'absent', ...]
 */
export function evaluateGuess(guess, word) {
  const result = Array(WORD_LENGTH).fill('absent');
  const wordArr = word.split('');
  const guessArr = guess.split('');

  // Passo 1: marcar posições corretas
  guessArr.forEach((letter, i) => {
    if (letter === wordArr[i]) {
      result[i] = 'correct';
      wordArr[i] = null;
      guessArr[i] = null;
    }
  });

  // Passo 2: marcar letras presentes em posição errada
  guessArr.forEach((letter, i) => {
    if (letter === null) return;
    const idx = wordArr.indexOf(letter);
    if (idx !== -1) {
      result[i] = 'present';
      wordArr[idx] = null;
    }
  });

  return result;
}

/**
 * Atualiza o mapa de estados das teclas
 * Prioridade: correct > present > absent
 */
function updateKeyStates(keyStates, guessLetters, evaluation) {
  const PRIORITY = { correct: 3, present: 2, absent: 1 };
  guessLetters.forEach((letter, i) => {
    const newState = evaluation[i];
    const current = keyStates[letter];
    if (!current || PRIORITY[newState] > PRIORITY[current]) {
      keyStates[letter] = newState;
    }
  });
  return keyStates;
}
