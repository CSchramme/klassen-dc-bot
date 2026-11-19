// Zeitgesteuerter Unsinn: Vertretungsplan, Durchsagen, 13:37, Putz-Rundgang, Feueralarm, Namens-Roulette.
// Dazu die Befehle /vertretungsplan, /zeugnis, /ausrede, /hausaufgabe, /feueralarm, /automatik, /namensroulette.
import { ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits as P, SnowflakeUtil } from 'discord.js';
import { config } from '../config.js';
import { guildState, save } from '../storage.js';
import { localNow, logError, parseTime, randInt, shuffle } from '../util.js';
import { LAYOUT } from './layout.js';
import { findChannel } from './roles.js';
import { humans, raid } from './chaos.js';
import { strafeEintragen } from './moderation.js';
import { FEUERALARM_TEXT, ausrede, durchsage, hausaufgabe, leetDurchsage, spitzname, vertretungsplanEmbed, zeugnisEmbed } from './fun.js';

const NO_PINGS = { parse: [] };
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const AUTOMATIK = {
  vertretungsplan: 'Vertretungsplan (jeden Schultag morgens)',
  durchsagen: 'Durchsagen aus dem Sekretariat',
  leet: '13:37-Durchsage',
  putzen: 'Willys Putz-Rundgang',
  feueralarm: 'Zufälliger Feueralarm im Sprachkanal',
  namensroulette: 'Namens-Roulette (nur wer mitmacht)',
};

function spassState(guildId) {
  const g = guildState(guildId);
  g.automatik ??= {};
  for (const k of Object.keys(AUTOMATIK)) g.automatik[k] ??= true;
  g.zeitplan ??= {};
  g.namensroulette ??= { teilnehmer: [], aktiv: null };
  return g;
}

// ---------------------------------------------------------------------------
// Kanäle finden
// ---------------------------------------------------------------------------
const CHAT_NAMES = LAYOUT.filter((c) => c.sicht === 'verifiziert')
  .flatMap((c) => c.channels)
  .filter((ch) => ch.type === 'text' && !ch.nurLesen && (!ch.key || ch.key === 'system'))
  .map((ch) => ch.name);

function chatChannels(guild) {
  return guild.channels.cache.filter(
    (c) => c.type === ChannelType.GuildText && CHAT_NAMES.includes(c.name) && c.permissionsFor(guild.members.me)?.has(P.SendMessages),
  );
}

const lastActivity = (c) => (c.lastMessageId ? SnowflakeUtil.timestampFrom(c.lastMessageId) : 0);

function activeChat(guild, withinMs) {
  const recent = chatChannels(guild).filter((c) => Date.now() - lastActivity(c) < withinMs);
  return recent.size ? recent.random() : null;
}

function mainChat(guild) {
  return (
    guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === 'allgemein') ??
    chatChannels(guild).first() ??
    guild.systemChannel ??
    null
  );
}

function vertretungsChannel(guild) {
  return findChannel(guild, 'vertretung') ?? guild.channels.cache.find((c) => c.name === 'stundenplan-verwirrung') ?? mainChat(guild);
}

const pausenhof = (guild) => findChannel(guild, 'pausenhof') ?? guild.channels.cache.find((c) => c.type === ChannelType.GuildVoice && c.name.includes('Pausenhof'));

