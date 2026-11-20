// Das Schul-Spiel: Unterricht mit Lehrer-Figuren, Anwesenheit, Quiz, Noten, Klassenbuch,
// Nachsitzen und Klassensprecher-Wahl.
import fs from 'node:fs';
import path from 'node:path';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits as P,
  StringSelectMenuBuilder,
  WebhookClient,
  escapeMarkdown,
} from 'discord.js';
import { config } from '../config.js';
import { guildState, save } from '../storage.js';
import { kurzHash, localNow, logError, parseTime, pick, shuffle, truncate } from '../util.js';
import { rechteAbgleich } from './abgleich.js';
import { askAI } from '../ai.js';
import { FACH_KEYS, FAECHER, NOTEN_WORTE, STRAFSATZ } from './schule-daten.js';
import { findRole } from './roles.js';
import { humans, raid } from './chaos.js';
import { automatikAn } from './events.js';
import { hausaufgabe } from './fun.js';
import { alleLehrerBots, einladungslink, lehrerBot, tokenFuer } from '../lehrer-bots.js';
import { SERIOUS_CHAT_REPLY, SERIOUS_WORDS } from '../ernst.js';
import { siegerPunkt, zaehle } from '../chronik.js';

const NO_PINGS = { parse: [] };
const MIN = 60_000;
const AVATARE = path.resolve('assets', 'lehrer');

// Ablauf einer Stunde (in Millisekunden ab Beginn)
const ABLAUF = { lektion: 1 * MIN, fragen: [3 * MIN, 6 * MIN, 9 * MIN], antwortZeit: 90_000, ende: 12 * MIN, puenktlich: 3 * MIN };
const NACHSITZEN_MS = 15 * MIN;

const lessons = new Map(); // guildId -> laufende Stunde

function schule(guildId) {
  const g = guildState(guildId);
  g.schule ??= {};
  const s = g.schule;
  s.ids ??= {};
  s.schueler ??= {};
  s.gehalten ??= {};
  s.klassenbuch ??= [];
  s.nachsitzen ??= {};
  s.gestartet ??= {};
  return s;
}

function schueler(s, userId) {
  const st = (s.schueler[userId] ??= { faecher: {}, eintraege: 0 });
  st.faecher ??= {};
  return st;
}

function fachStats(st, fach) {
  return (st.faecher[fach] ??= { anwesend: 0, zuspaet: 0, punkte: 0, mitarbeit: 0 });
}

const istEingerichtet = (guild) => Boolean(schule(guild.id).ids.raeume);
const raumVon = (guild, fach) => guild.channels.cache.get(schule(guild.id).ids.raeume?.[fach]);
const mainChat = (guild) => guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === 'allgemein') ?? guild.systemChannel;

// ---------------------------------------------------------------------------
// Lehrer sprechen lassen (Webhook mit eigenem Namen und Bild)
// ---------------------------------------------------------------------------
/** Kanal, wie ihn der Lehrer-Bot sieht (falls es für das Fach einen eigenen Bot gibt und er den Raum sehen darf). */
function lehrerKanal(guild, fach, channelId = schule(guild.id).ids.raeume?.[fach]) {
  return (channelId && lehrerBot(fach)?.channels.cache.get(channelId)) || null;
}

async function lehrerSagt(guild, fach, content) {
  const s = schule(guild.id);
  const f = FAECHER[fach];
  const eigen = lehrerKanal(guild, fach);
  if (eigen) {
    try {
      await eigen.send({ content: truncate(content, 1900), allowedMentions: NO_PINGS });
      return;
    } catch (err) {
      logError(`schule:lehrerbot:${fach}`, err);
    }
  }
  const wh = s.ids.webhooks?.[fach];
  if (wh) {
    try {
      const client = new WebhookClient({ id: wh.id, token: wh.token });
      await client.send({ content: truncate(content, 1900), allowedMentions: NO_PINGS });
      client.destroy();
      return;
    } catch (err) {
      logError(`schule:webhook:${fach}`, err);
    }
  }
  await raumVon(guild, fach)
    ?.send({ content: truncate(`**${f.lehrer}:** ${content}`, 1900), allowedMentions: NO_PINGS })
    .catch(() => {});
}

const lehrerEmbed = () => new EmbedBuilder().setColor(0x1f4d3a);
const lehrerBild = (fach) => new AttachmentBuilder(path.join(AVATARE, FAECHER[fach].avatar), { name: 'lehrer.png' });

/**
 * Nachricht mit Knöpfen (Anwesenheit, Quiz): vom Lehrer-Bot selbst, sonst von Willy mit Lehrer-Name und -Bild im Kopf.
 * Knöpfe auf Webhook-Nachrichten gehen nicht zuverlässig, deshalb hier kein Webhook.
 */
async function lehrerNachricht(guild, fach, embed, components) {
  const f = FAECHER[fach];
  const eigen = lehrerKanal(guild, fach);
  if (eigen) {
    try {
      return await eigen.send({ embeds: [embed], components, allowedMentions: NO_PINGS });
    } catch (err) {
      logError(`schule:lehrerbot:${fach}`, err);
    }
  }
  embed.setAuthor({ name: `${f.lehrer} (${f.name})`, iconURL: 'attachment://lehrer.png' });
  return raumVon(guild, fach).send({ embeds: [embed], files: [lehrerBild(fach)], components, allowedMentions: NO_PINGS });
}

/** KI-Anweisung für eine Lehrkraft. */
function lehrerPrompt(fach, imUnterricht) {
  const f = FAECHER[fach];
  return (
    `Du bist "${f.lehrer}", ${f.persona}. ${imUnterricht ? `Du unterrichtest gerade ${f.name}` : `Du bist Lehrkraft für ${f.name}`} in einer Schulklasse auf Discord. ` +
    'Antworte kurz (1–3 Sätze), lustig, aber freundlich und jugendfrei, und bleib in deiner Rolle. Beleidige niemanden. ' +
    'Wenn jemand etwas Ernstes schreibt (Mobbing, es geht ihm schlecht), antworte ernst und rate, sich an eine Vertrauensperson oder einen Admin zu wenden.'
  );
}

const erwaehnCooldown = new Map();

