// /tafel: Willy schreibt deinen Text mit Kreide an eine Tafel (als Bild) und wischt sie nach einer Stunde weg.
// Wer geschrieben hat, steht klein unten auf der Tafel und im Protokoll der Polizeiwache.
// Wegwischen dürfen: wer geschrieben hat, das Team und Willy (automatisch nach 1 Stunde, auch nach Neustart).
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, PermissionFlagsBits as P, escapeMarkdown } from 'discord.js';
import { config } from '../config.js';
import { guildState, save } from '../storage.js';
import { chance, localNow, logError, pick, seededRng, truncate } from '../util.js';
import { zaehle } from '../chronik.js';
import { SERIOUS_CHAT_REPLY, SERIOUS_WORDS } from '../ernst.js';
import { canvasLaden } from './leinwand.js';
import { findChannel } from './roles.js';

const NO_PINGS = { parse: [] };
const ephemeral = { flags: MessageFlags.Ephemeral };
const MIN = 60_000;
const STEHEN_LASSEN = 60 * MIN;
const W = 1200;
const H = 700;

export const KREIDE = {
  weiss: { name: 'Weiß', farbe: '#f4f4ee' },
  gelb: { name: 'Gelb', farbe: '#f7e26b' },
  rosa: { name: 'Rosa', farbe: '#f5a8c8' },
  blau: { name: 'Blau', farbe: '#a6d8f7' },
  gruen: { name: 'Grün (sieht man kaum)', farbe: '#4f7a5c' },
};

// Herr Kommasetzung korrigiert mit roter Kreide
const KORREKTUREN = [
  [/\bstandart\b/i, 'Standard'],
  [/\bnähmlich\b/i, 'nämlich'],
  [/\bwiederrum\b/i, 'wiederum'],
  [/\bgarnicht\b/i, 'gar nicht'],
  [/\bvorraus\b/i, 'voraus'],
  [/\brythmus\b/i, 'Rhythmus'],
  [/\bseperat\b/i, 'separat'],
  [/\bpacket\b/i, 'Paket'],
  [/\bweis nicht\b/i, 'weiß nicht'],
  [/\bentgültig\b/i, 'endgültig'],
  [/\bstandartmäßig\b/i, 'standardmäßig'],
  [/\bdaß\b/i, 'dass'],
];

export function korrektur(text) {
  for (const [re, richtig] of KORREKTUREN) if (re.test(text)) return richtig;
  return null;
}

const KRITZELEIEN = ['Keine Gänse!', '1 + 1 = 2', 'Heinz war hier', 'Nicht wegwischen!!', 'Hausaufgabe: keine', 'π ≈ 3', 'Willy ist der Beste'];

