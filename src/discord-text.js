// KI-Antworten für Discord aufbereiten: Discord kann keine LaTeX-Formeln ($\frac{2}{1}$ & Co.) anzeigen.
// Wir wandeln die häufigsten Formeln in normalen Text mit Sonderzeichen um.

const HOCH = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ', '(': '⁽', ')': '⁾' };
const TIEF = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋' };

const SYMBOLE = {
  cdot: '·',
  times: '×',
  div: '÷',
  pm: '±',
  mp: '∓',
  leq: '≤',
  le: '≤',
  geq: '≥',
  ge: '≥',
  neq: '≠',
  ne: '≠',
  approx: '≈',
  equiv: '≡',
  pi: 'π',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  Delta: 'Δ',
  infty: '∞',
  circ: '°',
  degree: '°',
  rightarrow: '→',
  to: '→',
  Rightarrow: '⇒',
  leftarrow: '←',
  sum: 'Σ',
  ldots: '…',
  dots: '…',
  cdots: '⋯',
  '%': '%',
};

const hoch = (s) => ([...s].every((c) => HOCH[c]) ? [...s].map((c) => HOCH[c]).join('') : `^(${s})`);
const tief = (s) => ([...s].every((c) => TIEF[c]) ? [...s].map((c) => TIEF[c]).join('') : `_(${s})`);
const klammer = (s) => (/^[\w.,²³]+$/u.test(s) ? s : `(${s})`);

/** Wandelt LaTeX in einer Formel in lesbaren Text um. */
export function latexZuText(f) {
  let s = f;
  for (let i = 0; i < 5; i++) {
    const vorher = s;
    s = s
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a, b) => `${klammer(a.trim())}/${klammer(b.trim())}`)
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, a) => `√${klammer(a.trim())}`)
      .replace(/\\(?:text|mathrm|mathbf|textbf|operatorname)\s*\{([^{}]*)\}/g, '$1');
    if (s === vorher) break;
  }
  return s
    .replace(/\^\{\\circ\}|\^\\circ/g, '°')
    .replace(/\^\{([^{}]+)\}/g, (_, a) => hoch(a))
    .replace(/\^([0-9n+-])/g, (_, a) => hoch(a))
    .replace(/_\{([^{}]+)\}/g, (_, a) => tief(a))
    .replace(/_([0-9])/g, (_, a) => tief(a))
    .replace(/\\left|\\right/g, '')
    .replace(/\\(?:,|;|:|!|quad|qquad)/g, ' ')
    .replace(/\\([A-Za-z]+|%)/g, (m, name) => SYMBOLE[name] ?? name)
    .replace(/[{}]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

// $2$ oder $x$ (ohne Leerzeichen am Rand – Geldbeträge wie "5$ und 10$" haben welche)
const EINZELWERT = /^(?:-?[\d.,]+|[a-zA-Z])$/;
const SIEHT_NACH_MATHE_AUS = /\\[A-Za-z]|[\^_]|\d\s*[+\-*/=×·]\s*\d|[a-z]\s*=\s*\d/i;

/** Sucht $…$ und $$…$$ in KI-Text und ersetzt die Formeln durch normalen Text. Geldbeträge wie "5$" bleiben. */
export function fuerDiscord(text) {
  if (!text) return text;
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => latexZuText(f))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, f) => latexZuText(f))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, f) => latexZuText(f))
    .replace(/\$([^$\n]+?)\$/g, (m, f) => (SIEHT_NACH_MATHE_AUS.test(f) || EINZELWERT.test(f) ? latexZuText(f) : m));
}

/** Wird an jede KI-Anweisung gehängt. */
export const FORMAT_HINWEIS =
  'Formatierung: Deine Antwort erscheint in einem Discord-Chat. Discord kann keine LaTeX-Formeln anzeigen: ' +
  'Benutze niemals $-Zeichen oder Backslash-Befehle für Mathe. Schreib Rechnungen als normalen Text, z. B. 1 + 1 = 2, 2/1, x², 3 · 4, √9.';