/** Jemand hat einen Lehrer-Bot erwähnt (oder auf ihn geantwortet): Die Lehrkraft antwortet selbst. */
export async function lehrerErwaehnt(message) {
  for (const [fach, bot] of alleLehrerBots()) {
    const id = bot.user.id;
    if (!message.mentions.users.has(id) && message.mentions.repliedUser?.id !== id) continue;
    const f = FAECHER[fach];
    const kanal = lehrerKanal(message.guild, fach, message.channel.id);
    if (!kanal) {
      await message.reply({ content: `📚 ${f.lehrer} kann diesen Raum nicht sehen. Versuch es im Fachraum.`, allowedMentions: { repliedUser: false, parse: [] } }).catch(() => {});
      return true;
    }
    const last = erwaehnCooldown.get(message.author.id) ?? 0;
    if (Date.now() - last < 15_000) return true;
    erwaehnCooldown.set(message.author.id, Date.now());
    const text = message.content.replace(/<@[!&]?\d+>/g, '').trim();
    const antwort = (content) =>
      kanal.send({ content: truncate(content, 1900), reply: { messageReference: message.id, failIfNotExists: false }, allowedMentions: { repliedUser: false, parse: [] } });
    if (SERIOUS_WORDS.test(text)) {
      await antwort(SERIOUS_CHAT_REPLY);
      return true;
    }
    await kanal.sendTyping().catch(() => {});
    const name = message.member?.displayName ?? message.author.username;
    const imUnterricht = lessons.get(message.guild.id)?.fach === fach;
    let ki = await askAI(lehrerPrompt(fach, imUnterricht), [{ role: 'user', content: `${name}: ${truncate(text || '(hat dich nur erwähnt)', 1500)}` }]);
    if (ki?.startsWith('[ERNST]')) ki = SERIOUS_CHAT_REPLY;
    await antwort(ki || pick(['Dazu später mehr. Viel später.', 'Gute Frage. Steht im Buch. Welches Buch? Ja.', 'Bitte melden, nicht reinrufen.']));
    return true;
  }
  return false;
}

/** Lehrer-Bots brauchen Zugang zu ihrem Fachraum (der ist sonst nur für Verifizierte sichtbar). */
const zugangGeprueft = new Map(); // `${guild}:${fach}` -> Zeitstempel
async function lehrerZugang(guild) {
  for (const [fach, bot] of alleLehrerBots()) {
    const key = `${guild.id}:${fach}`;
    if (Date.now() - (zugangGeprueft.get(key) ?? 0) < 10 * MIN) continue;
    zugangGeprueft.set(key, Date.now());
    const raeume = [raumVon(guild, fach), guild.channels.cache.get(schule(guild.id).ids.lehrerzimmer)].filter(
      (r) => r && !r.permissionOverwrites.cache.has(bot.user.id),
    );
    if (!raeume.length) continue;
    const mitglied = await guild.members.fetch(bot.user.id).catch(() => null);
    if (!mitglied) continue; // noch nicht eingeladen
    for (const raum of raeume) {
      await raum.permissionOverwrites
        .edit(bot.user.id, { ViewChannel: true, SendMessages: true, EmbedLinks: true, AttachFiles: true, ReadMessageHistory: true }, { reason: 'Lehrer-Bot' })
        .catch((err) => logError('schule:zugang', err));
      console.log(`🔑 ${FAECHER[fach].lehrer} hat jetzt Zugang zu ${raum.name}.`);
    }
  }
}

/** Für Erwähnungen im Fachraum während einer Stunde: der Lehrer antwortet (KI-Persona). */
export function lehrerKontext(guild, channelId) {
  const lesson = lessons.get(guild.id);
  if (!lesson || lesson.channelId !== channelId) return null;
  return { fach: lesson.fach, prompt: lehrerPrompt(lesson.fach, true), sagen: (text) => lehrerSagt(guild, lesson.fach, text) };
}

// ---------------------------------------------------------------------------
// Noten
// ---------------------------------------------------------------------------
/** Note aus Punkten pro Stunde. Gibt { value, text, wort } oder null (nie da gewesen). */
export function noteFuer(stats, gehalten) {
  if (!stats?.anwesend) return null;
  const proStunde = (stats.punkte + stats.mitarbeit) / stats.anwesend + 1; // max. ca. 10
  let value = 6 - 5 * Math.min(1, proStunde / 7);
  if (gehalten && stats.anwesend / gehalten < 0.5) value += 1; // oft gefehlt
  value += Math.min(1, stats.zuspaet * 0.2); // Zuspätkommen
  value = Math.max(1, Math.min(6, value));
  const ganz = Math.round(value);
  const rest = value - ganz;
  const mod = ganz < 6 && rest <= -0.2 ? '+' : ganz > 1 && rest >= 0.2 ? '-' : '';
  return { value: Math.round(value * 10) / 10, text: `${ganz}${mod}`, wort: NOTEN_WORTE[ganz] };
}

/** Alle echten Noten einer Person (für /noten und das Zeugnis). null = noch nie im Unterricht. */
export function echteNoten(guildId, userId) {
  const s = schule(guildId);
  const st = s.schueler[userId];
  if (!st) return null;
  const noten = FACH_KEYS.map((fach) => {
    const n = noteFuer(st.faecher[fach], s.gehalten[fach] ?? 0);
    return n ? { fach: FAECHER[fach].name, ...n, stats: st.faecher[fach] } : null;
  }).filter(Boolean);
  if (!noten.length) return null;
  const gehalten = FACH_KEYS.reduce((a, f) => a + (s.gehalten[f] ?? 0), 0);
  const anwesend = FACH_KEYS.reduce((a, f) => a + (st.faecher[f]?.anwesend ?? 0), 0);
  const eintraege = s.klassenbuch.filter((e) => e.userId === userId).length;
  return { noten, fehlstunden: Math.max(0, gehalten - anwesend), eintraege };
}

// ---------------------------------------------------------------------------
// Klassenbuch & Nachsitzen
// ---------------------------------------------------------------------------
export async function klassenbuchEintrag(guild, userId, grund) {
  const s = schule(guild.id);
  s.klassenbuch.push({ userId, grund, datum: Date.now() });
  zaehle(guild.id, 'klassenbuch');
  if (s.klassenbuch.length > 300) s.klassenbuch.splice(0, s.klassenbuch.length - 300);
  const st = schueler(s, userId);
  st.eintraege = (st.eintraege ?? 0) + 1;
  save();
  const buch = guild.channels.cache.get(s.ids.klassenbuch);
  await buch
    ?.send({ content: `📕 **Eintrag** · <@${userId}> · ${grund} · <t:${Math.floor(Date.now() / 1000)}:t>`, allowedMentions: NO_PINGS })
    .catch(() => {});
  if (st.eintraege >= 3) {
    st.eintraege = 0;
    save();
    await nachsitzen(guild, userId);
  }
}