/** Nutzertext bereinigen: keine Erwähnungen, eine Zeile pro Zeile, kurz. */
const sauber = (text) =>
  truncate(
    text
      .replace(/<[@#][!&]?\d+>/g, '[jemand]')
      .replace(/@(everyone|here)/gi, '[alle]')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    200,
  );

/** Zeilen umbrechen, sodass alles in die Breite passt. Sehr lange Wörter werden zerteilt. */
function umbrechen(ctx, text, breite) {
  const zeilen = [];
  for (const absatz of text.split('\n')) {
    let zeile = '';
    for (let wort of absatz.split(' ')) {
      while (ctx.measureText(wort).width > breite) {
        let n = wort.length - 1;
        while (n > 1 && ctx.measureText(wort.slice(0, n)).width > breite) n--;
        if (zeile) zeilen.push(zeile);
        zeilen.push(wort.slice(0, n));
        zeile = '';
        wort = wort.slice(n);
      }
      const probe = zeile ? `${zeile} ${wort}` : wort;
      if (ctx.measureText(probe).width <= breite) zeile = probe;
      else {
        zeilen.push(zeile);
        zeile = wort;
      }
    }
    zeilen.push(zeile);
  }
  return zeilen;
}

/** Text mit Kreide-Effekt (mehrmals leicht versetzt, etwas durchscheinend). */
function kreideText(ctx, text, x, y, farbe, rng, deckkraft = 1) {
  ctx.fillStyle = farbe;
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = (i === 0 ? 0.8 : 0.3) * deckkraft;
    ctx.fillText(text, x + (rng() - 0.5) * 2.4, y + (rng() - 0.5) * 2.4);
  }
  ctx.globalAlpha = 1;
}

function tafelGrund(ctx, rng) {
  // Rahmen
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#5e3d22';
  ctx.fillRect(0, H - 46, W, 46);
  // Tafelfläche
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2f5240');
  g.addColorStop(1, '#264435');
  ctx.fillStyle = g;
  ctx.fillRect(28, 28, W - 56, H - 96);
  // Alte Wischspuren (nur auf der Tafel)
  ctx.save();
  ctx.beginPath();
  ctx.rect(28, 28, W - 56, H - 96);
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.012 + rng() * 0.018})`;
    ctx.lineWidth = 50 + rng() * 60;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const x = 80 + rng() * (W - 160);
    const y = 80 + rng() * (H - 220);
    ctx.arc(x, y, 80 + rng() * 140, rng() * 6, rng() * 6 + 1.5);
    ctx.stroke();
  }
  ctx.restore();
  // Kreidestaub
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rng() * 0.08})`;
    ctx.fillRect(28 + rng() * (W - 56), 28 + rng() * (H - 96), 2, 2);
  }
  // Ablage mit Kreide und Schwamm
  ctx.fillStyle = '#8b5e3c';
  ctx.fillRect(20, H - 54, W - 40, 14);
  for (const [x, farbe] of [[180, '#f4f4ee'], [230, '#f7e26b'], [262, '#f5a8c8']]) {
    ctx.fillStyle = farbe;
    ctx.fillRect(x, H - 64, 36, 10);
  }
  ctx.fillStyle = '#e1b12c';
  ctx.fillRect(W - 300, H - 72, 90, 22);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(W - 300, H - 56, 90, 6);
}

/**
 * Malt die Tafel. gewischt = Willy hat gewischt (nur noch Schlieren). Gibt einen PNG-Buffer zurück
 * oder null, wenn @napi-rs/canvas fehlt.
 */
