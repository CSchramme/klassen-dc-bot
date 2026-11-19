// Quatsch-Moderation: bestraft Gänse, Enten am falschen Ort, Buchstaben im Mathe-Kanal,
// zu kompetentes Schreiben im Team-Bereich und manchmal einfach so.
import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { guildState, save } from '../storage.js';
import { chance, logError, pick } from '../util.js';
import { findChannel } from './roles.js';
import { INSIDERS, insiderNames } from '../insider.js';

const NO_PINGS = { parse: [] };
const snarkCooldown = new Map(); // channelId -> Zeitstempel
const insiderCooldown = new Map();

const STRAFEN = [
  '3 Liegestütze',
  'Einmal um den Tisch laufen',
  'Tafel wischen (mental)',
  'Eine Woche lang „Standart" schreiben',
  'Dem Bot ein Kompliment machen',
  '5 Minuten an eine Ente denken',
  'Das Wort „Gans" 100-mal NICHT schreiben',
  'Hausaufgaben für morgen (welche auch immer)',
];

function cooled(map, key, ms) {
  const last = map.get(key) ?? 0;
  if (Date.now() - last < ms) return false;
  map.set(key, Date.now());
  return true;
}

/** Eintrag ins Strafregister + Protokoll in der #🚨-polizeiwache. */
async function bestrafen(message, grund) {
  const g = guildState(message.guild.id);
  const strafe = chance(0.15) && insiderNames().length ? `Eine Schweigeminute für ${pick(insiderNames())}` : pick(STRAFEN);
  const list = (g.strafregister[message.author.id] ??= []);
  list.push({ grund, strafe, datum: new Date().toISOString() });
  if (list.length > 50) list.splice(0, list.length - 50);
  save();

  const log = findChannel(message.guild, 'modlog');
  if (log?.isTextBased()) {
    await log
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x34495e)
            .setTitle(`📋 Protokoll Nr. ${Math.floor(Math.random() * 90000) + 10000}`)
            .addFields(
              { name: 'Täter:in', value: `<@${message.author.id}>`, inline: true },
              { name: 'Tatort', value: `<#${message.channel.id}>`, inline: true },
              { name: 'Verstoß', value: grund },
              { name: 'Strafe', value: strafe },
            )
            .setTimestamp(),
        ],
        allowedMentions: NO_PINGS,
      })
      .catch(() => {});
  }
  return strafe;
}

async function deleteAndWarn(message, text, grund) {
  await message.delete().catch(() => {});
  const strafe = await bestrafen(message, grund);
  const warn = await message.channel.send({
    content: `<@${message.author.id}> ${text}\n> Strafe: **${strafe}**`,
    allowedMentions: { users: [message.author.id] },
  });
  setTimeout(() => warn.delete().catch(() => {}), 20_000);
}

async function reply(message, text) {
  return message.reply({ content: text, allowedMentions: { repliedUser: false, parse: [] }, failIfNotExists: false });
}