async function nachsitzen(guild, userId) {
  const s = schule(guild.id);
  const raum = guild.channels.cache.get(s.ids.nachsitzen);
  const role = guild.roles.cache.get(s.ids.roleNachsitzen);
  if (!raum || !role) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  await member.roles.add(role, 'Nachsitzen (3 Klassenbuch-Einträge)').catch((err) => logError('schule:nachsitzen', err));
  s.nachsitzen[userId] = { bis: Date.now() + NACHSITZEN_MS, geschrieben: 0 };
  zaehle(guild.id, 'nachsitzen');
  save();
  await raum
    .send({
      content:
        `⛓️ <@${userId}>, **Nachsitzen!** Drei Einträge im Klassenbuch. Bis du fertig bist, darfst du nur hier schreiben.\n` +
        `Schreibe **3x** (jeweils als eigene Nachricht): \`${STRAFSATZ}\`\nSpätestens <t:${Math.floor(s.nachsitzen[userId].bis / 1000)}:R> darfst du wieder raus.`,
      allowedMentions: { users: [userId] },
    })
    .catch(() => {});
}

async function entlassen(guild, userId, grund) {
  const s = schule(guild.id);
  delete s.nachsitzen[userId];
  save();
  const member = await guild.members.fetch(userId).catch(() => null);
  const role = guild.roles.cache.get(s.ids.roleNachsitzen);
  if (member && role) await member.roles.remove(role, 'Nachsitzen vorbei').catch(() => {});
  await guild.channels.cache
    .get(s.ids.nachsitzen)
    ?.send({ content: `🔓 <@${userId}> ${grund}`, allowedMentions: NO_PINGS })
    .catch(() => {});
}

/** Nachrichten: Strafarbeit beim Nachsitzen, mündliche Mitarbeit und Unterrichtsstörungen. */
export async function handleSchulNachricht(message) {
  const guild = message.guild;
  if (!istEingerichtet(guild)) return false;
  const s = schule(guild.id);

  // Nachsitzen: Strafsatz abschreiben
  if (message.channel.id === s.ids.nachsitzen) {
    const n = s.nachsitzen[message.author.id];
    if (!n) return true;
    const norm = (t) => t.toLowerCase().replace(/[^a-zäöüß ]/g, '').replace(/\s+/g, ' ').trim();
    if (norm(message.content) === norm(STRAFSATZ)) {
      n.geschrieben++;
      save();
      message.react('✅').catch(() => {});
      if (n.geschrieben >= 3) await entlassen(guild, message.author.id, 'hat die Strafarbeit erledigt und darf gehen. Benimm dich. 🧹');
    } else {
      message.react('❌').catch(() => {});
    }
    return true;
  }

  // Unterricht: Mitarbeit und Störungen
  const lesson = lessons.get(guild.id);
  if (!lesson || lesson.channelId !== message.channel.id) return false;
  if (/langweilig|langeweile|kein(en)? bock|schlafen|wann ist pause/i.test(message.content)) {
    await lehrerSagt(guild, lesson.fach, `${escapeMarkdown(message.member?.displayName ?? 'Jemand')}, das kommt ins Klassenbuch. 📕`);
    await klassenbuchEintrag(guild, message.author.id, `Unterrichtsstörung in ${FAECHER[lesson.fach].name} („${truncate(message.content, 60)}“)`);
    return false;
  }
  if (lesson.anwesend.has(message.author.id)) {
    const n = lesson.mitarbeit.get(message.author.id) ?? 0;
    if (n < 3) lesson.mitarbeit.set(message.author.id, n + 1);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Unterrichtsstunde
// ---------------------------------------------------------------------------
function gongImSprachkanal(guild, filter) {
  const voll = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildVoice && c.id !== guild.afkChannelId && humans(c) > 0)
    .sort((a, b) => humans(b) - humans(a))
    .first();
  if (voll) raid(voll, { filter, count: 1, quick: true }).catch(() => {});
}

function anwesenheit(lesson, userId) {
  if (lesson.anwesend.has(userId)) return null;
  const zuSpaet = Date.now() - lesson.startedAt > ABLAUF.puenktlich;
  lesson.anwesend.set(userId, { zuSpaet });
  return zuSpaet;
}

export async function stundeStarten(guild, fach, nr = null) {
  if (lessons.has(guild.id)) return 'Es läuft schon eine Stunde.';
  const raum = raumVon(guild, fach);
  if (!raum) return 'Die Schule ist noch nicht eingerichtet. Erst `/schule einrichten`.';
  const f = FAECHER[fach];
  const lesson = { fach, channelId: raum.id, startedAt: Date.now(), anwesend: new Map(), mitarbeit: new Map(), punkte: new Map(), frage: null, timers: [], nr };
  lessons.set(guild.id, lesson);

  gongImSprachkanal(guild, /schulgong|gong/i);
  await mainChat(guild)
    ?.send({ content: `🔔 *Gong* … Der Unterricht beginnt: **${f.emoji} ${f.name}** bei ${f.lehrer} in <#${raum.id}>. Anwesenheitspflicht!`, allowedMentions: NO_PINGS })
    .catch(() => {});
  await lehrerNachricht(
    guild,
    fach,
    lehrerEmbed()
      .setTitle(`🔔 ${nr ? `${nr}. Stunde: ` : ''}${f.name}`)
      .setDescription(
        `Guten Tag. Bitte setzen. Wer da ist, drückt **„✋ Anwesend“**.\nWer später als ${ABLAUF.puenktlich / MIN} Minuten kommt, ist zu spät (Klassenbuch!).\n\n` +
          `Mitarbeit zählt: Wer im Unterricht schreibt, bekommt Punkte. Wer „langweilig“ schreibt, bekommt einen Eintrag.`,
      )
      .setFooter({ text: `Die Stunde dauert ${ABLAUF.ende / MIN} Minuten.` }),
    [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('schule:hier').setLabel('✋ Anwesend').setStyle(ButtonStyle.Success))],
  );

  const at = (ms, fn) => lesson.timers.push(setTimeout(() => fn().catch((err) => logError('schule:ablauf', err)), ms));
  at(ABLAUF.lektion, () => lektion(guild, lesson));
  const fragen = shuffle(f.fragen).slice(0, ABLAUF.fragen.length);
  ABLAUF.fragen.forEach((ms, i) => at(ms, () => frageStellen(guild, lesson, fragen[i], i)));
  at(ABLAUF.ende, () => stundeBeenden(guild));
  return `${f.name} hat begonnen in <#${raum.id}>.`;
}