function heute() {
  const now = new Date();
  const t = localNow(config.spass.zeitzone, now);
  const text = new Intl.DateTimeFormat('de-DE', { timeZone: config.spass.zeitzone, weekday: 'long', day: '2-digit', month: '2-digit' }).format(now);
  return { ...t, text };
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------
async function postVertretungsplan(guild) {
  const t = heute();
  await vertretungsChannel(guild)?.send({ embeds: [vertretungsplanEmbed(guild.id, t.text, t.date)], allowedMentions: NO_PINGS });
}

async function postDurchsage(guild) {
  const ch = activeChat(guild, 2 * HOUR) ?? mainChat(guild);
  if (!ch) return 'retry';
  await ch.send({ content: durchsage(), allowedMentions: NO_PINGS });
}

/** Willy wischt durch einen Kanal, in dem gerade was los ist: 60 Sekunden lang 30 s Slowmode. */
async function putzRundgang(guild) {
  const ch = activeChat(guild, 30 * 60 * 1000);
  if (!ch) return 'retry';
  const before = ch.rateLimitPerUser ?? 0;
  await ch.send({ content: '🧹 *Willy wischt durch den Kanal* … Vorsicht, nasser Boden! Bitte Füße hoch. (30 Sekunden Slowmode)', allowedMentions: NO_PINGS });
  if (before < 30) await ch.setRateLimitPerUser(30, 'Boden nass').catch(() => {});
  setTimeout(async () => {
    if (before < 30) await ch.setRateLimitPerUser(before, 'Boden trocken').catch(() => {});
    ch.send({ content: '✨ Boden ist trocken. Ihr dürft wieder normal schreiben.', allowedMentions: NO_PINGS }).catch(() => {});
  }, 60_000);
}

/**
 * Feueralarm: Sirene im vollsten Sprachkanal, alle raus auf den Pausenhof, nach 45 Sekunden wieder zurück.
 * Gibt einen Text für die Rückmeldung zurück.
 */
export async function feueralarm(guild) {
  const hof = pausenhof(guild);
  const rooms = guild.channels.cache.filter(
    (c) => c.type === ChannelType.GuildVoice && c.id !== guild.afkChannelId && c.id !== hof?.id && humans(c) > 0,
  );
  if (rooms.size === 0) return '🚨 Feueralarm! … Aber es ist niemand im Sprachkanal. Der Alarm hallt durch leere Flure.';

  for (const room of rooms.values()) room.send({ content: FEUERALARM_TEXT, allowedMentions: NO_PINGS }).catch(() => {});
  const loudest = [...rooms.values()].sort((a, b) => humans(b) - humans(a))[0];
  await raid(loudest, { filter: /feueralarm|alarm|sirene|siren/i, count: 1, quick: true }).catch((err) => logError('feueralarm:sirene', err));

  if (!hof) return '🚨 Sirene gespielt. Es gibt aber keinen Pausenhof-Sprachkanal, deshalb wurde niemand evakuiert.';

  const moved = [];
  for (const room of rooms.values()) {
    for (const m of [...room.members.values()]) {
      if (m.user.bot) continue;
      try {
        await m.voice.setChannel(hof, 'Feueralarm');
        moved.push({ id: m.id, from: room.id });
      } catch {
        // z. B. gerade selbst rausgegangen
      }
    }
  }
  const sekunden = (randInt(21, 99) / 10).toFixed(1).replace('.', ',');
  await hof
    .send({
      content:
        `✅ **Alle draußen!** ${moved.length} ${moved.length === 1 ? 'Person' : 'Personen'} in ${sekunden} Sekunden evakuiert. Neuer Schulrekord (wahrscheinlich).\n` +
        'In 45 Sekunden bringe ich euch zurück in eure Räume.',
      allowedMentions: NO_PINGS,
    })
    .catch(() => {});

  setTimeout(async () => {
    let back = 0;
    for (const { id, from } of moved) {
      const member = guild.members.cache.get(id);
      const room = guild.channels.cache.get(from);
      if (member?.voice.channelId !== hof.id || !room) continue;
      try {
        await member.voice.setChannel(room, 'Probealarm beendet');
        back++;
      } catch {
        // egal
      }
    }
    hof.send({ content: `🔔 **Probealarm beendet.** ${back} ${back === 1 ? 'Person wurde' : 'Personen wurden'} zurückgebracht. Danke fürs Mitmachen!`, allowedMentions: NO_PINGS }).catch(() => {});
  }, 45_000);

  return `🚨 Feueralarm ausgelöst: ${moved.length} ${moved.length === 1 ? 'Person' : 'Personen'} evakuiert. In 45 Sekunden geht's zurück.`;
}

async function autoFeueralarm(guild) {
  const imVoice = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildVoice && c.id !== guild.afkChannelId)
    .reduce((sum, c) => sum + humans(c), 0);
  if (imVoice < 2) return 'retry'; // lohnt sich nicht
  await feueralarm(guild);
}

