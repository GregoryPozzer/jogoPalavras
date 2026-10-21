# SPECS.md — Documento de Projeto Técnico
# Jogo Casual de Adivinhação de Palavras "LEXO"

## 1. Visão Técnica Geral

O LEXO é um jogo web estático (HTML + CSS + JavaScript vanilla), sem backend, que roda inteiramente no navegador. Todo o estado é persistido via `localStorage`. O design adotado é o **Minimal Premium** (preto #111111, dourado #D4A853, Space Grotesk), mobile-first, responsivo.

## 2. Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Estrutura | HTML5 semântico | Sem dependências de build |
| Estilos | CSS3 Vanilla | Controle total, zero overhead |
| Lógica | JavaScript ES2022 (modules) | Nativo, sem transpiler |
| Tipografia | Google Fonts (Space Grotesk) | Visual editorial premium |
| Persistência | localStorage | Sem backend, sem cadastro |
| CI/CD | GitHub Pages (opcional) | Deploy trivial |

**Sem frameworks, sem bundler, sem backend.** Arquitetura pura para máxima performance e carregamento < 2s.

## 3. Estrutura de Arquivos

```
jogoPalavras/
├── index.html          # Ponto de entrada único (SPA manual)
├── css/
│   ├── reset.css       # Normalize mínimo
│   ├── tokens.css      # Design tokens (CSS custom properties)
│   ├── layout.css      # Grid, flexbox, estrutura de página
│   ├── components.css  # Tiles, teclado, modais, badges
│   └── animations.css  # Keyframes: flip, shake, bounce, pop
├── js/
│   ├── main.js         # Orquestrador — inicializa o jogo
│   ├── words.js        # Banco de palavras + seleção por data
│   ├── game.js         # Engine de jogo (estado, lógica, validação)
│   ├── ui.js           # DOM manipulation + renderização
│   ├── keyboard.js     # Teclado virtual + físico
│   ├── storage.js      # Wrapper localStorage (streak, stats, histórico)
│   ├── share.js        # Geração de resultado para compartilhamento
│   └── animations.js   # Controle de animações e timing
└── prototypes.html     # Arquivo de referência dos mockups
```

## 4. Design System — Tokens CSS

```css
:root {
  /* Cores principais */
  --color-bg:          #111111;
  --color-surface:     #1A1A1A;
  --color-surface-2:   #222222;
  --color-border:      #2A2A2A;
  --color-gold:        #D4A853;
  --color-gold-dark:   #B8902F;
  --color-text:        #FFFFFF;
  --color-text-muted:  #888888;
  --color-text-dim:    #555555;

  /* Estado das letras */
  --color-correct:     #D4A853;   /* dourado — posição correta */
  --color-present:     #C0392B;   /* vermelho — letra existe */
  --color-absent:      #2A2A2A;   /* carvão — letra ausente */
  --color-absent-text: #555555;

  /* Tipografia */
  --font-primary:      'Space Grotesk', system-ui, sans-serif;
  --font-size-xs:      0.7rem;
  --font-size-sm:      0.85rem;
  --font-size-base:    1rem;
  --font-size-lg:      1.25rem;
  --font-size-xl:      1.5rem;
  --font-size-2xl:     2rem;

  /* Espaçamento */
  --tile-size:         54px;
  --tile-gap:          6px;
  --key-height:        42px;
  --key-gap:           5px;
  --border-radius-sm:  4px;
  --border-radius-md:  8px;

  /* Animações */
  --duration-fast:     150ms;
  --duration-normal:   300ms;
  --duration-slow:     500ms;
  --easing-bounce:     cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
```

## 5. Modelo de Dados

### 5.1 Banco de Palavras (`words.js`)

```javascript
// Estrutura de dados
const WORD_BANK = {
  memes: [
    "skubi", "sigma", "aahhh", "brabo", "cringe",
    "faded", "manim", "skill", "vibes", "zoado",
    // ... mínimo 365 palavras para 1 ano sem repetição
  ],
  animais: [ /* futuras categorias */ ],
};

// Seleção determinística por data
function getWordOfTheDay() {
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const seed = hashDate(dateKey);                    // hash determinístico
  const category = getCategoryByDate(today);
  const words = WORD_BANK[category];
  const word = words[seed % words.length];
  return { word: word.toUpperCase(), category };
}

function hashDate(str) {
  // djb2 hash simples e determinístico
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
```

### 5.2 Estado do Jogo (`game.js`)

```javascript
const GameState = {
  // Imutáveis durante a partida
  word: '',           // palavra secreta (5 letras, uppercase)
  category: '',       // categoria temática
  wordLength: 5,      // sempre 5 no MVP
  maxAttempts: 6,     // limite de tentativas

  // Mutáveis
  currentRow: 0,      // linha atual (0–5)
  currentCol: 0,      // coluna atual (0–4)
  currentGuess: [],   // letras da tentativa em andamento
  guesses: [],        // array de tentativas confirmadas [{letters:[{char,state}]}]
  keyStates: {},      // estado de cada tecla: 'correct'|'present'|'absent'
  status: 'playing',  // 'playing' | 'won' | 'lost'
  usedGuesses: [],    // palavras já tentadas (sem repetição)
};
```

### 5.3 Persistência (`storage.js`)

```javascript
// Chave no localStorage: "lexo_state"
const StorageSchema = {
  // Sessão do dia (resetada diariamente)
  today: {
    date: "2026-10-21",       // data ISO
    word: "SIGMA",             // palavra do dia
    status: "playing",         // won | lost | playing
    guesses: [],               // tentativas feitas
    keyStates: {},             // estado das teclas
  },

  // Estatísticas acumuladas (persistentes)
  stats: {
    totalGames: 0,
    totalWins: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedDate: null,
    guessDistribution: {1:0, 2:0, 3:0, 4:0, 5:0, 6:0},
  }
};
```

## 6. Algoritmo de Feedback de Letras

O algoritmo segue a lógica do Wordle (tratamento de letras duplicadas):

```javascript
function evaluateGuess(guess, word) {
  const result = Array(5).fill('absent');
  const wordArr = word.split('');
  const guessArr = guess.split('');

  // Passo 1: marcar letras corretas (verde/dourado)
  guessArr.forEach((letter, i) => {
    if (letter === wordArr[i]) {
      result[i] = 'correct';
      wordArr[i] = null;    // consumir a letra
      guessArr[i] = null;
    }
  });

  // Passo 2: marcar letras presentes na posição errada (amarelo/vermelho)
  guessArr.forEach((letter, i) => {
    if (letter === null) return;
    const idx = wordArr.indexOf(letter);
    if (idx !== -1) {
      result[i] = 'present';
      wordArr[idx] = null;  // consumir para evitar duplicata
    }
  });

  return result; // ['correct','present','absent','absent','correct']
}
```

## 7. Sistema de Streak

```javascript
function updateStreak(stats, won) {
  const today = new Date().toISOString().split('T')[0];
  const last = stats.lastPlayedDate;

  if (last === null) {
    // primeiro jogo
    stats.currentStreak = won ? 1 : 0;
  } else {
    const dayDiff = daysBetween(last, today);
    if (dayDiff === 1) {
      // jogou ontem — mantém/incrementa
      stats.currentStreak = won ? stats.currentStreak + 1 : 0;
    } else if (dayDiff > 1) {
      // pulou um dia — reseta
      stats.currentStreak = won ? 1 : 0;
    }
    // dayDiff === 0: mesmo dia, não altera streak
  }

  if (stats.currentStreak > stats.bestStreak) {
    stats.bestStreak = stats.currentStreak;
  }
  stats.lastPlayedDate = today;
  stats.totalGames++;
  if (won) stats.totalWins++;
  return stats;
}
```

## 8. Fluxo de Telas (Single Page Application manual)

```
index.html
│
├── #screen-home    → Tela inicial: logo, botão jogar, tema do dia
├── #screen-game    → Tela de jogo: grid + teclado
├── #modal-result   → Modal de resultado (sobreposto ao game)
├── #modal-stats    → Modal de estatísticas
└── #modal-help     → Modal de como jogar
```

Transições controladas por CSS classes `.visible` / `.hidden` sem roteador.

## 9. Componentes de Interface

### 9.1 Grid de Letras

```html
<div id="game-grid" role="grid" aria-label="Grade de tentativas">
  <!-- 6 linhas geradas via JS -->
  <div class="grid-row" role="row" data-row="0">
    <div class="tile" role="gridcell" data-col="0" aria-label=""></div>
    <!-- ... 5 tiles por linha -->
  </div>
</div>
```

### 9.2 Teclado Virtual

```html
<div id="keyboard" role="group" aria-label="Teclado virtual">
  <div class="kb-row">
    <button class="key" data-key="Q" aria-label="Letra Q">Q</button>
    <!-- ... layout QWERTY completo -->
    <button class="key key-enter" data-key="ENTER">ENTER</button>
    <button class="key key-del" data-key="BACKSPACE">DEL</button>
  </div>
</div>
```

### 9.3 Modal de Resultado

```html
<div id="modal-result" role="dialog" aria-modal="true" aria-labelledby="result-title">
  <div class="modal-content">
    <h2 id="result-title"><!-- Vitória! / Fim de jogo --></h2>
    <div class="result-emoji-grid"><!-- emojis para compartilhamento --></div>
    <div class="result-word"><!-- palavra revelada --></div>
    <div class="result-stats"><!-- tentativas usadas --></div>
    <button id="btn-share">⬆ Compartilhar</button>
    <button id="btn-stats">Ver Estatísticas</button>
  </div>
</div>
```

## 10. Animações

| Animação | Quando | Duração |
|----------|--------|---------|
| `flip-in` | Confirmar tentativa (reveal) | 300ms por tile, escalonado +100ms |
| `shake` | Tentativa inválida | 400ms, 3 oscilações |
| `bounce` | Vitória — tiles pulam | 600ms, escalonado |
| `pop` | Digitar uma letra | 80ms, scale 1.1 → 1 |
| `slide-up` | Modal aparece | 300ms ease-out |
| `fade-in` | Troca de tela | 200ms |

```css
@keyframes flip-in {
  0%   { transform: rotateX(0deg); }
  50%  { transform: rotateX(-90deg); background: var(--color-surface); }
  100% { transform: rotateX(0deg); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}

@keyframes tile-bounce {
  0%, 100% { transform: translateY(0); }
  40%      { transform: translateY(-12px); }
}
```

## 11. Compartilhamento

```javascript
function generateShareText(guesses, word, won) {
  const today = new Date().toLocaleDateString('pt-BR');
  const rows = guesses.map(g =>
    g.map(({state}) =>
      state === 'correct' ? '🟨' :   // dourado
      state === 'present' ? '🟥' :   // vermelho
                            '⬛'      // ausente
    ).join('')
  ).join('\n');

  return [
    `LEXO — ${today}`,
    `${won ? guesses.length : 'X'}/6`,
    '',
    rows,
    '',
    'Jogue em: [URL do jogo]'
  ].join('\n');
}
```

Uso:
- **Navigator Share API** (mobile nativo): `navigator.share({ text })`
- **Fallback**: `navigator.clipboard.writeText(text)` + toast "Copiado!"

## 12. Acessibilidade (WCAG 2.1 AA)

| Critério | Implementação |
|----------|--------------|
| Contraste | Gold #D4A853 sobre #111: ratio 7.2:1 (AAA) |
| Focus visível | Outline 2px dourado em todos os elementos interativos |
| ARIA roles | `role="grid"`, `role="dialog"`, `aria-live="polite"` |
| Teclado físico | Enter, Backspace, letras A-Z |
| Screen reader | `aria-label` em todos os tiles e teclas |
| Reduced motion | `@media (prefers-reduced-motion)` desativa animações |
| Font size | Mínimo 14px em telas pequenas |

```css
@media (prefers-reduced-motion: reduce) {
  .tile, .key, .modal { animation: none !important; transition: none !important; }
}
```

## 13. Responsividade

| Breakpoint | Layout |
|-----------|--------|
| < 380px | tile: 46px, key: 26px, gap reduzido |
| 380–480px (mobile) | tile: 54px, key: 30px — **layout base** |
| > 480px | tile: 58px, max-width: 480px centrado |

```css
.game-container { max-width: 480px; margin: 0 auto; }

@media (max-width: 380px) {
  --tile-size: 46px;
  .key { width: 26px; }
}
```

## 14. Validação de Palavras

Para o MVP, a validação usará uma lista de palavras válidas em memória:

```javascript
// words.js — duas listas separadas
const ANSWERS = [/* palavras que podem ser a resposta */];
const VALID_GUESSES = new Set([
  ...ANSWERS,
  /* palavras extras aceitas como tentativa mas nunca como resposta */
]);

function isValidWord(word) {
  return VALID_GUESSES.has(word.toLowerCase());
}
```

Mensagem de erro: toast `"Palavra não encontrada"` + animação shake na linha.

## 15. Ciclo de Vida da Sessão Diária

```
App inicia
  │
  ├─ storage.load() → carrega estado salvo
  │
  ├─ É hoje? (same date as saved)
  │   ├─ SIM: restaura estado (guesses, keyStates, status)
  │   │        └─ status === 'playing' → abre jogo
  │   │        └─ status !== 'playing' → abre modal resultado
  │   └─ NÃO: limpa today, gera nova palavra → tela inicial
  │
  └─ Renderiza UI com estado atual
```

## 16. Sequência de Eventos — Tentativa do Jogador

```
Usuário digita letra
  → ui.addLetter() → game.addLetter() → tile.textContent + class 'filled' + anim 'pop'

Usuário pressiona ENTER
  ├─ Linha incompleta? → shake + toast "Complete a palavra"
  ├─ Palavra inválida? → shake + toast "Palavra não encontrada"
  └─ Válida:
      → game.submitGuess()
      → evaluateGuess() → array de estados
      → ui.revealGuess() → flip animation tile por tile (delay escalonado)
      → storage.saveGuess()
      → updateKeyStates() → recolore teclas do teclado
      → game.status === 'won'? → setTimeout(400) → showResultModal('won')
      → game.status === 'lost'? → setTimeout(400) → showResultModal('lost')
      → game.currentRow++

Usuário pressiona BACKSPACE
  → game.removeLetter() → limpa tile + classe
```

## 17. Performance

- **Nenhuma dependência externa** além das fontes Google (carregadas assincronamente com `font-display: swap`)
- CSS e JS concatenados em arquivos únicos por categoria (sem HTTP extra no MVP)
- `localStorage` síncrono — OK para dados pequenos (~2KB)
- Imagens: zero (design 100% CSS + emojis Unicode)
- **Lighthouse score alvo**: Performance > 95, Accessibility > 90

## 18. Plano de Testes

### Testes Manuais (checklist)

- [ ] Palavra do dia gerada corretamente para datas distintas
- [ ] Sem repetição de palavra em 365 dias
- [ ] Tentativa inválida mostra shake + toast
- [ ] Tentativa repetida é bloqueada
- [ ] Feedback correto/presente/ausente para letras duplicadas
- [ ] Streak incrementa ao jogar em dias consecutivos
- [ ] Streak reseta ao pular um dia
- [ ] Reload restaura estado salvo
- [ ] Compartilhamento não revela a palavra
- [ ] Layout correto em iPhone SE (320px)
- [ ] Layout correto em telas maiores (> 480px)
- [ ] Teclado físico funcional (Enter, Backspace, A-Z)

### Critérios de Aceitação Técnicos

- Carregamento inicial < 2s em 3G (Lighthouse Throttling)
- Sem erros no console em Chrome, Firefox, Safari
- localStorage persiste entre reloads
- Teclado virtual não ocupa mais de 40% da tela em 360px de altura

## 19. Banco de Palavras — MVP (Memes)

Palavras de 5 letras do universo meme/internet BR, adequadas para faixa 8-18 anos:

```
sigma, skubi, cringe, vibes, based, brabo,
zoado, skill, faded, noobs, grind, swego,
manim, arata, bicho, corra, drako, ficar,
ganhe, heroi, jogou, kudos, lenda, mimir,
naipe, oreia, peido, queda, roast, suave,
treta, unico, vence, xadai, yikes, zarpa
```

_(mínimo 100 palavras únicas de 5 letras para o MVP — lista expandida no arquivo `words.js`)_

## 20. Critérios de Conclusão (Definition of Done)

- [ ] Jogo funcional end-to-end no navegador
- [ ] Palavra do dia determinística por data
- [ ] 6 tentativas com feedback correto
- [ ] Streak e estatísticas persistentes via localStorage
- [ ] Modal de resultado com compartilhamento
- [ ] Layout responsivo mobile-first
- [ ] Teclado virtual e físico funcionais
- [ ] Zero dependências de servidor
- [ ] Código revisado e sem erros de console
- [ ] Arquivo `docs/plans/2026-10-21-jogo-adivinhacao-palavras.md` (PRD) linkado