export async function tafelBild({ text, autor, farbe = 'weiss', datum, gewischt = false, seed = text }) {
  const c = await canvasLaden();
  if (!c) return null;
  const rng = seededRng(`tafel:${seed}`);
  const canvas = c.createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  tafelGrund(ctx, rng);
  const kreide = (KREIDE[farbe] ?? KREIDE.weiss).farbe;
  ctx.textBaseline = 'middle';

  // Datum oben rechts, Kritzelei oben links
  ctx.font = '34px Kreide';
  ctx.textAlign = 'right';
  const tag = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${datum}T12:00:00Z`));
  kreideText(ctx, tag, W - 60, 66, '#f4f4ee', rng, 0.7);
  ctx.textAlign = 'left';
  kreideText(ctx, KRITZELEIEN[Math.floor(rng() * KRITZELEIEN.length)], 60, 66, '#f4f4ee', rng, 0.45);

  // Haupttext: so groß wie möglich
  const breite = W - 200;
  let groesse = 96;
  let zeilen;
  for (; groesse >= 40; groesse -= 4) {
    ctx.font = `${groesse}px Kreide`;
    zeilen = umbrechen(ctx, text, breite);
    if (zeilen.length * groesse * 1.1 <= H - 260) break;
  }
  ctx.font = `${groesse}px Kreide`;
  const hoehe = zeilen.length * groesse * 1.1;
  const startY = 100 + (H - 260 - hoehe) / 2 + groesse * 0.55;
  ctx.textAlign = 'center';
  zeilen.forEach((z, i) => {
    ctx.save();
    const y = startY + i * groesse * 1.1;
    ctx.translate(W / 2, y);
    ctx.rotate((rng() - 0.5) * 0.04);
    if (gewischt) {
      // nur noch Schlieren
      for (let k = 0; k < 5; k++) kreideText(ctx, z, (rng() - 0.5) * 50, (rng() - 0.5) * 24, kreide, rng, 0.025);
    } else {
      kreideText(ctx, z, 0, 0, kreide, rng);
    }
    ctx.restore();
  });

  ctx.textAlign = 'right';
  ctx.font = '34px Kreide';
  if (gewischt) {
    // große Wischbögen
    ctx.save();
    ctx.beginPath();
    ctx.rect(28, 28, W - 56, H - 96);
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 90;
      ctx.beginPath();
      ctx.arc(W / 2 + (rng() - 0.5) * 600, H / 2 + (rng() - 0.5) * 200, 220 + rng() * 120, rng() * 6, rng() * 6 + 1.2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.font = '44px Kreide';
    kreideText(ctx, 'Gewischt. – Willy (Hausmeister)', W / 2, H - 110, '#f4f4ee', rng, 0.8);
  } else {
    kreideText(ctx, `– ${truncate(autor, 30)}`, W - 70, H - 100, '#f4f4ee', rng, 0.75);
    const richtig = korrektur(text);
    if (richtig) {
      ctx.textAlign = 'left';
      ctx.font = '36px Kreide';
      kreideText(ctx, `Es heißt „${richtig}“! – Hr. Kommasetzung`, 60, H - 100, '#ff6b6b', rng, 0.95);
    }
  }
  return canvas.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
function tafelState(guildId) {
  const g = guildState(guildId);
  g.tafel ??= {};
  g.tafel.naechste ??= 1;
  g.tafel.aktiv ??= []; // { nr, channelId, messageId, autorId, autor, text, farbe, datum, bis }
  return g.tafel;
}

const wischKnopf = (nr) =>
  new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`tafel:wischen:${nr}`).setLabel('🧽 Wegwischen').setStyle(ButtonStyle.Secondary));

/** Tafel wischen: Nachricht bekommt das gewischte Bild, Eintrag fliegt raus. */
async function wischen(guild, eintrag, { interaction = null, wer = 'Willy' } = {}) {
  const t = tafelState(guild.id);
  t.aktiv = t.aktiv.filter((e) => e.nr !== eintrag.nr);
  save();
  const png = await tafelBild({ ...eintrag, gewischt: true, seed: `${eintrag.nr}:${eintrag.text}` });
  const payload = {
    content: `🧽 Die Tafel wurde gewischt (von ${escapeMarkdown(wer)}).`,
    files: png ? [new AttachmentBuilder(png, { name: 'tafel.png' })] : [],
    attachments: [],
    components: [],
    allowedMentions: NO_PINGS,
  };
  if (interaction) return interaction.update(payload);
  const channel = guild.channels.cache.get(eintrag.channelId);
  if (!channel?.messages) return null;
  return channel.messages.edit(eintrag.messageId, payload).catch((err) => logError('tafel:wischen', err));
}

/** Fällige Tafeln wischen (jede Minute, auch nach Neustart). */
export async function tafelTick(guild, now = Date.now()) {
  const faellig = tafelState(guild.id).aktiv.filter((e) => e.bis <= now);
  for (const e of faellig) await wischen(guild, e).catch((err) => logError('tafel:tick', err));
}

export function initTafel(client) {
  const tick = async () => {
    for (const guild of client.guilds.cache.values()) await tafelTick(guild).catch((err) => logError('tafel', err));
  };
  setInterval(tick, MIN);
  tick();
}

const cooldown = new Map(); // userId -> Zeitstempel

async function schreiben(interaction) {
  const guild = interaction.guild;
  const roh = interaction.options.getString('text', true);
  if (SERIOUS_WORDS.test(roh)) return interaction.reply({ content: SERIOUS_CHAT_REPLY, ...ephemeral });
  const text = sauber(roh.replace(/\\n/g, '\n'));
  if (!text) return interaction.reply({ content: 'Leere Tafel? Das ist Kunst. Aber nicht hier.', ...ephemeral });
  const warten = (cooldown.get(interaction.user.id) ?? 0) + 2 * MIN - Date.now();
  if (warten > 0) return interaction.reply({ content: `✏️ Die Kreide ist noch warm. Nochmal in ${Math.ceil(warten / 1000)} Sekunden.`, ...ephemeral });
  const channel = interaction.channel;
  if (!channel?.send) return interaction.reply({ content: 'Hier hängt keine Tafel.', ...ephemeral });

  cooldown.set(interaction.user.id, Date.now());
  await interaction.deferReply(ephemeral);
  const t = tafelState(guild.id);
  const autor = interaction.member?.displayName ?? interaction.user.username;
  const farbe = interaction.options.getString('farbe') ?? 'weiss';
  const eintrag = {
    nr: t.naechste++,
    channelId: channel.id,
    autorId: interaction.user.id,
    autor,
    text,
    farbe,
    datum: localNow(config.spass.zeitzone).date,
    // Ganz selten wischt Willy viel zu früh
    bis: Date.now() + (chance(0.04) ? 2 * MIN : STEHEN_LASSEN),
  };
  const png = await tafelBild({ ...eintrag, seed: `${eintrag.nr}:${text}` });
  if (!png) return interaction.editReply('🖍️ Die Kreide fehlt (Paket `@napi-rs/canvas` ist nicht installiert). Einmal `npm install` und neu starten.');

  const msg = await channel.send({
    content: `✏️ **${escapeMarkdown(truncate(autor, 80))}** hat an die Tafel geschrieben. Willy wischt sie <t:${Math.floor(eintrag.bis / 1000)}:R> weg.`,
    files: [new AttachmentBuilder(png, { name: 'tafel.png' })],
    components: [wischKnopf(eintrag.nr)],
    allowedMentions: NO_PINGS,
  });
  eintrag.messageId = msg.id;
  t.aktiv.push(eintrag);
  if (t.aktiv.length > 30) {
    for (const alt of t.aktiv.slice(0, t.aktiv.length - 30)) await wischen(guild, alt).catch(() => {});
  }
  save();
  zaehle(guild.id, 'tafel');

  // Protokoll für das Team (wer hat was geschrieben)
  const log = findChannel(guild, 'modlog');
  if (log?.isTextBased?.()) {
    await log
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2f5240)
            .setTitle('🖍️ Tafel-Protokoll')
            .setDescription(`<@${interaction.user.id}> in <#${channel.id}>:\n>>> ${truncate(text, 1000)}`)
            .setFooter({ text: `Tafel Nr. ${eintrag.nr} · Wegwischen: Knopf unter der Tafel` }),
        ],
        allowedMentions: NO_PINGS,
      })
      .catch(() => {});
  }
  return interaction.editReply(pick(['✅ Steht an der Tafel.', '✅ Angeschrieben. Die Kreide hat gequietscht.', '✅ Fertig. Nicht wegwischen. (Wird trotzdem gewischt.)']));
}