async function lektion(guild, lesson) {
  const f = FAECHER[lesson.fach];
  const text = await askAI(
    `Du bist "${f.lehrer}", ${f.persona}. Halte eine Mini-Lektion für eine Schulklasse auf Discord: 3 bis 5 Sätze, ` +
      'mit einer echten, richtigen Information zum Fach, aber absurd und lustig erklärt. Jugendfrei, niemanden beleidigen. Keine Überschrift.',
    [{ role: 'user', content: `Mini-Lektion für ${f.name}, bitte. Thema darfst du selbst wählen.` }],
  );
  await lehrerSagt(guild, lesson.fach, `📚 **Tafelbild:**\n${text || pick(f.lektionen)}`);
}

async function frageStellen(guild, lesson, frage, index) {
  if (lessons.get(guild.id) !== lesson || !frage) return;
  const optionen = shuffle([frage.a, ...frage.wrong]);
  lesson.frage = { index, richtig: optionen.indexOf(frage.a), optionen, beantwortet: new Set(), richtige: [] };
  const msg = await lehrerNachricht(
    guild,
    lesson.fach,
    lehrerEmbed()
      .setTitle(`❓ Frage ${index + 1} von ${ABLAUF.fragen.length}`)
      .setDescription(`**${frage.q}**\n\nWer zuerst richtig antwortet: **+2 Punkte**, alle anderen Richtigen: +1. Ihr habt ${ABLAUF.antwortZeit / 1000} Sekunden.`),
    [
      new ActionRowBuilder().addComponents(
        optionen.map((o, i) => new ButtonBuilder().setCustomId(`schule:antwort:${index}:${i}`).setLabel(truncate(o, 80)).setStyle(ButtonStyle.Secondary)),
      ),
    ],
  );
  lesson.timers.push(
    setTimeout(async () => {
      const q = lesson.frage;
      if (!q || q.index !== index) return;
      lesson.frage = null;
      await msg.edit({ components: [] }).catch(() => {});
      const erste = q.richtige[0] ? (await guild.members.fetch(q.richtige[0]).catch(() => null))?.displayName : null;
      await lehrerSagt(
        guild,
        lesson.fach,
        `⏱️ Zeit um! Richtig war: **${q.optionen[q.richtig]}**. ` +
          (erste ? `Am schnellsten: **${escapeMarkdown(erste)}** (+2). ${q.richtige.length - 1 > 0 ? `${q.richtige.length - 1} weitere hatten es auch richtig.` : ''}` : 'Niemand hatte es richtig. Ich bin enttäuscht, aber nicht überrascht.'),
      );
    }, ABLAUF.antwortZeit),
  );
}

