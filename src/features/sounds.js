// Willys eigene Soundboard-Sounds (erzeugt mit scripts/make-sounds.py) und das Hochladen auf den Server.
import fs from 'node:fs';
import path from 'node:path';
import { EmbedBuilder, GuildPremiumTier, MessageFlags } from 'discord.js';
import { guildState, save } from '../storage.js';
import { kurzHash, logError } from '../util.js';

const DIR = path.resolve('assets', 'sounds');

// Wichtigste zuerst: Wenn nicht alle Plätze frei sind, kommen die oberen zuerst dran.
export const SOUNDS = [
  { file: 'feueralarm.mp3', name: 'Feueralarm', emoji: '🚨', volume: 0.6 },
  { file: 'schulgong.mp3', name: 'Schulgong', emoji: '🔔', volume: 0.9 },
  { file: 'trommelwirbel.mp3', name: 'Trommelwirbel', emoji: '🥁', volume: 0.9 },
  { file: 'ladebalken.mp3', name: 'Ladebalken 99%', emoji: '⏳', volume: 1 },
  { file: 'ram-geklaut.mp3', name: 'RAM geklaut', emoji: '💾', volume: 0.8 },
  { file: 'captcha-falsch.mp3', name: 'Captcha falsch', emoji: '❌', volume: 0.8 },
  { file: 'besen.mp3', name: 'Willys Besen', emoji: '🧹', volume: 1 },
  { file: 'pausenklingel.mp3', name: 'Pausenklingel', emoji: '⏰', volume: 0.5 },
];

// Soundboard-Plätze je nach Boost-Stufe
const LIMITS = { [GuildPremiumTier.None]: 8, [GuildPremiumTier.Tier1]: 24, [GuildPremiumTier.Tier2]: 36, [GuildPremiumTier.Tier3]: 48 };

const fingerabdruck = new Map(); // Datei -> Hash (Datei + Name + Emoji + Lautstärke)
function soundHash(s) {
  if (!fingerabdruck.has(s.file)) {
    fingerabdruck.set(s.file, kurzHash(Buffer.concat([fs.readFileSync(path.join(DIR, s.file)), Buffer.from(`|${s.name}|${s.emoji}|${s.volume}`)])));
  }
  return fingerabdruck.get(s.file);
}

/**
 * Bringt Willys Sounds auf den neuesten Stand und lädt fehlende hoch, soweit Plätze frei sind.
 * Willy merkt sich pro Sound, welche Version hochgeladen ist. Hat sich ein Sound geändert
 * (neue Datei, Name, Emoji, Lautstärke), wird der alte gelöscht und der neue hochgeladen.
 * replace: alle Sounds von Willy auf jeden Fall neu hochladen. Gibt Textzeilen fürs Protokoll zurück.
 */
