// Hausmeisterei: Reparaturaufträge (/reparatur) und Fundbüro (/fundbuero).
// Willy "repariert" etwas und macht dabei manchmal etwas anderes kaputt. Echte Änderungen sind harmlos
// (kurzer Slowmode, Kanalbeschreibung, Willys Spitzname) und werden nach kurzer Zeit automatisch rückgängig gemacht,
// auch nach einem Neustart.
import { ChannelType, EmbedBuilder, MessageFlags, escapeMarkdown } from 'discord.js';
import { guildState, save } from '../storage.js';
import { chance, logError, pick, randInt, truncate } from '../util.js';
import { merke, zaehle } from '../chronik.js';
import { SERIOUS_CHAT_REPLY, SERIOUS_WORDS } from '../ernst.js';

const NO_PINGS = { parse: [] };
const ephemeral = { flags: MessageFlags.Ephemeral };
const MIN = 60_000;

/** Nutzertext bereinigen: keine Erwähnungen, kein Markdown-Chaos, kurz. */
const sauber = (text, max) => truncate(escapeMarkdown(text.replace(/<[@#][!&]?\d+>/g, '[jemand]').replace(/@(everyone|here)/gi, '[alle]').replace(/\s+/g, ' ').trim()), max);

function werkstatt(guildId) {
  const g = guildState(guildId);
  g.werkstatt ??= {};
  const w = g.werkstatt;
  w.auftraege ??= 0;
  w.rueckgaengig ??= []; // { art, channelId, wert, um }
  w.fund ??= { naechste: 1, sachen: [] };
  return w;
}

// ---------------------------------------------------------------------------
// Reparatur
// ---------------------------------------------------------------------------
const WERKZEUG = ['Besen', 'Klebeband', 'ein Löffel', 'gutes Zureden', 'Hammer (zu groß)', 'Panzertape', 'ein Kaugummi', 'die Bedienungsanleitung (unbenutzt)'];
const DAUER = ['3–5 Werktage', '2 Minuten oder 2 Jahre', 'bis nach den Ferien', 'kommt drauf an', 'gestern (zu spät)'];
const ERGEBNIS = [
  'Repariert. Glaube ich.',
  'Repariert. Es macht jetzt ein Geräusch, aber es geht.',
  'Repariert, aber falschrum. Funktioniert trotzdem.',
  'Nicht repariert, aber ich habe drüber gewischt. Sieht jetzt besser aus.',
  'Ich habe es aus- und wieder eingeschaltet. Das zählt.',
  'Es war gar nicht kaputt. Es war nur beleidigt.',
];
// Nur Text, nichts passiert wirklich
const NUR_TEXT = [
  'Dabei ist die Kaffeemaschine im Lehrerzimmer explodiert. Schon wieder.',
  'Dabei ist mir eine Schraube übrig geblieben. Ich weiß nicht, wo sie hingehört.',
  'Dabei habe ich versehentlich das WLAN in den Keller verlegt.',
  'Dabei ist Heinz der Kaktus umgefallen. Er nimmt es gelassen.',
  'Dabei habe ich den Ladebalken auf 98 % zurückgedreht. Tut mir leid.',
  'Dabei ist die Schulglocke jetzt eine Oktave höher. Frau Dur-Moll ist begeistert.',
  'Dabei habe ich ein Loch in die Wand gebohrt. Durch das Loch sieht man die Turnhalle.',
];

/** Echte, harmlose Nebenwirkungen. Jede gibt einen Text zurück oder null, wenn es gerade nicht geht. */
const NEBENWIRKUNGEN = [
  {
    name: 'slowmode',
    async machen(guild, channel, w) {
      if (!channel?.setRateLimitPerUser || channel.rateLimitPerUser > 0 || w.rueckgaengig.some((r) => r.channelId === channel.id)) return null;
      await channel.setRateLimitPerUser(10, 'Reparatur (dauert 5 Minuten)');
      w.rueckgaengig.push({ art: 'slowmode', channelId: channel.id, wert: 0, um: Date.now() + 5 * MIN });
      return 'Dabei habe ich die Tastatur geölt. Hier geht jetzt 5 Minuten alles etwas langsamer (10 s Slowmode).';
    },
  },
  {
    name: 'thema',
    async machen(guild, channel, w) {
      if (!channel?.setTopic || w.rueckgaengig.some((r) => r.channelId === channel.id)) return null;
      w.rueckgaengig.push({ art: 'thema', channelId: channel.id, wert: channel.topic ?? '', um: Date.now() + 30 * MIN });
      save();
      await channel.setTopic('🔧 Wegen Reparatur geschlossen. (Ist nicht geschlossen. Einfach weiterschreiben.)', 'Reparatur');
      return 'Dabei ist das Schild an der Tür kaputt gegangen. Die Kanalbeschreibung ist jetzt 30 Minuten etwas komisch.';
    },
  },
  {
    name: 'spitzname',
    async machen(guild, channel, w) {
      const me = guild.members.me;
      if (!me?.setNickname || w.rueckgaengig.some((r) => r.art === 'spitzname')) return null;
      w.rueckgaengig.push({ art: 'spitzname', wert: me.nickname ?? null, um: Date.now() + 30 * MIN });
      save();
      await me.setNickname('🩹 Hausmeister Willy (verletzt)', 'Reparatur');
      return 'Dabei habe ich mir mit dem Hammer auf den Daumen gehauen. Ich heiße jetzt 30 Minuten anders.';
    },
  },
];

async function rueckgaengigMachen(guild, r) {
  if (r.art === 'spitzname') return guild.members.me?.setNickname(r.wert, 'Reparatur vorbei');
  const ch = guild.channels.cache.get(r.channelId);
  if (!ch) return null;
  if (r.art === 'slowmode') return ch.setRateLimitPerUser(r.wert, 'Reparatur vorbei');
  if (r.art === 'thema') return ch.setTopic(r.wert || null, 'Reparatur vorbei');
  return null;
}

/** Fällige Nebenwirkungen zurücknehmen (läuft jede Minute und nach dem Start). */
export async function werkstattTick(guild, now = Date.now()) {
  const w = werkstatt(guild.id);
  const faellig = w.rueckgaengig.filter((r) => r.um <= now);
  if (!faellig.length) return;
  w.rueckgaengig = w.rueckgaengig.filter((r) => r.um > now);
  save();
  for (const r of faellig) await Promise.resolve(rueckgaengigMachen(guild, r)).catch((err) => logError('werkstatt:zurueck', err));
}

export function initWerkstatt(client) {
  const tick = async () => {
    for (const guild of client.guilds.cache.values()) await werkstattTick(guild).catch((err) => logError('werkstatt', err));
  };
  setInterval(tick, MIN);
  tick();
}

const cooldown = new Map(); // userId -> Zeitstempel

/** Der Bericht nach der "Reparatur". Gibt das Embed zurück. */
export async function reparieren(guild, channel, auftrag, nr) {
  const w = werkstatt(guild.id);
  let nebenwirkung = null;
  if (chance(0.35)) {
    for (const n of [...NEBENWIRKUNGEN].sort(() => Math.random() - 0.5)) {
      try {
        nebenwirkung = await n.machen(guild, channel, w);
      } catch (err) {
        logError(`werkstatt:${n.name}`, err);
      }
      if (nebenwirkung) break;
    }
    save();
  }
  zaehle(guild.id, 'reparaturen');
  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`🔧 Reparaturbericht REP-${String(nr).padStart(4, '0')}`)
    .addFields(
      { name: 'Auftrag', value: auftrag },
      { name: 'Ergebnis', value: pick(ERGEBNIS) },
      { name: '⚠️ Nebenwirkungen', value: nebenwirkung ?? pick(NUR_TEXT) },
      { name: 'Rechnung', value: `${randInt(2, 9)} Socken (zahlbar bei Willy)`, inline: true },
      { name: 'Garantie', value: 'bis eben', inline: true },
    )
    .setFooter({ text: 'Hausmeisterei Willy · Wir reparieren alles. Irgendwie.' });
}

async function handleReparatur(interaction) {
  const text = interaction.options.getString('was', true);
  if (SERIOUS_WORDS.test(text)) return interaction.reply({ content: SERIOUS_CHAT_REPLY, ...ephemeral });
  const warten = (cooldown.get(interaction.user.id) ?? 0) + 10 * MIN - Date.now();
  if (warten > 0) return interaction.reply({ content: `🧰 Willy repariert noch dein letztes Ding. Neuer Auftrag in ${Math.ceil(warten / MIN)} Minuten.`, ...ephemeral });
  cooldown.set(interaction.user.id, Date.now());

  const w = werkstatt(interaction.guildId);
  const nr = ++w.auftraege;
  save();
  const auftrag = sauber(text, 200) || 'irgendwas';
  const minuten = randInt(1, 2);
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle(`📋 Auftrag REP-${String(nr).padStart(4, '0')} angenommen`)
        .setDescription(`**Was:** ${auftrag}\n**Werkzeug:** ${pick(WERKZEUG)}\n**Geschätzte Dauer:** ${pick(DAUER)} (in Wahrheit ca. ${minuten} Minute${minuten > 1 ? 'n' : ''})`)
        .setFooter({ text: 'Bitte nicht nachfragen. Willy arbeitet. Wirklich.' }),
    ],
    allowedMentions: NO_PINGS,
  });

  const channel = interaction.channel;
  setTimeout(async () => {
    try {
      const embed = await reparieren(interaction.guild, channel?.type === ChannelType.GuildText ? channel : null, auftrag, nr);
      await channel?.send({ content: `<@${interaction.user.id}> dein Auftrag ist fertig.`, embeds: [embed], allowedMentions: { users: [interaction.user.id] } });
    } catch (err) {
      logError('werkstatt:bericht', err);
    }
  }, minuten * MIN);
}

