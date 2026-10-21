/**
 * storage.js — Persistência via localStorage
 * Gerencia estado do dia, estatísticas e streak do LEXO
 */

const STORAGE_KEY = 'lexo_v1';

/**
 * Estrutura padrão de dados
 */
function defaultData() {
  return {
    today: {
      date: null,        // string YYYY-MM-DD
      word: null,
      guesses: [],       // array de arrays: [[{char, state},...], ...]
      keyStates: {},     // { 'A': 'correct' | 'present' | 'absent' }
      status: 'playing', // 'playing' | 'won' | 'lost'
    },
    stats: {
      totalGames: 0,
      totalWins: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastPlayedDate: null,
      guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    },
  };
}

/**
 * Carrega dados do localStorage
 * @returns {object} dados completos
 */
export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    // Garante campos que possam faltar (backward compat)
    const def = defaultData();
    return {
      today: { ...def.today, ...parsed.today },
      stats: { ...def.stats, ...parsed.stats },
    };
  } catch {
    return defaultData();
  }
}

/**
 * Salva dados no localStorage
 * @param {object} data
 */
export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignora erros de quota (modo privado)
    console.warn('[LEXO] Não foi possível salvar no localStorage.');
  }
}

/**
 * Verifica se o estado salvo é de hoje
 * @param {object} todayData
 * @param {string} todayKey YYYY-MM-DD
 * @returns {boolean}
 */
export function isTodaySession(todayData, todayKey) {
  return todayData.date === todayKey;
}

/**
 * Atualiza o streak e estatísticas ao fim de uma partida
 * @param {object} stats referência mutável
 * @param {boolean} won
 * @param {number} attemptsUsed  número de tentativas (1-6)
 * @param {string} todayKey YYYY-MM-DD
 * @returns {object} stats atualizado
 */
export function updateStats(stats, won, attemptsUsed, todayKey) {
  const s = { ...stats };
  const last = s.lastPlayedDate;

  if (last === null) {
    // Primeiro jogo
    s.currentStreak = won ? 1 : 0;
  } else {
    const dayDiff = daysBetween(last, todayKey);
    if (dayDiff === 0) {
      // Mesmo dia — não altera streak (já foi contabilizado)
      return s;
    } else if (dayDiff === 1) {
      // Dia seguinte — mantém ou incrementa
      s.currentStreak = won ? s.currentStreak + 1 : 0;
    } else {
      // Pulou dias — reseta
      s.currentStreak = won ? 1 : 0;
    }
  }

  if (s.currentStreak > s.bestStreak) {
    s.bestStreak = s.currentStreak;
  }

  s.lastPlayedDate = todayKey;
  s.totalGames += 1;
  if (won) {
    s.totalWins += 1;
    s.guessDistribution = { ...s.guessDistribution };
    s.guessDistribution[attemptsUsed] = (s.guessDistribution[attemptsUsed] || 0) + 1;
  }

  return s;
}

/**
 * Calcula diferença em dias entre duas strings YYYY-MM-DD
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function daysBetween(a, b) {
  const dateA = new Date(a);
  const dateB = new Date(b);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((dateB - dateA) / msPerDay);
}