export async function stundeBeenden(guild, abgebrochen = false) {
  const lesson = lessons.get(guild.id);
  if (!lesson) return 'Es läuft gerade keine Stunde.';
  lessons.delete(guild.id);
  lesson.timers.forEach(clearTimeout);
  const s = schule(guild.id);
  const fach = lesson.fach;
  s.gehalten[fach] = (s.gehalten[fach] ?? 0) + 1;
  zaehle(guild.id, 'stunden');
  for (const [userId, { zuSpaet }] of lesson.anwesend) {
    const st = fachStats(schueler(s, userId), fach);
    st.anwesend++;
    if (zuSpaet) st.zuspaet++;
    st.punkte += lesson.punkte.get(userId) ?? 0;
    st.mitarbeit += lesson.mitarbeit.get(userId) ?? 0;
  }
  save();

  const top = [...lesson.anwesend.keys()]
    .map((id) => [id, (lesson.punkte.get(id) ?? 0) + (lesson.mitarbeit.get(id) ?? 0)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const namen = [];
  for (const [id, p] of top) {
    const m = await guild.members.fetch(id).catch(() => null);
    namen.push(`${['🥇', '🥈', '🥉'][namen.length]} ${escapeMarkdown(m?.displayName ?? 'Unbekannt')} (${p} Punkte)`);
  }
  gongImSprachkanal(guild, /pausenklingel|klingel|schulgong/i);
  await lehrerSagt(
    guild,
    fach,
    `🔔 ${abgebrochen ? 'Die Stunde wird abgebrochen.' : 'Das war es für heute.'} Anwesend: **${lesson.anwesend.size}**.\n` +
      (namen.length ? `Beste Mitarbeit:\n${namen.join('\n')}\n` : '') +
      `\n📚 **Hausaufgabe:** ${hausaufgabe()}\n\nNoten gibt es mit \`/noten\`. Tschüss.`,
  );
  return `Die Stunde ${FAECHER[fach].name} wurde beendet.`;
}

// ---------------------------------------------------------------------------
// Knöpfe & Menüs (customId "schule:…")
// ---------------------------------------------------------------------------
export async function handleSchule(interaction, action, a1, a2) {
  const ephemeral = { flags: MessageFlags.Ephemeral };
  const guild = interaction.guild;

  if (action === 'wahl') return stimmeAbgeben(interaction);

  const lesson = lessons.get(guild.id);
  if (!lesson) return interaction.reply({ content: '🔕 Die Stunde ist schon vorbei. Du bist trotzdem zu spät.', ...ephemeral });

  if (action === 'hier') {
    const zuSpaet = anwesenheit(lesson, interaction.user.id);
    if (zuSpaet === null) return interaction.reply({ content: 'Du bist schon eingetragen. Zweimal anwesend geht nur mit Formular D-2.', ...ephemeral });
    if (zuSpaet) {
      await interaction.reply({ content: '⏰ Eingetragen, aber **zu spät**. Das gibt einen Eintrag im Klassenbuch.', ...ephemeral });
      return klassenbuchEintrag(guild, interaction.user.id, `Zu spät zum Unterricht (${FAECHER[lesson.fach].name})`);
    }
    return interaction.reply({ content: '✅ Anwesend. Pünktlich sogar. Respekt.', ...ephemeral });
  }

  if (action === 'antwort') {
    const q = lesson.frage;
    if (!q || q.index !== Number(a1)) return interaction.reply({ content: 'Diese Frage ist schon vorbei.', ...ephemeral });
    if (q.beantwortet.has(interaction.user.id)) return interaction.reply({ content: 'Nur eine Antwort pro Frage. Abschreiben gilt nicht.', ...ephemeral });
    q.beantwortet.add(interaction.user.id);
    const spaet = anwesenheit(lesson, interaction.user.id); // wer antwortet, ist wohl da
    if (Number(a2) !== q.richtig) {
      return interaction.reply({ content: pick(['❌ Falsch. Setzen, sechs.', '❌ Leider nein.', '❌ Knapp daneben ist auch vorbei.', '❌ Interessante Antwort. Falsch, aber interessant.']), ...ephemeral });
    }
    const erster = q.richtige.length === 0;
    q.richtige.push(interaction.user.id);
    if (erster) siegerPunkt(guild.id, interaction.user.id);
    lesson.punkte.set(interaction.user.id, (lesson.punkte.get(interaction.user.id) ?? 0) + (erster ? 2 : 1));
    await interaction.reply({ content: erster ? '✅ Richtig – und als Erste:r! **+2 Punkte**' : '✅ Richtig! **+1 Punkt**', ...ephemeral });
    if (spaet) await klassenbuchEintrag(guild, interaction.user.id, `Zu spät zum Unterricht (${FAECHER[lesson.fach].name})`);
    return;
  }
  return interaction.reply({ content: 'Hä?', ...ephemeral });
}

// ---------------------------------------------------------------------------
// Klassensprecher-Wahl
// ---------------------------------------------------------------------------
async function wahlStarten(interaction) {
  const guild = interaction.guild;
  const s = schule(guild.id);
  const gesehen = guildState(guild.id).namensroulette?.gesehen ?? {};
  const ids = Object.entries(gesehen)
    .filter(([, t]) => Date.now() - t < 14 * 24 * 60 * MIN)
    .map(([id]) => id);
  const kandidaten = [];
  for (const id of ids) {
    const m = guild.members.cache.get(id) ?? (await guild.members.fetch(id).catch(() => null));
    if (m && !m.user.bot) kandidaten.push({ id, name: truncate(m.displayName, 90) });
    if (kandidaten.length >= 24) break;
  }
  if (kandidaten.length < 2) return 'Zu wenige Kandidat:innen. Es müssen mindestens 2 Leute in den letzten 14 Tagen aktiv gewesen sein.';
  kandidaten.push({ id: 'heinz', name: '🌵 Heinz (Kaktus)' });
  s.wahl = { kandidaten, stimmen: {}, endetAm: Date.now() + 24 * 60 * MIN, channelId: interaction.channelId };
  save();
  await interaction.channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🗳️ Wahl zur Klassensprecherin / zum Klassensprecher')
        .setDescription(
          `Wählt jetzt! Eine Stimme pro Person (ändern geht).\nDie Wahl endet <t:${Math.floor(s.wahl.endetAm / 1000)}:R>.\n\n_Wahlgeheimnis: Willy liest trotzdem mit._`,
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('schule:wahl')
          .setPlaceholder('Deine Stimme …')
          .addOptions(kandidaten.map((k) => ({ label: k.name, value: k.id }))),
      ),
    ],
  });
  return 'Die Wahl läuft.';
}

async function stimmeAbgeben(interaction) {
  const s = schule(interaction.guild.id);
  if (!s.wahl) return interaction.reply({ content: 'Es läuft gerade keine Wahl.', flags: MessageFlags.Ephemeral });
  s.wahl.stimmen[interaction.user.id] = interaction.values[0];
  save();
  return interaction.reply({ content: '🗳️ Stimme gezählt. Wahlgeheimnis gewahrt (Willy hat trotzdem hingeschaut).', flags: MessageFlags.Ephemeral });
}

async function wahlAuswerten(guild) {
  const s = schule(guild.id);
  const wahl = s.wahl;
  if (!wahl) return 'Es läuft keine Wahl.';
  s.wahl = null;
  save();
  const zaehlung = {};
  for (const id of Object.values(wahl.stimmen)) zaehlung[id] = (zaehlung[id] ?? 0) + 1;
  const sortiert = Object.entries(zaehlung).sort((a, b) => b[1] - a[1]);
  const kanal = guild.channels.cache.get(wahl.channelId) ?? mainChat(guild);
  if (!sortiert.length) {
    await kanal?.send({ content: '🗳️ Wahl beendet. Niemand hat gewählt. Demokratie, du wirst vermisst.', allowedMentions: NO_PINGS });
    return 'Niemand hat gewählt.';
  }
  const name = (id) => wahl.kandidaten.find((k) => k.id === id)?.name ?? 'Unbekannt';
  const ergebnis = sortiert.map(([id, n], i) => `${i + 1}. ${escapeMarkdown(name(id))}: ${n} Stimme${n === 1 ? '' : 'n'}`).join('\n');
  const gleich = sortiert.length > 1 && sortiert[0][1] === sortiert[1][1];
  let sieger = sortiert[0][0];
  let zusatz = gleich ? '\n_Gleichstand! Willy hat eine Münze geworfen. Sie ist unter die Heizung gerollt. Er hat einfach einen genommen._' : '';
  if (sieger === 'heinz') {
    zusatz += '\n🌵 Heinz (Kaktus) hat gewonnen, tritt aber sofort zurück („Ich bin ein Kaktus“).';
    sieger = sortiert.find(([id]) => id !== 'heinz')?.[0];
  }
  const role = guild.roles.cache.get(s.ids.roleSprecher);
  if (role && sieger) {
    for (const m of role.members.values()) await m.roles.remove(role).catch(() => {});
    const m = await guild.members.fetch(sieger).catch(() => null);
    if (m) await m.roles.add(role, 'Wahl gewonnen').catch(() => {});
  }
  await kanal?.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🎖️ Wahlergebnis')
        .setDescription(`${ergebnis}\n${zusatz}\n\n${sieger ? `**Neue:r Klassensprecher:in: <@${sieger}>** 🎉` : 'Niemand will es machen. Typisch.'}`),
    ],
    allowedMentions: sieger ? { users: [sieger] } : NO_PINGS,
  });
  return 'Ausgewertet.';
}

