// Lehrer als eigene Bots: Für jedes Fach kann ein eigener Discord-Bot laufen (im selben Programm wie Willy).
// Token in die .env: LEHRER_MATHE_TOKEN, LEHRER_DEUTSCH_TOKEN, LEHRER_ENGLISCH_TOKEN, LEHRER_BIO_TOKEN,
// LEHRER_GESCHICHTE_TOKEN, LEHRER_SPORT_TOKEN. Fehlt ein Token, schreibt die Lehrkraft wie bisher per Webhook.
// Name, Profilbild, Spitzname und Status stellt Willy automatisch ein.
import fs from 'node:fs';
import path from 'node:path';
import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import { restAgent } from './net.js';
import { FAECHER } from './features/schule-daten.js';
import { globalState, save } from './storage.js';
import { logError } from './util.js';

const AVATARE = path.resolve('assets', 'lehrer');
// Kanal ansehen, Nachrichten senden, Links einbetten, Dateien anhängen, Verlauf lesen, eigenen Spitznamen ändern
export const LEHRER_PERMISSIONS = '67226624';

const bots = new Map(); // fach -> eingeloggter Client

export const lehrerBot = (fach) => bots.get(fach) ?? null;
export const alleLehrerBots = () => bots;
export const tokenFuer = (fach) => process.env[`LEHRER_${fach.toUpperCase()}_TOKEN`] || null;
export const einladungslink = (clientId) => `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${LEHRER_PERMISSIONS}&scope=bot`;
export const lehrerSpitzname = (f) => `${f.lehrer} (${f.name})`.slice(0, 32);

async function profilAnpassen(fach, client) {
  const f = FAECHER[fach];
  const g = globalState();
  g.lehrerProfil ??= {};
  const stand = (g.lehrerProfil[fach] ??= {});
  const name = f.lehrer.slice(0, 32);
  if (client.user.username !== name) {
    try {
      await client.user.setUsername(name);
    } catch (err) {
      console.warn(`⚠️ Name von ${f.lehrer} konnte nicht gesetzt werden (${err.message}). Discord erlaubt das nur 2x pro Stunde – klappt beim nächsten Start.`);
    }
  }
  if (stand.avatar !== f.avatar) {
    try {
      await client.user.setAvatar(fs.readFileSync(path.join(AVATARE, f.avatar)));
      stand.avatar = f.avatar;
      save();
    } catch (err) {
      console.warn(`⚠️ Profilbild von ${f.lehrer} konnte nicht gesetzt werden (${err.message}).`);
    }
  }
  client.user.setPresence({ activities: [{ type: ActivityType.Custom, name: 'custom', state: `📚 Unterrichtet ${f.name}` }] });
}

async function spitzname(guild, f) {
  const nick = lehrerSpitzname(f);
  if (guild.members.me && guild.members.me.nickname !== nick) await guild.members.me.setNickname(nick, 'Lehrer-Bot').catch(() => {});
}

/** Startet alle Lehrer-Bots, für die ein Token eingetragen ist. onInteraction verarbeitet Knöpfe (z. B. Quiz). */
export function startLehrerBots(onInteraction) {
  for (const [fach, f] of Object.entries(FAECHER)) {
    const token = tokenFuer(fach);
    if (!token) continue;
    const client = new Client({ intents: [GatewayIntentBits.Guilds], rest: { agent: restAgent } });
    client.once(Events.ClientReady, async () => {
      bots.set(fach, client);
      const drin = client.guilds.cache.size > 0;
      console.log(
        `👩‍🏫 ${f.lehrer} (${f.name}) ist online als ${client.user.tag}.` +
          (drin ? '' : ` Noch auf keinem Server – Einladung: ${einladungslink(client.user.id)}`),
      );
      await profilAnpassen(fach, client).catch((err) => logError(`lehrer:${fach}`, err));
      for (const guild of client.guilds.cache.values()) await spitzname(guild, f);
    });
    client.on(Events.GuildCreate, (guild) => spitzname(guild, f));
    client.on(Events.InteractionCreate, onInteraction);
    client.on(Events.Error, (err) => logError(`lehrer:${fach}`, err));
    client.login(token).catch((err) => console.warn(`⚠️ Lehrer-Bot für ${f.name} konnte sich nicht anmelden: ${err.message} (Token in LEHRER_${fach.toUpperCase()}_TOKEN prüfen)`));
  }
}