// ---------------------------------------------------------------------------
// Namens-Roulette (nur für Leute, die mitmachen)
// ---------------------------------------------------------------------------
async function namenZuruecksetzen(guild, aktiv) {
  const m = await guild.members.fetch(aktiv.userId).catch(() => null);
  if (!m || m.nickname !== aktiv.name) return; // schon selbst geändert
  if (aktiv.selbst) {
    // Den Namen darf ich nicht ändern - also Bescheid sagen
    await mainChat(guild)
      ?.send({ content: `🎡 <@${aktiv.userId}>, deine 24 Stunden als **${aktiv.name}** sind vorbei. Du darfst dich mit \`/nick\` zurückbenennen.`, allowedMentions: { users: [aktiv.userId] } })
      .catch(() => {});
    return;
  }
  await m.setNickname(aktiv.original ?? null, 'Namens-Roulette vorbei').catch(() => {});
}

/** Owner & Co. müssen den Spitznamen selbst setzen - nach 10 Minuten wird kontrolliert. */
async function selbstKontrolle(guild, g) {
  const aktiv = g.namensroulette.aktiv;
  if (!aktiv?.selbst || aktiv.kontrolliert || Date.now() < aktiv.kontrolleAb) return;
  aktiv.kontrolliert = true;
  save();
  const m = await guild.members.fetch(aktiv.userId).catch(() => null);
  if (!m) return;
  const chat = mainChat(guild);
  if (m.nickname === aktiv.name) {
    await chat?.send({ content: `✅ Kontrolle: <@${aktiv.userId}> heißt vorschriftsmäßig **${aktiv.name}**. Vorbildlich.`, allowedMentions: { parse: [] } }).catch(() => {});
    return;
  }
  const strafe = await strafeEintragen(guild, aktiv.userId, `Arbeitsverweigerung beim Namens-Roulette (sollte „${aktiv.name}“ heißen)`);
  await chat
    ?.send({
      content:
        `🚨 **Kontrolle:** <@${aktiv.userId}> heißt immer noch nicht **${aktiv.name}**. Das ist Arbeitsverweigerung beim Namens-Roulette.\n` +
        `> Eintrag ins Strafregister. Strafe: **${strafe}**\n> Nachholen geht mit \`/nick ${aktiv.name}\``,
      allowedMentions: { users: [aktiv.userId] },
    })
    .catch(() => {});
}

async function rouletteAblauf(guild, g) {
  await selbstKontrolle(guild, g);
  const aktiv = g.namensroulette.aktiv;
  if (!aktiv || Date.now() < aktiv.bis) return;
  g.namensroulette.aktiv = null;
  save();
  await namenZuruecksetzen(guild, aktiv);
}

export async function namensrouletteDrehen(guild) {
  const nr = spassState(guild.id).namensroulette;
  if (nr.aktiv) {
    await namenZuruecksetzen(guild, nr.aktiv);
    nr.aktiv = null;
  }
  for (const id of shuffle(nr.teilnehmer)) {
    const m = await guild.members.fetch(id).catch(() => null);
    if (!m) {
      nr.teilnehmer = nr.teilnehmer.filter((x) => x !== id); // nicht mehr auf dem Server
      continue;
    }
    const name = spitzname();
    const bis = Date.now() + DAY;
    let hinweis = '';
    if (m.manageable) {
      const original = m.nickname;
      try {
        await m.setNickname(name, 'Namens-Roulette');
      } catch {
        continue;
      }
      nr.aktiv = { userId: id, original, name, bis };
    } else {
      // Server-Owner (oder Rolle über mir): Den Namen darf kein Bot ändern, also muss die Person selbst ran
      nr.aktiv = { userId: id, original: m.nickname, name, bis, selbst: true, kontrolleAb: Date.now() + 10 * 60 * 1000 };
      hinweis =
        `\n📝 Discord lässt mich deinen Namen nicht ändern, also machst du das selbst: Tipp einfach \`/nick ${name}\` ein.` +
        '\nIch kontrolliere das in **10 Minuten**. 👀';
    }
    save();
    await mainChat(guild)
      ?.send({ content: `🎡 **Namens-Roulette:** <@${id}> heißt ab jetzt 24 Stunden lang **${name}**. Herzlichen Glückwunsch!${hinweis}`, allowedMentions: { users: [id] } })
      .catch(() => {});
    return `<@${id}> heißt jetzt **${name}**.`;
  }
  save();
  return null;
}

