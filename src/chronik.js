// Wochenchronik: zählt mit, was auf dem Server passiert (für Schülerzeitung und Lehrerkonferenz).
// Personen werden nur bei positiven Dingen gemerkt (Quiz-Siege, gelöste Rätsel, gewonnene Duelle).
import { guildState, save } from './storage.js';

export function chronik(guildId) {
  const g = guildState(guildId);
  g.chronik ??= {};
  const c = g.chronik;
  c.seit ??= Date.now();
  c.zahlen ??= {};
  c.sieger ??= {};
  c.listen ??= {};
  c.ausgabe ??= 0;
  return c;
}

/** Zähler hochzählen, z. B. zaehle(guildId, 'feueralarme'). */
export function zaehle(guildId, key, n = 1) {
  const c = chronik(guildId);
  c.zahlen[key] = (c.zahlen[key] ?? 0) + n;
  save();
}

/** Pluspunkt für die Bestenliste der Woche (nur für Positives). */
export function siegerPunkt(guildId, userId, n = 1) {
  const c = chronik(guildId);
  c.sieger[userId] = (c.sieger[userId] ?? 0) + n;
  save();
}

/** Etwas für eine Liste merken (z. B. vergebene Spitznamen). Max. 10 Einträge. */
export function merke(guildId, liste, wert) {
  const c = chronik(guildId);
  const l = (c.listen[liste] ??= []);
  l.push(wert);
  if (l.length > 10) l.splice(0, l.length - 10);
  save();
}

/** Neue Woche: alles zurücksetzen (Ausgabennummer zählt weiter). */
export function chronikNeu(guildId) {
  const alt = chronik(guildId);
  guildState(guildId).chronik = { seit: Date.now(), zahlen: {}, sieger: {}, listen: {}, ausgabe: alt.ausgabe };
  save();
}
