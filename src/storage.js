// Winzige JSON-"Datenbank" in data/state.json. Reicht für einen Klassenserver völlig.
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve(process.env.STATE_FILE || path.join('data', 'state.json'));
let state = { guilds: {} };

try {
  state = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  state.guilds ??= {};
} catch {
  // Datei gibt es noch nicht - kein Problem.
}

let saveTimer = null;

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
  }, 500);
}

export function guildState(guildId) {
  const g = (state.guilds[guildId] ??= {});
  g.chaos ??= true;
  g.moderation ??= true;
  g.ids ??= {}; // Rollen- und Kanal-IDs vom Setup
  g.strafregister ??= {}; // userId -> [{ grund, datum }]
  g.tickets ??= {}; // channelId -> Ticketdaten
  g.ticketCounter ??= 0;
  return g;
}