// ---------------------------------------------------------------------------
// Zeitplan (läuft alle 30 Sekunden)
// ---------------------------------------------------------------------------
const randomDelay = ([min, max], unit) => (min + Math.random() * (Math.max(min, max) - min)) * unit;

export async function tickGuild(guild, nowDate = new Date()) {
  const g = spassState(guild.id);
  const a = g.automatik;
  const z = g.zeitplan;
  const t = localNow(config.spass.zeitzone, nowDate);
  const now = nowDate.getTime();

  await rouletteAblauf(guild, g);

  // Feste Uhrzeiten (mit Zeitfenster, falls der Bot gerade neu gestartet ist)
  const vp = parseTime(config.spass.vertretungsplanUhrzeit, 7 * 60 + 15);
  if (a.vertretungsplan && t.weekday <= 5 && t.minutes >= vp && t.minutes < vp + 60 && z.vertretungsplan !== t.date) {
    z.vertretungsplan = t.date;
    save();
    await postVertretungsplan(guild);
  }
  if (a.leet && t.minutes >= 13 * 60 + 37 && t.minutes <= 13 * 60 + 38 && z.leet !== t.date) {
    z.leet = t.date;
    save();
    await mainChat(guild)?.send({ content: leetDurchsage(), allowedMentions: NO_PINGS });
  }
  const nr = parseTime(config.spass.namensrouletteUhrzeit, 7 * 60);
  if (a.namensroulette && t.minutes >= nr && t.minutes < nr + 60 && z.namensroulette !== t.date) {
    z.namensroulette = t.date;
    save();
    if (g.namensroulette.teilnehmer.length) await namensrouletteDrehen(guild);
  }

  // Zufällige Sachen, nur tagsüber
  const tagsueber = t.hour >= config.spass.aktivVon && t.hour < config.spass.aktivBis;
  const zufall = [
    ['durchsagen', postDurchsage, config.spass.durchsageStunden, HOUR],
    ['putzen', putzRundgang, config.spass.putzenStunden, HOUR],
    ['feueralarm', autoFeueralarm, config.spass.feueralarmTage, DAY],
  ];
  for (const [key, action, range, unit] of zufall) {
    if (!a[key]) continue;
    const slot = `next_${key}`;
    if (!z[slot]) {
      z[slot] = now + randomDelay(range, unit);
      save();
      continue;
    }
    if (now < z[slot] || !tagsueber) continue;
    const result = await action(guild);
    z[slot] = now + (result === 'retry' ? randInt(1, 3) * HOUR : randomDelay(range, unit));
    save();
  }
}

export function initEvents(client) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    for (const guild of client.guilds.cache.values()) {
      try {
        await tickGuild(guild);
      } catch (err) {
        logError(`events:${guild.name}`, err);
      }
    }
    running = false;
  };
  setInterval(tick, 30_000);
  tick();
}

// ---------------------------------------------------------------------------
// Befehle
// ---------------------------------------------------------------------------
export const SPASS_COMMANDS = ['vertretungsplan', 'zeugnis', 'ausrede', 'hausaufgabe', 'feueralarm', 'automatik', 'namensroulette'];

