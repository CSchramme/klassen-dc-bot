import { createHash } from 'node:crypto';

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

/** Zufallszahlen, die für denselben Text immer gleich sind (z. B. "Vertretungsplan von heute"). */
export function seededRng(seed) {
  let h = 1779033703 ^ seed.length;
  for (const ch of seed) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pickWith = (rng, arr) => arr[Math.floor(rng() * arr.length)];

export function shuffleWith(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Aktuelle Uhrzeit in einer Zeitzone: { date: 'YYYY-MM-DD', hour, minute, minutes, weekday: 1=Mo … 7=So } */
export function localNow(timeZone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour, minute, minutes: hour * 60 + minute, weekday: WEEKDAYS.indexOf(parts.weekday) + 1 };
}

/** "07:15" -> 435 (Minuten seit Mitternacht) */
export function parseTime(hhmm, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
}

/** Kurzer, stabiler Fingerabdruck (z. B. um zu merken, ob sich eine Nachricht oder Datei geändert hat). */
export const kurzHash = (wert) =>
  createHash('sha1')
    .update(typeof wert === 'string' || Buffer.isBuffer(wert) ? wert : JSON.stringify(wert))
    .digest('hex')
    .slice(0, 16);