// ---------------------------------------------------------------------------
// Einrichten
// ---------------------------------------------------------------------------
/**
 * Richtet die Schule ein bzw. ergänzt, was fehlt (neue Fächer, Lehrerzimmer, Webhooks, Nachsitz-Rechte).
 * Läuft auch bei jedem Neustart. Gibt Protokollzeilen zurück (leise: nur wenn sich etwas geändert hat).
 */
export async function schulAbgleich(guild, { leise = false } = {}) {
  const s = schule(guild.id);
  const log = [];
  const verified = findRole(guild, 'verified');
  const team = findRole(guild, 'team');
  const everyone = guild.roles.everyone.id;
  const sicht = (nurLesen) => [
    { id: everyone, deny: [P.ViewChannel] },
    ...(verified ? [{ id: verified.id, allow: [P.ViewChannel], deny: nurLesen ? [P.SendMessages] : [] }] : []),
    ...(team ? [{ id: team.id, allow: [P.ViewChannel] }] : []),
    { id: guild.client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ManageWebhooks, P.ManageMessages, P.EmbedLinks, P.AttachFiles] },
  ];
  const kanal = (id, name) => guild.channels.cache.get(id) ?? guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === name);

  // Rollen
  const rolle = async (name, color, hoist = false) => {
    const vorhanden = guild.roles.cache.get(name === '⛓️ Nachsitzen' ? s.ids.roleNachsitzen : s.ids.roleSprecher) ?? guild.roles.cache.find((r) => r.name === name);
    if (vorhanden) {
      const farbe = vorhanden.colors?.primaryColor ?? vorhanden.color;
      if (vorhanden.editable && (vorhanden.name !== name || farbe !== color || vorhanden.hoist !== hoist)) {
        await vorhanden.edit({ name, colors: { primaryColor: color }, hoist, reason: 'Abgleich' }).catch((err) => logError('schule:rolle', err));
        log.push(`🎨 Rolle „${name}“ aktualisiert`);
      }
      return vorhanden;
    }
    log.push(`🎭 Rolle „${name}“ angelegt`);
    return guild.roles.create({ name, colors: { primaryColor: color }, hoist, permissions: [], reason: 'Schule' });
  };
  const nachsitzRolle = await rolle('⛓️ Nachsitzen', 0x2c3e50);
  const sprecherRolle = await rolle('🎖️ Klassensprecher:in', 0xf1c40f, true);
  s.ids.roleNachsitzen = nachsitzRolle.id;
  s.ids.roleSprecher = sprecherRolle.id;

  // Kategorie
  let cat = guild.channels.cache.get(s.ids.category) ?? guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.startsWith('🏫 Unterricht'));
  const KATEGORIE = '🏫 Unterricht (Anwesenheitspflicht)';
  let rechte = 0;
  let angepasst = 0;
  if (!cat) {
    cat = await guild.channels.create({ name: KATEGORIE, type: ChannelType.GuildCategory, permissionOverwrites: sicht(false) });
    log.push('🏫 Kategorie „Unterricht“ angelegt');
  } else {
    if (cat.name !== KATEGORIE) {
      await cat.setName(KATEGORIE, 'Abgleich').catch((err) => logError('schule:kat-name', err));
      angepasst++;
    }
    if (await rechteAbgleich(cat, sicht(false))) rechte++;
  }
  s.ids.category = cat.id;

  const sicherstellen = async (id, name, topic, nurLesen, extra = []) => {
    let ch = kanal(id, name);
    let neu = false;
    if (!ch) {
      ch = await guild.channels.create({ name, type: ChannelType.GuildText, parent: cat.id, topic, permissionOverwrites: [...sicht(nurLesen), ...extra] });
      neu = true;
    } else {
      if (ch.parentId !== cat.id) await ch.setParent(cat.id, { lockPermissions: false }).catch(() => {});
      if (ch.name !== name) {
        await ch.setName(name, 'Abgleich').catch((err) => logError('schule:name', err));
        angepasst++;
      }
      if ((ch.topic ?? '') !== topic) {
        await ch.setTopic(topic, 'Abgleich').catch((err) => logError('schule:thema', err));
        angepasst++;
      }
      if (await rechteAbgleich(ch, [...sicht(nurLesen), ...extra])) rechte++;
    }
    return { ch, neu };
  };

  // Lehrer-Webhooks: fehlende anlegen, Name und Bild aktuell halten
  const alleWebhooks = await guild.fetchWebhooks?.().catch(() => null);
  let whNeu = 0;
  let whAktualisiert = 0;
  const webhookAbgleich = async (map, fach, ch, reason) => {
    const f = FAECHER[fach];
    const name = `${f.lehrer} (${f.name})`;
    try {
      const avatar = fs.readFileSync(path.join(AVATARE, f.avatar));
      const stand = kurzHash(Buffer.concat([Buffer.from(`${name}|`), avatar]));
      let eintrag = map[fach];
      const vorhanden = eintrag && alleWebhooks?.get(eintrag.id);
      if (eintrag && alleWebhooks && (!vorhanden || vorhanden.channelId !== ch.id)) {
        // gelöscht oder hängt noch an einem alten Kanal
        if (vorhanden) await vorhanden.delete('Falscher Kanal').catch(() => {});
        delete map[fach];
        eintrag = null;
      }
      if (!eintrag) {
        const wh = await ch.createWebhook({ name, avatar, reason });
        map[fach] = { id: wh.id, token: wh.token, stand };
        whNeu++;
      } else if (eintrag.stand !== stand) {
        const client = vorhanden ? null : new WebhookClient({ id: eintrag.id, token: eintrag.token });
        try {
          await (vorhanden ?? client).edit({ name, avatar, reason: 'Abgleich' });
        } finally {
          client?.destroy();
        }
        eintrag.stand = stand;
        whAktualisiert++;
      }
    } catch (err) {
      logError(`schule:webhook:${fach}`, err);
    }
  };

  // Fachräume + Lehrer-Webhooks
  s.ids.raeume ??= {};
  s.ids.webhooks ??= {};
  const neueFaecher = [];
  for (const fach of FACH_KEYS) {
    const f = FAECHER[fach];
    const { ch, neu } = await sicherstellen(s.ids.raeume[fach], f.raum, `${f.emoji} ${f.name} bei ${f.lehrer}. Unterricht laut /stundenplan.`, false);
    s.ids.raeume[fach] = ch.id;
    if (neu) neueFaecher.push(f.name);
    await webhookAbgleich(s.ids.webhooks, fach, ch, 'Lehrer');
  }
  if (neueFaecher.length) log.push(`🏫 Neue Fachräume: ${neueFaecher.join(', ')}`);

  // Klassenbuch, Nachsitzen, Lehrerzimmer
  const buch = await sicherstellen(s.ids.klassenbuch, '📕-klassenbuch', 'Alle Einträge. Rechtskräftig (nicht).', true);
  s.ids.klassenbuch = buch.ch.id;
  if (buch.neu) {
    log.push('📕 Klassenbuch angelegt');
    await buch.ch.send({ content: '📕 **Klassenbuch eröffnet.** Hier landen Zuspätkommen, Störungen und alles andere. 3 Einträge = Nachsitzen.', allowedMentions: NO_PINGS });
  }
  const nach = await sicherstellen(s.ids.nachsitzen, '⛓️-nachsitzen', `Hier wird nachgesessen. Strafarbeit: 3x „${STRAFSATZ}“`, false, [
    { id: nachsitzRolle.id, allow: [P.ViewChannel, P.SendMessages] },
  ]);
  s.ids.nachsitzen = nach.ch.id;
  if (nach.neu) log.push('⛓️ Nachsitz-Raum angelegt');
  const lz = await sicherstellen(s.ids.lehrerzimmer, '☕-lehrerzimmer', 'Lehrerzimmer. Schüler:innen dürfen nur mitlesen. Psst.', true);
  s.ids.lehrerzimmer = lz.ch.id;
  if (lz.neu) log.push('☕ Lehrerzimmer angelegt');
  s.ids.lzWebhooks ??= {};
  for (const fach of FACH_KEYS) await webhookAbgleich(s.ids.lzWebhooks, fach, lz.ch, 'Lehrerzimmer');
  save();
  if (angepasst) log.push(`⚙️ ${angepasst} Schul-Kanäle angepasst (Name, Beschreibung)`);
  if (rechte) log.push(`🔐 Rechte in ${rechte} Schul-Kanälen angepasst`);
  if (whNeu) log.push(`🪝 ${whNeu} Lehrer-Webhooks angelegt`);
  if (whAktualisiert) log.push(`🪝 ${whAktualisiert} Lehrer-Webhooks aktualisiert (Name/Bild)`);

  // Reihenfolge im Unterricht: Fachräume, dann Klassenbuch, Nachsitzen, Lehrerzimmer
  const soll = [...FACH_KEYS.map((f) => s.ids.raeume[f]), s.ids.klassenbuch, s.ids.nachsitzen, s.ids.lehrerzimmer]
    .map((id) => guild.channels.cache.get(id))
    .filter(Boolean);
  const ist = [...guild.channels.cache.filter((c) => c.parentId === cat.id).values()].sort((a, b) => a.position - b.position);
  const rest = ist.filter((c) => !soll.includes(c));
  if ([...soll, ...rest].map((c) => c.id).join() !== ist.map((c) => c.id).join()) {
    await guild.channels.setPositions([...soll, ...rest].map((c, i) => ({ channel: c.id, position: i, parent: cat.id }))).catch((err) => logError('schule:reihenfolge', err));
  }

  // Nachsitzen-Rolle: überall sonst nicht schreiben/sprechen (nur Kanäle, die das noch nicht haben)
  let n = 0;
  for (const ch of guild.channels.cache.values()) {
    if (ch.id === s.ids.nachsitzen || ch.isThread?.() || !ch.permissionOverwrites || ch.permissionOverwrites.cache.has(nachsitzRolle.id)) continue;
    try {
      await ch.permissionOverwrites.edit(nachsitzRolle, { SendMessages: false, AddReactions: false, Speak: false, SendMessagesInThreads: false }, { reason: 'Nachsitzen' });
      n++;
    } catch {
      // egal
    }
  }
  if (n) log.push(`⛓️ Nachsitzen gilt jetzt in ${n} weiteren Kanälen`);
  if (!leise && !log.length) log.push('✅ Die Schule ist schon auf dem neuesten Stand.');
  return log;
}