export async function handleSpassCommand(interaction) {
  const guild = interaction.guild;
  const ephemeral = { flags: MessageFlags.Ephemeral };
  const g = spassState(guild.id);

  switch (interaction.commandName) {
    case 'vertretungsplan': {
      const t = heute();
      return interaction.reply({ embeds: [vertretungsplanEmbed(guild.id, t.text, t.date)] });
    }

    case 'zeugnis': {
      const member = interaction.options.getMember('nutzer') ?? interaction.member;
      const user = member.user ?? interaction.user;
      return interaction.reply({ embeds: [zeugnisEmbed(user, member.displayName ?? user.username, heute().date)], allowedMentions: NO_PINGS });
    }

    case 'ausrede':
      return interaction.reply({ content: `🙊 ${ausrede()}`, allowedMentions: NO_PINGS });

    case 'hausaufgabe':
      return interaction.reply({ content: `📚 **Hausaufgabe:** ${hausaufgabe()}`, allowedMentions: NO_PINGS });

    case 'feueralarm': {
      await interaction.reply({ content: `🚨 ${interaction.member.displayName} hat den Feueralarm ausgelöst!`, allowedMentions: NO_PINGS });
      const text = await feueralarm(guild);
      return interaction.editReply({ content: text, allowedMentions: NO_PINGS });
    }

    case 'automatik': {
      const sub = interaction.options.getSubcommand();
      if (sub === 'setzen') {
        const key = interaction.options.getString('funktion', true);
        const on = interaction.options.getBoolean('aktiv', true);
        g.automatik[key] = on;
        save();
        return interaction.reply({ content: `${on ? '✅' : '⏸️'} **${AUTOMATIK[key]}** ist jetzt ${on ? 'an' : 'aus'}.`, ...ephemeral });
      }
      const lines = Object.entries(AUTOMATIK).map(([k, label]) => {
        const next = g.zeitplan[`next_${k}`];
        const wann = g.automatik[k] && next ? ` · nächstes Mal ungefähr <t:${Math.floor(next / 1000)}:R>` : '';
        return `${g.automatik[k] ? '✅' : '⏸️'} ${label}${wann}`;
      });
      return interaction.reply({
        content:
          `**Automatischer Unsinn:**\n${lines.join('\n')}\n\n` +
          `Vertretungsplan: Mo–Fr um ${config.spass.vertretungsplanUhrzeit} · Namens-Roulette: täglich um ${config.spass.namensrouletteUhrzeit} · ` +
          `Zufälliges nur zwischen ${config.spass.aktivVon} und ${config.spass.aktivBis} Uhr.`,
        ...ephemeral,
      });
    }

    case 'namensroulette': {
      const sub = interaction.options.getSubcommand();
      const nr = g.namensroulette;
      const id = interaction.user.id;

      if (sub === 'mitmachen') {
        if (nr.teilnehmer.includes(id)) return interaction.reply({ content: 'Du machst schon mit. Mutig.', ...ephemeral });
        nr.teilnehmer.push(id);
        save();
        const schild = interaction.member.manageable
          ? ''
          : '\n\n📝 Deinen Namen darf ich nicht selbst ändern (Discord lässt Bots den Namen vom Server-Owner nie ändern, und auch nicht von Leuten, die über mir stehen). ' +
            'Wenn du dran bist, setzt du den Spitznamen also **selbst** mit `/nick`. Ich kontrolliere das. Wer sich weigert, landet im Strafregister.';
        return interaction.reply({
          content: `🎡 Du machst beim Namens-Roulette mit! Jeden Tag um ${config.spass.namensrouletteUhrzeit} bekommt eine Person für 24 Stunden einen dummen Spitznamen. Aussteigen geht jederzeit mit \`/namensroulette aussteigen\`.${schild}`,
          ...ephemeral,
        });
      }

      if (sub === 'aussteigen') {
        nr.teilnehmer = nr.teilnehmer.filter((x) => x !== id);
        if (nr.aktiv?.userId === id) {
          await namenZuruecksetzen(guild, nr.aktiv);
          nr.aktiv = null;
        }
        save();
        return interaction.reply({ content: '👋 Du bist raus. Dein Name gehört wieder dir.', ...ephemeral });
      }

      if (sub === 'liste') {
        const list = nr.teilnehmer.map((x) => `• <@${x}>`).join('\n') || '_Noch niemand. Feiglinge._';
        const aktiv = nr.aktiv ? `\n\nAktuell: <@${nr.aktiv.userId}> heißt **${nr.aktiv.name}** (bis <t:${Math.floor(nr.aktiv.bis / 1000)}:t>)` : '';
        return interaction.reply({ content: `🎡 **Namens-Roulette – Teilnehmende (${nr.teilnehmer.length}):**\n${list}${aktiv}`, allowedMentions: NO_PINGS });
      }

      // drehen
      if (!interaction.memberPermissions?.has(P.ManageGuild)) {
        return interaction.reply({ content: 'Drehen dürfen nur Leute mit „Server verwalten“. Das Roulette dreht sich sonst jeden Morgen von selbst.', ...ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await namensrouletteDrehen(guild);
      return interaction.editReply(result ? `🎡 Gedreht: ${result}` : 'Niemand, dessen Namen ich ändern darf, macht mit.');
    }

    default:
      return interaction.reply({ content: 'Hä?', ...ephemeral });
  }
}
