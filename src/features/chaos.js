// Soundboard-Chaos: Der Bot platzt zufällig in Sprachkanäle und spielt Soundboard-Sounds des Servers ab.
import { ChannelType, Routes } from 'discord.js';
import { VoiceConnectionStatus, entersState, joinVoiceChannel } from '@discordjs/voice';
import { config } from '../config.js';
import { guildState } from '../storage.js';
import { chance, logError, pick, randInt, sleep } from '../util.js';

const busy = new Set(); // guildIds, in denen gerade ein Überfall läuft
const timers = new Map(); // guildId -> Timeout
let defaultSoundsCache = null;

export const humans = (channel) => channel.members.filter((m) => !m.user.bot).size;

/** Startet den Zufalls-Timer für alle Server und hört auf Sprachkanal-Beitritte. */
export function initChaos(client) {
  for (const guild of client.guilds.cache.values()) scheduleNext(guild);
  client.on('guildCreate', (guild) => scheduleNext(guild));

  client.on('voiceStateUpdate', (oldState, newState) => {
    const member = newState.member;
    if (!member || member.user.bot) return;
    const joined = newState.channelId && newState.channelId !== oldState.channelId;
    if (!joined || !guildState(newState.guild.id).chaos) return;
    if (newState.channelId === newState.guild.afkChannelId) return;
    if (!chance(config.chaos.joinChance)) return;

    // Kurz warten, damit es "zufällig" wirkt
    setTimeout(() => {
      const channel = newState.guild.channels.cache.get(newState.channelId);
      if (channel && humans(channel) > 0) raid(channel).catch((err) => logError('chaos:join', err));
    }, randInt(5, 40) * 1000);
  });
}

function scheduleNext(guild) {
  clearTimeout(timers.get(guild.id));
  const { minMinutes, maxMinutes } = config.chaos;
  const delay = randInt(Math.round(minMinutes * 60), Math.round(Math.max(minMinutes, maxMinutes) * 60)) * 1000;
  const t = setTimeout(async () => {
    try {
      if (guildState(guild.id).chaos) await randomRaid(guild);
    } catch (err) {
      logError('chaos:timer', err);
    } finally {
      scheduleNext(guild);
    }
  }, delay);
  t.unref?.();
  timers.set(guild.id, t);
}

async function randomRaid(guild) {
  const candidates = guild.channels.cache.filter(
    (c) => c.type === ChannelType.GuildVoice && c.id !== guild.afkChannelId && c.joinable && humans(c) > 0,
  );
  if (candidates.size === 0) return;
  await raid(candidates.random());
}

/** Soundboard-Sounds des Servers, sonst (falls erlaubt) die Discord-Standardsounds. */
export async function getSounds(guild) {
  let sounds = [];
  try {
    const guildSounds = await guild.soundboardSounds.fetch();
    sounds = guildSounds.filter((s) => s.available).map((s) => ({ soundId: s.soundId, guildId: guild.id, name: s.name }));
  } catch (err) {
    logError('chaos:fetchSounds', err);
  }
  if (sounds.length === 0 && config.chaos.useDefaultSounds) {
    try {
      defaultSoundsCache ??= await guild.client.rest.get(Routes.soundboardDefaultSounds());
      sounds = defaultSoundsCache.map((s) => ({ soundId: s.sound_id, name: s.name }));
    } catch (err) {
      logError('chaos:defaultSounds', err);
    }
  }
  return sounds;
}

/**
 * Überfall auf einen Sprachkanal: beitreten, ein paar Sounds spielen, wieder gehen.
 * Gibt einen kurzen Status-Text zurück (für /chaos jetzt).
 * opts.filter: bevorzugte Sounds (RegExp auf den Namen), opts.count: Anzahl, opts.quick: kurze Pausen
 */
export async function raid(channel, opts = {}) {
  const guild = channel.guild;
  if (channel.type !== ChannelType.GuildVoice) return 'Das ist kein normaler Sprachkanal.';
  if (busy.has(guild.id)) return 'Ich bin schon woanders am Nerven. Einer nach dem anderen.';
  if (!channel.joinable) return 'Ich darf diesem Kanal nicht beitreten (Rechte prüfen).';

  busy.add(guild.id);
  let connection;
  try {
    let sounds = await getSounds(guild);
    if (opts.filter) {
      const matching = sounds.filter((s) => opts.filter.test(s.name));
      if (matching.length) sounds = matching;
    }
    if (sounds.length === 0) return 'Keine Soundboard-Sounds gefunden. Ladet welche in den Servereinstellungen hoch!';

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false, // Pflicht, sonst darf der Bot keine Soundboard-Sounds senden
      selfMute: false,
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    await sleep(opts.quick ? randInt(200, 500) : randInt(800, 2500));

    const count = opts.count ?? randInt(config.chaos.minSounds, Math.max(config.chaos.minSounds, config.chaos.maxSounds));
    let played = 0;
    for (let i = 0; i < count; i++) {
      if (humans(channel) === 0) break; // alle geflohen
      const sound = pick(sounds);
      try {
        await channel.sendSoundboardSound({ soundId: sound.soundId, guildId: sound.guildId });
        played++;
      } catch (err) {
        logError('chaos:send', err);
        break;
      }
      await sleep(opts.quick ? 1500 : randInt(2500, 7000));
    }
    await sleep(opts.quick ? 300 : randInt(500, 3000));
    return played > 0 ? `Mission erfüllt: ${played} Sound(s) in ${channel.name} gespielt. 🫡` : 'Ich war da, aber es kam kein Ton raus. (Fehlt mir das Recht „Soundboard verwenden"?)';
  } catch (err) {
    logError('chaos:raid', err);
    return 'Beitritt fehlgeschlagen. Der Sprachkanal hat mich abgelehnt. 😢';
  } finally {
    try {
      connection?.destroy();
    } catch {
      // schon weg
    }
    busy.delete(guild.id);
  }
}
