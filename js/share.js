/**
 * share.js — Módulo de compartilhamento do LEXO
 * Gera texto de resultado sem revelar a palavra
 */

import { MAX_ATTEMPTS } from './game.js';

const STATE_EMOJI = {
  correct: '🟨',
  present: '🟥',
  absent:  '⬛',
};

/**
 * Gera o texto de compartilhamento
 * @param {{ guesses: array, status: string, word: string }} param
 * @returns {string}
 */
export function generateShareText({ guesses, status, word }) {
  const won = status === 'won';
  const date = new Date().toLocaleDateString('pt-BR');
  const score = won ? `${guesses.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;

  const grid = guesses
    .map(g => g.map(({ state }) => STATE_EMOJI[state]).join(''))
    .join('\n');

  const gameUrl = typeof window !== 'undefined'
    ? window.location.origin + window.location.pathname
    : 'lexo.app';

  return [
    `LEXO — ${date}`,
    score,
    '',
    grid,
    '',
    `🔗 Jogue em: ${gameUrl}`,
  ].join('\n');
}

/**
 * Compartilha resultado (Web Share API com fallback clipboard)
 * @param {string} text
 * @returns {Promise<'shared'|'copied'|'error'>}
 */
export async function shareResult(text) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch {
      // Usuário cancelou ou API não disponível
    }
  }

  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Fallback: execCommand
    }
  }

  // Fallback final: textarea + execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return 'copied';
  } catch {
    return 'error';
  }
}