/** Wird für jede Nachricht auf dem Server aufgerufen. */
export async function handleModeration(message) {
  const g = guildState(message.guild.id);
  if (!g.moderation) return;
  const text = message.content ?? '';
  const lower = text.toLowerCase();
  const channel = message.channel;

  // Eingang und Kodex in Ruhe lassen
  const skip = ['start', 'kodex'].map((k) => g.ids[`ch_${k}`]);
  if (skip.includes(channel.id)) return;

  try {
    // 1) Insider-Witze
    for (const insider of INSIDERS) {
      if (insider.trigger.some((t) => lower.includes(t.toLowerCase()))) {
        if (insider.emoji) message.react(insider.emoji).catch(() => {});
        if (cooled(insiderCooldown, `${channel.id}:${insider.name}`, 45_000)) await reply(message, pick(insider.reaktionen));
        return;
      }
    }

    // 2) Gänse sind serverweit verboten (§4)
    if (/g[aä]ns|🪿/i.test(text)) {
      await deleteAndWarn(message, '🚨 **Gänse sind auf diesem Server verboten (§4).** Deine Nachricht wurde aus Sicherheitsgründen entfernt.', 'Erwähnung einer Gans (§4)');
      const seconds = config.moderation.timeoutSeconds;
      if (seconds > 0 && message.member?.moderatable) {
        await message.member.timeout(seconds * 1000, 'Gans erwähnt (§4)').catch(() => {});
      }
      return;
    }

    // 3) "Erster!" -> Zweiter (§5)
    if (/^\s*(erste?r?|first|1\.?)\s*[!.1]*\s*$/i.test(text)) {
      message.react('🥈').catch(() => {});
      await reply(message, '🥈 Falsch. Du bist Zweiter. (§5)');
      return;
    }

    // 4) Enten in #nicht-enten (§4b) -> werden nach #enten umgesiedelt
    if (channel.id === g.ids.ch_nichtEnten && /ente|🦆|quack|quak/i.test(text)) {
      await deleteAndWarn(message, '🦆 **Enten sind in diesem Kanal verboten (§4b).** Deine Nachricht wurde umgesiedelt.', 'Ente in #nicht-enten (§4b)');
      const enten = message.guild.channels.cache.find((c) => c.name === 'enten' && c.isTextBased());
      if (enten) {
        await enten.send({ content: `📦 Umgesiedelte Nachricht von <@${message.author.id}>:\n>>> ${text.slice(0, 1800)}`, allowedMentions: NO_PINGS });
      }
      return;
    }

    // 5) Nur Zahlen in #mathe-nur-mit-zahlen
    if (channel.id === g.ids.ch_mathe && /[a-zäöüß]/i.test(text)) {
      await deleteAndWarn(message, '🔢 Nur Zahlen. Das waren Buchstaben. Wir haben nachgezählt.', 'Buchstaben im Mathe-Kanal');
      return;
    }

    // 6) Team-Bereich: Verstöße gegen den Team-Kodex (zu kompetent geschrieben)
    const kodex = findChannel(message.guild, 'kodex');
    if (kodex && channel.parentId === kodex.parentId && text.length > 0) {
      if (/\.\s*$/.test(text) && !/\.\.\s*$/.test(text)) {
        await bestrafen(message, 'Punkt am Satzende (§4 Abs. 3 TKRL)');
        await reply(message, '⚠️ **Verstoß gegen §4 Abs. 3 TKRL:** Punkt am Satzende. Das wirkt aggressiv und kompetent. Bitte dümmer schreiben 🦆');
        return;
      }
      if (chance(0.25) && !/\p{Extended_Pictographic}/u.test(text)) {
        await bestrafen(message, 'Kein Emoji (§6 TKRL)');
        await reply(message, '⚠️ **Verstoß gegen §6 TKRL:** Nachricht ohne unpassendes Emoji. Ermahnung wurde zu den Akten genommen 🥔');
        return;
      }
    }

    // Ab hier nur noch Sprüche, mit Cooldown pro Kanal
    if (!cooled(snarkCooldown, channel.id, 20_000)) return;

    // 7) Schreien
    const letters = text.replace(/[^a-zäöüß]/gi, '');
    if (letters.length >= 8 && letters === letters.toUpperCase() && chance(0.6)) {
      await bestrafen(message, 'Schreien im Chat');
      await reply(message, `🤫 Bitte nicht schreien. Ich hab das mal leiser gemacht:\n> ${text.toLowerCase().slice(0, 300)}`);
      return;
    }

    if (/\blol\b/i.test(text) && chance(0.05)) return void (await reply(message, '📜 Bitte „laut lachen" ausschreiben. Wir sind ein seriöser Server.'));
    if (/^\s*(ok|k|oke|okay)\s*$/i.test(text) && chance(0.1)) {
      return void (await reply(message, '📏 Ausführlicher bitte. Mindestens drei Sätze. (Moderationsrichtlinie 8.1)'));
    }
    if (/\bnicht\b/i.test(text) && chance(0.03)) {
      await bestrafen(message, 'Negativität');
      return void (await reply(message, '⚠️ Verwarnung wegen Negativität. Bitte positiv formulieren. Zum Beispiel: „nicht" → „sehr wohl nicht".'));
    }
    if (chance(0.007)) {
      return void (await reply(message, '🚔 **Routinekontrolle!** Bitte bleib ruhig und lass die Hände auf der Tastatur. … … Alles in Ordnung, du darfst weiterschreiben.'));
    }
    if (chance(0.005)) message.react(pick(['🧦', '🥔', '🦆', '🚦', '🤨'])).catch(() => {});
  } catch (err) {
    logError('moderation', err);
  }
}

/** Embed für /strafregister. */
export function strafregisterEmbed(guild, user) {
  const list = guildState(guild.id).strafregister[user.id] ?? [];
  const stufe =
    list.length === 0
      ? 'Unbescholten (verdächtig)'
      : list.length <= 2
        ? 'Kleinkriminell'
        : list.length <= 5
          ? 'Wiederholungstäter:in'
          : list.length <= 10
            ? 'Staatsfeind:in Nr. 2'
            : 'Staatsfeind:in Nr. 1';
  const lines = list
    .slice(-10)
    .reverse()
    .map((e) => `• <t:${Math.floor(new Date(e.datum).getTime() / 1000)}:d> – ${e.grund} → *${e.strafe}*`);
  return new EmbedBuilder()
    .setColor(0x34495e)
    .setTitle(`🗂️ Strafregister: ${user.username}`)
    .setDescription(`**Gefährdungsstufe:** ${stufe}\n**Einträge:** ${list.length}\n\n${lines.join('\n') || '_Keine Einträge. Noch._'}`)
    .setFooter({ text: 'Alle Angaben ohne Gewähr. Und ohne Sinn.' });
}
