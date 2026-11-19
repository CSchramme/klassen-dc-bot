// /setup: baut den dümmsten Server der Welt auf.
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits as P,
} from 'discord.js';
import { BOT_NICKNAME, LAYOUT, LOTTERY_ROLES, ROLES, SERVER_NAME, TEAM_KODEX } from './layout.js';
import { allRulesMessage, startMessage } from './rules.js';
import { lotteryMessage } from './lottery.js';
import { ticketPanelMessage } from './tickets.js';
import { setDumbIcon } from './server.js';
import { guildState, save } from '../storage.js';
import { logError } from '../util.js';

const pending = new Map(); // userId -> Optionen, während auf die Lösch-Bestätigung gewartet wird

const BOT_ALLOW = [
  P.ViewChannel,
  P.SendMessages,
  P.ReadMessageHistory,
  P.EmbedLinks,
  P.ManageChannels,
  P.ManageMessages,
  P.AddReactions,
  P.Connect,
  P.Speak,
  P.UseSoundboard,
];

/** Baut die Rechte-Überschreibungen für einen Kanal. */
export function overwrites(guild, ids, sicht, nurLesen) {
  const map = new Map();
  const add = (id, allow = [], deny = []) => {
    if (!id) return;
    const o = map.get(id) ?? { id, allow: new Set(), deny: new Set() };
    allow.forEach((p) => o.allow.add(p));
    deny.forEach((p) => o.deny.add(p));
    map.set(id, o);
  };
  const everyone = guild.roles.everyone.id;

  if (sicht === 'unverifiziert') {
    add(everyone, [P.ViewChannel]);
    add(ids.verified, [], [P.ViewChannel]);
  } else if (sicht === 'team') {
    add(everyone, [], [P.ViewChannel]);
    add(ids.team, [P.ViewChannel]);
  } else {
    add(everyone, [], [P.ViewChannel]);
    add(ids.verified, [P.ViewChannel]);
    add(ids.team, [P.ViewChannel]);
  }
  if (nurLesen) for (const id of map.keys()) add(id, [], [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads]);
  add(guild.client.user.id, BOT_ALLOW);

  return [...map.values()].map((o) => ({ id: o.id, allow: [...o.allow], deny: [...o.deny].filter((p) => !o.allow.has(p)) }));
}

async function ensureRole(guild, def, extra = {}) {
  const existing = guild.roles.cache.find((r) => r.name === def.name);
  if (existing) return existing;
  return guild.roles.create({ name: def.name, colors: { primaryColor: def.color }, permissions: [], reason: 'Dummes Setup', ...extra });
}

async function wipeChannels(guild, keepChannelId) {
  let failed = 0;
  // Erst normale Kanäle, dann Kategorien
  const channels = [...guild.channels.cache.values()].sort((a, b) => (a.type === ChannelType.GuildCategory) - (b.type === ChannelType.GuildCategory));
  for (const ch of channels) {
    if (ch.id === keepChannelId) continue;
    try {
      await ch.delete('Dummes Setup (alles löschen)');
    } catch {
      failed++; // z. B. Regel-Kanal bei Community-Servern
    }
  }
  return failed;
}

