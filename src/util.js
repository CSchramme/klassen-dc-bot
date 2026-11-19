export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const chance = (p) => Math.random() < p;

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Fehler loggen, ohne dass der Bot abstürzt. */
export function logError(where, err) {
  console.error(`[${where}]`, err?.stack || err);
}