// ---------------------------------------------------------------------------
// Fundbüro
// ---------------------------------------------------------------------------
// Willys Dauerbestand (kann man nicht abholen)
const DAUERBESTAND = [
  { nr: 'W-1', text: 'Eine Socke (links)' },
  { nr: 'W-2', text: '1 % vom Ladebalken' },
  { nr: 'W-3', text: 'RAM (von RAM Altman, nie zurückgegeben)' },
  { nr: 'W-4', text: 'Der Vordereingang (seit 2009)' },
];
const ABGABE_KOMMENTAR = [
  'Wird sorgfältig aufbewahrt. In einem Karton. Neben dem Müll.',
  'Danke! Ich habe es mit einem Zettel beklebt. Der Zettel ist leer.',
  'Kommt ins Regal. Das Regal ist auch ein Fundstück.',
  'Wurde registriert, fotografiert und dann vergessen.',
];
const WEG = [
  'Oh. Das habe ich leider schon benutzt. Es war sehr praktisch.',
  'Das hat Heinz der Kaktus. Er gibt es nicht her.',
  'Das wurde versteigert. Für eine Socke.',
  'Ich hab es weggeworfen. Aus Versehen. Mit Absicht.',
];

async function handleFundbuero(interaction) {
  const sub = interaction.options.getSubcommand();
  const w = werkstatt(interaction.guildId);
  const fund = w.fund;

  if (sub === 'abgeben') {
    const text = interaction.options.getString('gegenstand', true);
    if (SERIOUS_WORDS.test(text)) return interaction.reply({ content: SERIOUS_CHAT_REPLY, ...ephemeral });
    const gegenstand = sauber(text, 80);
    if (!gegenstand) return interaction.reply({ content: 'Das ist nichts. Nichts nehmen wir nicht an.', ...ephemeral });
    const nr = fund.naechste++;
    fund.sachen.push({ nr, text: gegenstand, von: interaction.user.id, at: Date.now() });
    if (fund.sachen.length > 50) fund.sachen.splice(0, fund.sachen.length - 50);
    save();
    zaehle(interaction.guildId, 'fundsachen');
    merke(interaction.guildId, 'fundsachen', gegenstand);
    return interaction.reply({ content: `🧦 **Fundsache Nr. ${nr}:** ${gegenstand}\n${pick(ABGABE_KOMMENTAR)}`, allowedMentions: NO_PINGS });
  }

  if (sub === 'abholen') {
    const nr = interaction.options.getInteger('nummer', true);
    const i = fund.sachen.findIndex((s) => s.nr === nr);
    if (i < 0) return interaction.reply({ content: `Fundsache Nr. ${nr} gibt es nicht. Oder nicht mehr. Schau mal in \`/fundbuero liste\`.`, ...ephemeral });
    const [sache] = fund.sachen.splice(i, 1);
    save();
    if (sache.von === interaction.user.id) {
      return interaction.reply({ content: `🤨 Du holst deine eigene Fundsache ab? „${sache.text}“. Na gut. Hier.`, allowedMentions: NO_PINGS });
    }
    if (chance(0.3)) return interaction.reply({ content: `📦 Fundsache Nr. ${nr} (${sache.text}): ${pick(WEG)}`, allowedMentions: NO_PINGS });
    return interaction.reply({ content: `✅ Hier bitte: **${sache.text}**. Unterschrift hier, hier und hier. Und einmal hier.`, allowedMentions: NO_PINGS });
  }

  // liste
  const zeilen = [
    ...[...fund.sachen].reverse().slice(0, 15).map((s) => `**Nr. ${s.nr}** · ${s.text} · <t:${Math.floor(s.at / 1000)}:R>`),
    ...DAUERBESTAND.map((s) => `**${s.nr}** · ${s.text} · _gehört jetzt Willy_`),
  ];
  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x8d6e63)
        .setTitle('🧦 Fundbüro der Hausmeisterei')
        .setDescription(truncate(zeilen.join('\n'), 4000))
        .setFooter({ text: 'Abholen mit /fundbuero abholen · Öffnungszeiten: wenn Willy da ist' }),
    ],
    allowedMentions: NO_PINGS,
  });
}

// ---------------------------------------------------------------------------
export const WERKSTATT_COMMANDS = ['reparatur', 'fundbuero'];

export async function handleWerkstattCommand(interaction) {
  if (interaction.commandName === 'reparatur') return handleReparatur(interaction);
  if (interaction.commandName === 'fundbuero') return handleFundbuero(interaction);
  return null;
}

export const _werkstatt = werkstatt;