/** Knopf "Wegwischen" (tafel:wischen:<nr>) */
export async function handleTafel(interaction, action, nr) {
  const t = tafelState(interaction.guildId);
  const eintrag = t.aktiv.find((e) => String(e.nr) === nr);
  if (!eintrag) return interaction.reply({ content: 'Die Tafel ist schon gewischt.', ...ephemeral });
  const darf = interaction.user.id === eintrag.autorId || interaction.memberPermissions?.has(P.ManageMessages);
  if (!darf) return interaction.reply({ content: '🧽 Wischen dürfen nur, wer geschrieben hat, das Team und Willy. Du darfst den Schwamm aber halten.', ...ephemeral });
  const wer = interaction.member?.displayName ?? interaction.user.username;
  return wischen(interaction.guild, eintrag, { interaction, wer: truncate(wer, 80) });
}

/** /tafel schreiben | wischen */
export async function handleTafelCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'schreiben') return schreiben(interaction);
  // wischen: alle Tafeln in diesem Kanal (Team) bzw. die eigenen
  const t = tafelState(interaction.guildId);
  const team = interaction.memberPermissions?.has(P.ManageMessages);
  const ziele = t.aktiv.filter((e) => e.channelId === interaction.channelId && (team || e.autorId === interaction.user.id));
  if (!ziele.length) return interaction.reply({ content: 'Hier gibt es nichts zu wischen (jedenfalls nichts, was du wischen darfst).', ...ephemeral });
  await interaction.deferReply(ephemeral);
  const wer = truncate(interaction.member?.displayName ?? interaction.user.username, 80);
  for (const e of ziele) await wischen(interaction.guild, e, { wer });
  return interaction.editReply(`🧽 ${ziele.length} Tafel${ziele.length > 1 ? 'n' : ''} gewischt.`);
}
