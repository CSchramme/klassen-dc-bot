// Sprachkanal-Umbenennung: Sitzt jemand allein im Sprachkanal, heißt der Kanal z. B. "🎤 Tim redet mit sich selbst".
// Discord erlaubt nur 2 Namensänderungen pro Kanal in 10 Minuten. Deshalb benennt Willy nur um, wenn danach
// sicher noch eine Änderung zum Zurückbenennen frei ist.
import { ChannelType } from 'discord.js';
import { guildState, save } from '../storage.js';
import { logError, pick, truncate } from '../util.js';
import { automatikAn } from './events.js';

const WARTEN_MS = 45_000; // so lange muss jemand allein sein
const FENSTER_MS = 10 * 60_000;
const ALLEIN = ['🎤 {n} redet mit sich selbst', '🦗 {n} und die Grillen', '🎤 {n} wartet auf Freunde', '🪑 {n} ganz allein', '📞 {n} telefoniert mit niemandem'];

const pending = new Map(); // channelId -> Timeout
const changes = new Map(); // channelId -> Zeitstempel der letzten Umbenennungen

const humans = (ch) => ch.members.filter((m) => !m.user.bot);
const originals = (guildId) => (guildState(guildId).vcNamen ??= {});

function recentChanges(id) {
  const list = (changes.get(id) ?? []).filter((t) => Date.now() - t < FENSTER_MS);
  changes.set(id, list);
  return list;
}

async function rename(ch, name, reason) {
  await ch.setName(name, reason);
  recentChanges(ch.id).push(Date.now());
}

async function restore(ch) {
  const names = originals(ch.guild.id);
  const original = names[ch.id];
  if (!original) return;
  const recent = recentChanges(ch.id);
  if (recent.length >= 2) {
    // Limit erreicht: warten, bis wieder eine Änderung frei ist
    setTimeout(() => restore(ch).catch(() => {}), recent[0] + FENSTER_MS - Date.now() + 1000);
    return;
  }
  try {
    await rename(ch, original, 'Nicht mehr allein');
    delete names[ch.id];
    save();
  } catch (err) {
    logError('voicenames:restore', err);
  }
}

function check(ch) {
  if (!ch || ch.type !== ChannelType.GuildVoice || ch.id === ch.guild.afkChannelId) return;
  clearTimeout(pending.get(ch.id));
  const renamed = Boolean(originals(ch.guild.id)[ch.id]);
  const count = humans(ch).size;

  if (count !== 1) {
    if (renamed) restore(ch).catch(() => {});
    return;
  }
  if (renamed || !automatikAn(ch.guild.id, 'sprachkanal')) return;

  pending.set(
    ch.id,
    setTimeout(async () => {
      const people = humans(ch);
      // Noch allein? Und ist danach noch eine Änderung zum Zurückbenennen frei?
      if (people.size !== 1 || recentChanges(ch.id).length > 0) return;
      const name = pick(ALLEIN).replace('{n}', truncate(people.first().displayName, 40)).slice(0, 100);
      const names = originals(ch.guild.id);
      names[ch.id] = ch.name;
      save();
      try {
        await rename(ch, name, 'Allein im Sprachkanal');
      } catch (err) {
        delete names[ch.id];
        save();
        logError('voicenames:rename', err);
      }
    }, WARTEN_MS),
  );
}

export function initVoiceNames(client) {
  client.on('voiceStateUpdate', (oldState, newState) => {
    const guild = newState.guild;
    for (const id of new Set([oldState.channelId, newState.channelId])) if (id) check(guild.channels.cache.get(id));
  });
  // Nach einem Neustart: umbenannte Kanäle prüfen (z. B. ist inzwischen niemand mehr drin)
  for (const guild of client.guilds.cache.values()) {
    for (const id of Object.keys(originals(guild.id))) {
      const ch = guild.channels.cache.get(id);
      if (!ch) {
        delete originals(guild.id)[id];
        save();
      } else if (humans(ch).size !== 1) {
        restore(ch).catch(() => {});
      }
    }
  }
}