async function runSetup(guild, { wipe, name }) {
  const g = guildState(guild.id);
  const log = [];

  // 1) Aufräumen
  if (wipe) {
    const failed = await wipeChannels(guild);
    log.push(`🧨 Alte Kanäle gelöscht${failed ? ` (${failed} wollten nicht)` : ''}`);
    g.tickets = {};
  } else if (guild.channels.cache.size > 0) {
    log.push(
      `⚠️ Deine ${guild.channels.cache.size} alten Kanäle habe ich nicht angefasst. Die sind weiterhin für alle sichtbar (auch ohne Captcha). ` +
        'Lösch sie oder nimm @everyone dort „Kanal ansehen" weg.',
    );
  }
  for (const key of Object.keys(g.ids)) if (key.startsWith('ch_')) delete g.ids[key];

  // 2) Rollen
  const verified = await ensureRole(guild, ROLES.verified);
  const team = await ensureRole(guild, ROLES.team, {
    hoist: true,
    permissions: [P.ManageMessages, P.ModerateMembers, P.MuteMembers, P.MoveMembers],
  });
  for (const r of LOTTERY_ROLES) await ensureRole(guild, r);
  g.ids.role_verified = verified.id;
  g.ids.role_team = team.id;
  log.push(`🎭 ${2 + LOTTERY_ROLES.length} Rollen erstellt (bzw. wiederverwendet)`);

  // 3) Kategorien und Kanäle
  const ids = { verified: verified.id, team: team.id };
  const byKey = {};
  let count = 0;
  for (const cat of LAYOUT) {
    const category = await guild.channels.create({
      name: cat.name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites(guild, ids, cat.sicht, false),
      reason: 'Dummes Setup',
    });
    if (cat.key) byKey[cat.key] = category;

    for (const ch of cat.channels) {
      const created = await guild.channels.create({
        name: ch.name,
        type: ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: category.id,
        topic: ch.type === 'text' ? ch.topic : undefined,
        rateLimitPerUser: ch.slowmode,
        userLimit: ch.userLimit,
        permissionOverwrites: overwrites(guild, ids, cat.sicht, ch.nurLesen),
        reason: 'Dummes Setup',
      });
      if (ch.key) byKey[ch.key] = created;
      count++;
    }
  }
  for (const [key, ch] of Object.entries(byKey)) g.ids[`ch_${key}`] = ch.id;
  save();
  log.push(`📁 ${LAYOUT.length} Kategorien und ${count} Kanäle erstellt`);

  // 4) Inhalte posten
  const send = (key, payload) => byKey[key]?.send({ allowedMentions: { parse: [] }, ...payload });
  await send('start', startMessage());
  await send('fakeRules', {
    content:
      '📜 **Die Regeln sind nicht hier.**\n' +
      `Sie sind in ${byKey.realRules}. Oder in ${byKey.start}. Wir wissen es selbst nicht genau.\n` +
      'Bitte hier nichts schreiben. (Du kannst eh nicht.)',
  });
  await send('realRules', allRulesMessage());
  await send('lottery', lotteryMessage());
  await send('tickets', ticketPanelMessage());
  await send('nichtOeffnen', { content: '👀 Wir haben dich gewarnt. Jetzt musst du hier für immer bleiben. (Oder einfach woanders hinklicken.)' });
  await send('modlog', { content: '🚨 **Polizeiwache eröffnet.** Hier landen alle Verstöße gegen die Serverordnung. Rechtskräftig. (Nicht.)' });
  const kodexEmbeds = TEAM_KODEX.map((s, i) =>
    new EmbedBuilder()
      .setColor(i === 0 ? 0x2c3e50 : 0x7f8c8d)
      .setTitle(s.title)
      .setDescription(s.text),
  );
  for (let i = 0; i < kodexEmbeds.length; i += 10) await send('kodex', { embeds: kodexEmbeds.slice(i, i + 10) });
  log.push('📝 Regeln, Captcha, Lotterie, Tickets und Team-Kodex gepostet');

  // 5) Servereinstellungen
  const tryStep = async (label, fn) => {
    try {
      await fn();
      log.push(label);
    } catch (err) {
      logError(`setup:${label}`, err);
      log.push(`⚠️ ${label} – hat nicht geklappt (${err.message})`);
    }
  };
  await tryStep(`✏️ Servername: ${name}`, () => guild.setName(name, 'Dummes Setup'));
  await tryStep('🖼️ Dummes Server-Logo gesetzt', () => setDumbIcon(guild));
  await tryStep('💤 AFK-Kanal: Mathe-Unterricht', async () => {
    await guild.setAFKChannel(byKey.afk);
    await guild.setAFKTimeout(3600);
  });
  await tryStep('👋 Willkommensnachrichten landen in #nicht-allgemein', () => guild.setSystemChannel(byKey.system));
  await tryStep(`🏷️ Bot-Spitzname: ${BOT_NICKNAME}`, () => guild.members.me.setNickname(BOT_NICKNAME));

  g.setupDone = true;
  save();

  // 6) Ankündigung
  await send('announce', {
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('📢 Der Server wurde erfolgreich verschlimmbessert')
        .setDescription(
          'Alles ist jetzt unübersichtlicher. Gern geschehen.\n\n' +
            `Neue Leute landen in ${byKey.start} und müssen das Captcha machen.\n` +
            `Gib Moderator:innen die Rolle **${ROLES.team.name}**, damit sie den Team-Kodex lesen können.`,
        ),
    ],
  });
  return { log, byKey };
}

function summaryEmbed(log) {
  return new EmbedBuilder().setColor(0x57f287).setTitle('✅ Setup fertig. Der Server ist jetzt dumm.').setDescription(log.join('\n'));
}

function missingPermissions(guild) {
  return !guild.members.me.permissions.has(P.Administrator);
}

export async function handleSetupCommand(interaction) {
  const guild = interaction.guild;
  if (missingPermissions(guild)) {
    return interaction.reply({
      content: '❌ Ich brauche **Administrator**-Rechte, um den Server kaputtzumachen. (Servereinstellungen → Rollen → meine Rolle)',
      flags: MessageFlags.Ephemeral,
    });
  }
  const wipe = interaction.options.getBoolean('alles_loeschen') ?? false;
  const name = interaction.options.getString('servername') ?? SERVER_NAME;

  if (wipe) {
    pending.set(interaction.user.id, { name });
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('⚠️ Wirklich ALLES löschen?')
          .setDescription(
            'Ich lösche **alle Kanäle** auf diesem Server (inklusive aller Nachrichten darin) und baue danach den dummen Server auf.\n\n' +
              '**Das kann man nicht rückgängig machen.** Nur bei einem neuen oder leeren Server machen!',
          ),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('setup:confirm').setLabel('🧨 Ja, alles löschen').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('setup:cancel').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const { log } = await runSetup(guild, { wipe: false, name });
    return interaction.editReply({ embeds: [summaryEmbed(log)] });
  } catch (err) {
    logError('setup', err);
    return interaction.editReply(`❌ Setup abgebrochen: \`${err.message}\``);
  }
}

export async function handleSetupButton(interaction, action) {
  if (!interaction.memberPermissions?.has(P.Administrator)) {
    return interaction.reply({ content: 'Nur Admins dürfen das.', flags: MessageFlags.Ephemeral });
  }
  const opts = pending.get(interaction.user.id);
  pending.delete(interaction.user.id);

  if (action === 'cancel' || !opts) {
    return interaction.update({ content: 'Abgebrochen. Der Server bleibt so langweilig, wie er ist.', embeds: [], components: [] });
  }

  await interaction.update({ content: '🧨 Okay. Ich lösche jetzt alles und baue neu auf. Das dauert ein bisschen…', embeds: [], components: [] });
  try {
    const { log, byKey } = await runSetup(interaction.guild, { wipe: true, name: opts.name });
    // Der Kanal mit dem Befehl ist jetzt weg - Zusammenfassung daher in #ankündigungen-alt
    await byKey.announce?.send({ embeds: [summaryEmbed(log)] });
    await interaction.editReply({ content: '✅ Fertig!', embeds: [summaryEmbed(log)] }).catch(() => {});
  } catch (err) {
    logError('setup:wipe', err);
    await interaction.editReply(`❌ Setup abgebrochen: \`${err.message}\``).catch(() => {});
  }
}
