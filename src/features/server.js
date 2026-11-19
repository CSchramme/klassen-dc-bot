// Servername, Server-Logo, Bot-Name und Bot-Avatar ändern (+ Namens-Roulette).
import fs from 'node:fs';
import path from 'node:path';
import { EmbedBuilder, MessageFlags } from 'discord.js';
import { guildState, save } from '../storage.js';
import { logError, pick } from '../util.js';
import { INSIDERS } from '../insider.js';
import { SERVER_NAME } from './layout.js';

const ICON_DIR = path.resolve('assets', 'icons');
const BOT_AVATAR = path.resolve('assets', 'gerd-avatar.png');
const ROULETTE_EVERY_MS = 6 * 60 * 60 * 1000;

const DUMB_NAMES = [
  SERVER_NAME,
  'Klassenchat (der echte) (wirklich)',
  'Klassenchat 2 – Die Rückkehr',
  '🦆 Entenhausen Gesamtschule',
  'Raum 204 (oder 206?)',
  'Hausaufgabenhilfe (keine Hilfe)',
  'Server Final FINAL v3',
  '🧦 Sockenverein e. V.',
  'Gruppe ohne Lehrkraft (mit Bot)',
  'Klasse ??? – Schuljahr ????',
  '📎 Ordner „Neuer Ordner (2)"',
  'Hier könnte Ihre Werbung stehen',
  'Pausenhof Online',
  '⚠️ Bitte nicht umbenennen',
];

export function randomServerName() {
  const insiderNames = INSIDERS.map((i) => `${i.emoji ?? '⭐'} ${i.name} Fanclub`);
  return pick([...DUMB_NAMES, ...insiderNames]).slice(0, 100);
}

export function randomIconFile() {
  const files = fs.readdirSync(ICON_DIR).filter((f) => /\.(png|jpe?g|gif)$/i.test(f));
  return path.join(ICON_DIR, pick(files));
}

export async function setDumbIcon(guild) {
  const file = randomIconFile();
  await guild.setIcon(fs.readFileSync(file), 'Dummes Icon');
  return path.basename(file);
}

/** Alle 6 Stunden zufälliger Servername, wenn /server roulette an ist. */
export function initRoulette(client) {
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      if (!guildState(guild.id).roulette) continue;
      try {
        await guild.setName(randomServerName(), 'Namens-Roulette');
      } catch (err) {
        logError('roulette', err);
      }
    }
  }, ROULETTE_EVERY_MS).unref();
}

function checkImage(attachment) {
  if (!attachment) return null;
  if (!attachment.contentType?.startsWith('image/')) return 'Das ist kein Bild. Das ist ein Datei-förmiges Etwas.';
  if (attachment.size > 10 * 1024 * 1024) return 'Bild ist zu groß (max. 10 MB).';
  return null;
}

const done = (title, text) => ({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle(title).setDescription(text)] });
const fail = (text) => ({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('🙈 Hat nicht geklappt').setDescription(text)] });

/** /server name | icon | zufall | roulette */
export async function handleServerCommand(interaction) {
  const guild = interaction.guild;
  const sub = interaction.options.getSubcommand();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    if (sub === 'name') {
      const name = interaction.options.getString('name', true);
      await guild.setName(name, `Umbenannt von ${interaction.user.username}`);
      return interaction.editReply(done('✏️ Server umbenannt', `Der Server heißt jetzt **${name}**.`));
    }

    if (sub === 'icon') {
      const attachment = interaction.options.getAttachment('bild');
      const problem = checkImage(attachment);
      if (problem) return interaction.editReply(fail(problem));
      if (attachment) {
        await guild.setIcon(attachment.url, `Neues Icon von ${interaction.user.username}`);
        return interaction.editReply(done('🖼️ Neues Server-Logo', 'Dein Bild ist jetzt das Server-Logo. Mutig.'));
      }
      const file = await setDumbIcon(guild);
      return interaction.editReply(done('🖼️ Neues Server-Logo', `Zufälliges dummes Logo gesetzt: \`${file}\``));
    }

    if (sub === 'zufall') {
      const name = randomServerName();
      await guild.setName(name, 'Zufall');
      const file = await setDumbIcon(guild);
      return interaction.editReply(done('🎲 Alles zufällig', `Neuer Name: **${name}**\nNeues Logo: \`${file}\``));
    }

    if (sub === 'roulette') {
      const on = interaction.options.getBoolean('aktiv', true);
      guildState(guild.id).roulette = on;
      save();
      return interaction.editReply(
        done('🎡 Namens-Roulette', on ? 'An. Der Server bekommt alle 6 Stunden einen neuen dummen Namen.' : 'Aus. Der Name bleibt (vorerst).'),
      );
    }
  } catch (err) {
    logError('server-cmd', err);
    return interaction.editReply(fail(`Discord sagt: \`${err.message}\`\n(Habe ich das Recht „Server verwalten"?)`));
  }
}

/** /bot spitzname | avatar | name */
export async function handleBotCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  const client = interaction.client;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    if (sub === 'spitzname') {
      const name = interaction.options.getString('name', true);
      await interaction.guild.members.me.setNickname(name, 'Neuer Spitzname');
      return interaction.editReply(done('🏷️ Neuer Spitzname', `Ich heiße hier jetzt **${name}**.`));
    }

    if (sub === 'avatar') {
      const attachment = interaction.options.getAttachment('bild');
      const problem = checkImage(attachment);
      if (problem) return interaction.editReply(fail(problem));
      await client.user.setAvatar(attachment ? attachment.url : fs.readFileSync(BOT_AVATAR));
      return interaction.editReply(done('🧑‍🎨 Neuer Avatar', attachment ? 'Ich sehe jetzt so aus. Danke. Glaube ich.' : 'Gerd-Avatar gesetzt. Wunderschön.'));
    }

    if (sub === 'name') {
      const name = interaction.options.getString('name', true);
      await client.user.setUsername(name);
      return interaction.editReply(done('🪪 Neuer Bot-Name', `Mein Name ist jetzt **${name}** (überall, nicht nur hier).`));
    }
  } catch (err) {
    logError('bot-cmd', err);
    return interaction.editReply(
      fail(`Discord sagt: \`${err.message}\`\nTipp: Namen und Avatare darf ein Bot nur ein paar Mal pro Stunde ändern.`),
    );
  }
}