export async function uploadSounds(guild, { replace = false } = {}) {
  const g = guildState(guild.id);
  const stand = (g.soundStand ??= {}); // Datei -> { id, hash }
  let existing = await guild.soundboardSounds.fetch();
  const finde = (s) => existing.find((x) => stand[s.file]?.id && x.soundId === stand[s.file].id) ?? existing.find((x) => x.name.toLowerCase() === s.name.toLowerCase());
  // Sounds mit gleichem Namen, die jemand anderes hochgeladen hat, fasst Willy nicht an
  const fremd = (x) => Boolean(x.user && guild.client?.user && x.user.id !== guild.client.user.id);

  // Veraltete Versionen von Willys Sounds entfernen
  const erneuern = new Set();
  let geloescht = false;
  for (const s of SOUNDS) {
    const vorhanden = finde(s);
    if (!vorhanden || fremd(vorhanden)) continue;
    const aktuell = !replace && stand[s.file]?.id === vorhanden.soundId && stand[s.file]?.hash === soundHash(s);
    if (aktuell) continue;
    try {
      await vorhanden.delete(replace ? 'Willys Sounds werden ersetzt' : 'Neue Version');
      erneuern.add(s.file);
      geloescht = true;
    } catch (err) {
      logError('sounds:delete', err);
    }
  }
  // Sounds, die es bei Willy nicht mehr gibt
  for (const [file, st] of Object.entries(stand)) {
    if (SOUNDS.some((s) => s.file === file)) continue;
    const alt = existing.find((x) => x.soundId === st.id);
    if (alt) await alt.delete('Gibt es nicht mehr').catch((err) => logError('sounds:delete', err));
    delete stand[file];
    geloescht = true;
  }
  if (geloescht) {
    save();
    existing = await guild.soundboardSounds.fetch();
  }

  const limit = LIMITS[guild.premiumTier] ?? 8;
  let free = limit - existing.size;
  const uploaded = [];
  const renewed = [];
  const already = [];
  const noSpace = [];
  const failed = [];

  for (const s of SOUNDS) {
    const vorhanden = finde(s);
    if (vorhanden) {
      if (stand[s.file]?.id !== vorhanden.soundId && !fremd(vorhanden)) {
        stand[s.file] = { id: vorhanden.soundId, hash: soundHash(s) }; // gleicher Name, von Willy übernommen
        save();
      }
      already.push(s);
      continue;
    }
    if (free <= 0) {
      noSpace.push(s);
      continue;
    }
    try {
      const sound = await guild.soundboardSounds.create({
        file: fs.readFileSync(path.join(DIR, s.file)),
        contentType: 'audio/mpeg',
        name: s.name,
        volume: s.volume,
        emojiName: s.emoji,
        reason: 'Willys Sounds',
      });
      if (sound?.soundId) stand[s.file] = { id: sound.soundId, hash: soundHash(s) };
      save();
      (erneuern.has(s.file) ? renewed : uploaded).push(s);
      free--;
    } catch (err) {
      logError(`sounds:${s.name}`, err);
      failed.push(`${s.emoji} ${s.name} (${err.message})`);
    }
  }

  const fmt = (list) => list.map((s) => `${s.emoji} ${s.name}`).join(', ');
  const lines = [];
  if (uploaded.length) lines.push(`🔊 Hochgeladen: ${fmt(uploaded)}`);
  if (renewed.length) lines.push(`🔊 Neue Version hochgeladen: ${fmt(renewed)}`);
  if (already.length) lines.push(`✅ Schon da: ${fmt(already)}`);
  if (noSpace.length) {
    lines.push(
      `📦 Kein Platz mehr für: ${fmt(noSpace)} (der Server hat ${limit} Soundboard-Plätze). ` +
        'Lösch alte Sounds in den Servereinstellungen → Soundboard oder boostet den Server, dann nochmal `/sounds hochladen`.',
    );
  }
  if (failed.length) lines.push(`⚠️ Fehlgeschlagen: ${failed.join(', ')}`);
  return lines;
}

/** /sounds hochladen | liste */
export async function handleSoundsCommand(interaction) {
  const guild = interaction.guild;
  const sub = interaction.options.getSubcommand();

  if (sub === 'hochladen') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const lines = await uploadSounds(guild, { replace: interaction.options.getBoolean('ersetzen') ?? false });
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🎵 Willys Sounds').setDescription(lines.join('\n') || 'Nichts zu tun.')],
      });
    } catch (err) {
      logError('sounds', err);
      return interaction.editReply(`Hat nicht geklappt: ${err.message}`);
    }
  }

  // liste (erst "denkt nach…", weil das Abrufen dauern kann)
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const sounds = await guild.soundboardSounds.fetch();
  const list = sounds.map((s) => `${s.emoji ?? '🔈'} ${s.name}`).join('\n') || '_Keine eigenen Sounds. Mach `/sounds hochladen`._';
  return interaction.editReply(`🎵 **Soundboard dieses Servers (${sounds.size}/${LIMITS[guild.premiumTier] ?? 8}):**\n${list}`);
}