// ---------------------------------------------------------------------------
// Stundenplan
// ---------------------------------------------------------------------------
const zeiten = () =>
  (config.schule.zeiten ?? [])
    .map((z) => ({ text: z, min: parseTime(z, null) }))
    .filter((z) => z.min !== null)
    .sort((a, b) => a.min - b.min);

/** Welches Fach ist an diesem Tag in welcher Stunde? (fest pro Datum) */
function fachFuer(dateKey, slot) {
  const tage = Math.floor(Date.parse(`${dateKey}T12:00:00Z`) / (24 * 60 * MIN));
  return FACH_KEYS[(tage * zeiten().length + slot) % FACH_KEYS.length];
}

function stundenplanEmbed() {
  const t = localNow(config.spass.zeitzone);
  const tage = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  const zeilen = [];
  for (let d = 1; d <= 5; d++) {
    const diff = d - t.weekday;
    const datum = new Date(Date.parse(`${t.date}T12:00:00Z`) + diff * 24 * 60 * MIN).toISOString().slice(0, 10);
    const stunden = zeiten().map((z, i) => `${z.text} ${FAECHER[fachFuer(datum, i)].emoji} ${FAECHER[fachFuer(datum, i)].name}`);
    zeilen.push(`${d === t.weekday ? '👉 ' : ''}**${tage[d - 1]}:** ${stunden.join(' · ') || '–'}`);
  }
  return new EmbedBuilder()
    .setColor(0x1f4d3a)
    .setTitle('🗓️ Stundenplan dieser Woche')
    .setDescription(`${zeilen.join('\n')}\n\nJede Stunde dauert ${ABLAUF.ende / MIN} Minuten. Sa/So: schulfrei (Willy putzt).`)
    .setFooter({ text: 'Änderungen vorbehalten. Vor allem durch den Vertretungsplan.' });
}

