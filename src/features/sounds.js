// Willys eigene Soundboard-Sounds (erzeugt mit scripts/make-sounds.py) und das Hochladen auf den Server.
import fs from 'node:fs';
import path from 'node:path';
import { EmbedBuilder, GuildPremiumTier, MessageFlags } from 'discord.js';
import { logError } from '../util.js';

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

/**
 * Lädt alle fehlenden Sounds hoch, soweit Plätze frei sind. Gibt Textzeilen fürs Protokoll zurück.
 * replace: Willys Sounds, die schon da sind, vorher löschen (z. B. nach einem Update der Sounds).
 */
export async function uploadSounds(guild, { replace = false } = {}) {
  let existing = await guild.soundboardSounds.fetch();
  if (replace) {
    const ours = new Set(SOUNDS.map((s) => s.name.toLowerCase()));
    for (const sound of existing.values()) {
      if (ours.has(sound.name.toLowerCase())) await sound.delete('Willys Sounds werden ersetzt').catch((err) => logError('sounds:delete', err));
    }
    existing = await guild.soundboardSounds.fetch();
  }
  const names = new Set(existing.map((s) => s.name.toLowerCase()));
  const limit = LIMITS[guild.premiumTier] ?? 8;
  let free = limit - existing.size;
  const uploaded = [];
  const already = [];
  const noSpace = [];
  const failed = [];

  for (const s of SOUNDS) {
    if (names.has(s.name.toLowerCase())) {
      already.push(s);
      continue;
    }
    if (free <= 0) {
      noSpace.push(s);
      continue;
    }
    try {
      await guild.soundboardSounds.create({
        file: fs.readFileSync(path.join(DIR, s.file)),
        contentType: 'audio/mpeg',
        name: s.name,
        volume: s.volume,
        emojiName: s.emoji,
        reason: 'Willys Sounds',
      });
      uploaded.push(s);
      free--;
    } catch (err) {
      logError(`sounds:${s.name}`, err);
      failed.push(`${s.emoji} ${s.name} (${err.message})`);
    }
  }

  const fmt = (list) => list.map((s) => `${s.emoji} ${s.name}`).join(', ');
  const lines = [];
  if (uploaded.length) lines.push(`🔊 Hochgeladen: ${fmt(uploaded)}`);
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

  // liste
  const sounds = await guild.soundboardSounds.fetch();
  const list = sounds.map((s) => `${s.emoji ?? '🔈'} ${s.name}`).join('\n') || '_Keine eigenen Sounds. Mach `/sounds hochladen`._';
  return interaction.reply({
    content: `🎵 **Soundboard dieses Servers (${sounds.size}/${LIMITS[guild.premiumTier] ?? 8}):**\n${list}`,
    flags: MessageFlags.Ephemeral,
  });
}