async function tick(guild) {
  if (!istEingerichtet(guild)) return;
  const s = schule(guild.id);
  await lehrerZugang(guild);
  // Nachsitzen abgelaufen?
  for (const [userId, n] of Object.entries(s.nachsitzen)) {
    if (Date.now() >= n.bis) await entlassen(guild, userId, 'wurde nach 15 Minuten entlassen. Strafarbeit unvollständig, aber Willy hat Feierabend.');
  }
  // Wahl vorbei?
  if (s.wahl && Date.now() >= s.wahl.endetAm) await wahlAuswerten(guild);
  // Unterricht nach Stundenplan
  if (!automatikAn(guild.id, 'unterricht') || lessons.has(guild.id)) return;
  const t = localNow(config.spass.zeitzone);
  if (t.weekday > 5) return;
  zeiten().forEach((z, i) => {
    const key = `${t.date}#${i}`;
    if (t.minutes >= z.min && t.minutes < z.min + 5 && !s.gestartet[key]) {
      s.gestartet[key] = true;
      for (const k of Object.keys(s.gestartet)) if (!k.startsWith(t.date)) delete s.gestartet[k];
      save();
      stundeStarten(guild, fachFuer(t.date, i), i + 1).catch((err) => logError('schule:start', err));
    }
  });
}

export function initSchule(client) {
  setInterval(() => {
    for (const guild of client.guilds.cache.values()) tick(guild).catch((err) => logError('schule:tick', err));
  }, 30_000);
}

// ---------------------------------------------------------------------------
// Befehle
// ---------------------------------------------------------------------------
export const SCHUL_COMMANDS = ['schule', 'stundenplan', 'unterricht', 'noten', 'klassenbuch', 'klassensprecher'];

export async function handleSchulCommand(interaction) {
  const ephemeral = { flags: MessageFlags.Ephemeral };
  const guild = interaction.guild;
  const s = schule(guild.id);
  const sub = interaction.options.getSubcommand(false);

  switch (interaction.commandName) {
    case 'schule': {
      if (sub === 'lehrer') {
        const zeilen = [];
        for (const [fach, f] of Object.entries(FAECHER)) {
          const bot = lehrerBot(fach);
          let status;
          if (bot) {
            const drin = await guild.members.fetch(bot.user.id).catch(() => null);
            status = drin ? `✅ eigener Bot (${bot.user.tag})` : `📨 Bot läuft, aber noch nicht eingeladen: [Einladen](${einladungslink(bot.user.id)})`;
          } else if (tokenFuer(fach)) {
            status = '⚠️ Token eingetragen, Bot startet nicht (Token prüfen)';
          } else {
            status = `🪝 Webhook (für einen eigenen Bot: \`LEHRER_${fach.toUpperCase()}_TOKEN\` in die .env)`;
          }
          zeilen.push(`${f.emoji} **${f.lehrer}** (${f.name}): ${status}`);
        }
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x1f4d3a).setTitle('👩‍🏫 Das Kollegium').setDescription(zeilen.join('\n'))],
          ...ephemeral,
        });
      }
      await interaction.deferReply(ephemeral);
      const log = await schulAbgleich(guild);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🏫 Schule eingerichtet').setDescription(log.join('\n'))] });
    }

    case 'stundenplan':
      return interaction.reply({ embeds: [stundenplanEmbed()] });

    case 'unterricht': {
      if (sub === 'beenden') return interaction.reply({ content: await stundeBeenden(guild, true), ...ephemeral });
      await interaction.deferReply(ephemeral);
      const fach = interaction.options.getString('fach') ?? pick(FACH_KEYS);
      return interaction.editReply(await stundeStarten(guild, fach));
    }

    case 'noten': {
      const member = interaction.options.getMember('nutzer') ?? interaction.member;
      const echt = echteNoten(guild.id, member.id);
      const embed = new EmbedBuilder().setColor(0x3498db).setTitle(`📊 Noten: ${member.displayName}`);
      if (!echt) return interaction.reply({ embeds: [embed.setDescription('Noch keine Noten. Erst mal zum Unterricht kommen! (`/stundenplan`)')], allowedMentions: NO_PINGS });
      const zeilen = echt.noten.map(
        (n) => `• **${n.fach}:** ${n.text} (${n.wort}) · ${n.stats.anwesend}x da${n.stats.zuspaet ? `, ${n.stats.zuspaet}x zu spät` : ''}, ${n.stats.punkte} Quiz-Punkte, ${n.stats.mitarbeit} Mitarbeit`,
      );
      const schnitt = (echt.noten.reduce((a, n) => a + n.value, 0) / echt.noten.length).toFixed(1).replace('.', ',');
      return interaction.reply({
        embeds: [
          embed.setDescription(
            `${zeilen.join('\n')}\n\n**Durchschnitt:** ${schnitt}\n**Fehlstunden:** ${echt.fehlstunden} · **Klassenbuch-Einträge:** ${echt.eintraege}\n\n_Das Zeugnis mit diesen Noten gibt es mit \`/zeugnis\`._`,
          ),
        ],
        allowedMentions: NO_PINGS,
      });
    }

    case 'klassenbuch': {
      if (sub === 'eintrag') {
        if (!interaction.memberPermissions?.has(P.ManageMessages)) return interaction.reply({ content: 'Einträge machen nur Lehrkräfte (also das Team).', ...ephemeral });
        const user = interaction.options.getUser('nutzer', true);
        await klassenbuchEintrag(guild, user.id, interaction.options.getString('grund', true));
        return interaction.reply({ content: `📕 Eingetragen: ${user}.`, allowedMentions: NO_PINGS, ...ephemeral });
      }
      const user = interaction.options.getUser('nutzer');
      const liste = s.klassenbuch.filter((e) => !user || e.userId === user.id).slice(-12).reverse();
      const text = liste.map((e) => `• <t:${Math.floor(e.datum / 1000)}:d> <@${e.userId}>: ${e.grund}`).join('\n') || '_Keine Einträge. Verdächtig brav._';
      return interaction.reply({ content: `📕 **Klassenbuch${user ? ` – ${user.username}` : ''}:**\n${text}`, allowedMentions: NO_PINGS });
    }

    case 'klassensprecher': {
      await interaction.deferReply(ephemeral);
      if (sub === 'wahl') return interaction.editReply(s.wahl ? 'Es läuft schon eine Wahl.' : await wahlStarten(interaction));
      return interaction.editReply(await wahlAuswerten(guild));
    }

    default:
      return interaction.reply({ content: 'Hä?', ...ephemeral });
  }
}

// Zum Testen: laufende Stunde von außen sehen
export const _lessons = lessons;
