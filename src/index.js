import { diagnose, keepWarm, restAgent } from './net.js';
import { ActivityType, Client, EmbedBuilder, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { config } from './config.js';
import { COMMANDS } from './commands.js';
import { aiProvider, aiStatus, discoverGeminiModels, testAI } from './ai.js';
import { guildState, save } from './storage.js';
import { logError, pick } from './util.js';
import { INSIDERS, INSIDER_STATUS } from './insider.js';
import { handleRules, rulesPage } from './features/rules.js';
import { findChannel } from './features/roles.js';
import { handleCaptcha } from './features/captcha.js';
import { handleLottery } from './features/lottery.js';
import { handleMention, handleTicket, handleTicketMessage } from './features/tickets.js';
import { handleModeration, ramEmbed, strafregisterEmbed } from './features/moderation.js';
import { getSounds, initChaos, raid } from './features/chaos.js';
import { handleBotCommand, handleServerCommand, initRoulette } from './features/server.js';
import { handleCoOwnerCommand, handleSetupButton, handleSetupCommand, serverAbgleich } from './features/setup.js';
import { SPASS_COMMANDS, handleSpassCommand, initEvents, istPause, merkeAktiv, pauseText } from './features/events.js';
import { initVoiceNames } from './features/voicenames.js';
import { SCHUL_COMMANDS, handleSchule, handleSchulCommand, handleSchulNachricht, initSchule, lehrerErwaehnt } from './features/schule.js';
import { startLehrerBots } from './lehrer-bots.js';
import { handleSoundsCommand } from './features/sounds.js';
import { handleFormular, handleFormularCommand } from './features/formulare.js';

if (!config.token) {
  console.error('❌ DISCORD_TOKEN fehlt. Kopiere .env.example nach .env und trag den Token ein.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privilegiert: im Developer Portal einschalten!
  ],
  rest: { agent: restAgent },
});

const STATUS = [
  'Captcha-Kontrolle 🚦',
  'Ignoriert Tickets 🎫',
  'Zählt Ampeln',
  'Sucht eine Socke 🧦',
  'Bewacht die Enten 🦆',
  'Jagt Gänse',
  'Wartet auf die Pause',
  ...INSIDER_STATUS,
];

function rotateStatus() {
  if (client.guilds.cache.some((g) => istPause(g.id))) return; // in der Kaffeepause bleibt der Pause-Status
  client.user.setPresence({ activities: [{ type: ActivityType.Custom, name: 'custom', state: pick(STATUS) }] });
}

async function registerCommands(guild) {
  try {
    await guild.commands.set(COMMANDS);
  } catch (err) {
    logError(`commands:${guild.name}`, err);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
  console.log(`🔗 Einladungslink: https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);
  console.log(aiStatus());
  keepWarm(client);
  diagnose();
  if (aiProvider() === 'gemini') {
    discoverGeminiModels().then((list) => {
      if (list.length) console.log(`📋 Gemini-Modelle für deinen Key: ${list.slice(0, 6).join(', ')}`);
    });
  }
  for (const guild of client.guilds.cache.values()) await registerCommands(guild);
  // Abgleich: Server auf den neuesten Stand bringen (läuft im Hintergrund weiter)
  (async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const log = await serverAbgleich(guild);
        console.log(log.length ? `🔄 Abgleich ${guild.name}:\n   ${log.join('\n   ')}` : `🔄 Abgleich ${guild.name}: alles auf dem neuesten Stand.`);
      } catch (err) {
        logError(`abgleich:${guild.name}`, err);
      }
    }
  })();
  rotateStatus();
  setInterval(rotateStatus, 5 * 60 * 1000);
  initChaos(client);
  initRoulette(client);
  initEvents(client);
  initVoiceNames(client);
  initSchule(client);
});

client.on(Events.GuildCreate, (guild) => registerCommands(guild));

// Wer in einen Sprachkanal geht, zählt auch als aktiv (fürs Namens-Roulette)
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (newState.channelId && !oldState.channelId && newState.member && !newState.member.user.bot) merkeAktiv(newState.guild.id, newState.id);
});

// ---------------------------------------------------------------------------
// Slash-Befehle
// ---------------------------------------------------------------------------
// Diese Befehle funktionieren auch während Willys Kaffeepause (Verwaltung)
const PAUSE_AUSNAHMEN = ['setup', 'automatik', 'kaffeepause', 'ki', 'server', 'bot', 'co-owner', 'chaos', 'moderation', 'sounds', 'schule', 'unterricht', 'klassensprecher', 'klassenbuch'];

async function handleCommand(interaction) {
  const ephemeral = { flags: MessageFlags.Ephemeral };
  if (istPause(interaction.guildId) && !PAUSE_AUSNAHMEN.includes(interaction.commandName)) {
    return interaction.reply({ content: pauseText(interaction.guildId), ...ephemeral });
  }
  if (SPASS_COMMANDS.includes(interaction.commandName)) return handleSpassCommand(interaction);
  if (SCHUL_COMMANDS.includes(interaction.commandName)) return handleSchulCommand(interaction);
  const g = guildState(interaction.guildId);

  switch (interaction.commandName) {
    case 'setup':
      return handleSetupCommand(interaction);

    case 'co-owner':
      return handleCoOwnerCommand(interaction);

    case 'sounds':
      return handleSoundsCommand(interaction);

    case 'ki': {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const lines = await testAI();
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🤖 KI-Test').setDescription(lines.join('\n'))] });
    }

    case 'formular':
      return handleFormularCommand(interaction);

    case 'server':
      return handleServerCommand(interaction);

    case 'bot':
      return handleBotCommand(interaction);

    case 'chaos': {
      const sub = interaction.options.getSubcommand();
      if (sub === 'an' || sub === 'aus') {
        g.chaos = sub === 'an';
        save();
        return interaction.reply({ content: g.chaos ? '😈 Chaos ist an. Niemand ist sicher.' : '😇 Chaos ist aus. Vorerst.', ...ephemeral });
      }
      if (sub === 'status') {
        const sounds = await getSounds(interaction.guild);
        const list = sounds.slice(0, 20).map((s) => `• ${s.name}`).join('\n') || '_keine – mach `/sounds hochladen`_';
        return interaction.reply({
          content: `Chaos: **${g.chaos ? 'an 😈' : 'aus 😇'}**\nSounds (${sounds.length}):\n${list}`,
          ...ephemeral,
        });
      }
      // jetzt
      const channel = interaction.options.getChannel('kanal') ?? interaction.member.voice?.channel;
      if (!channel) {
        return interaction.reply({ content: 'Sag mir mit `kanal:` welcher Sprachkanal, oder geh selbst in einen. Ich komm dann. Versprochen.', ...ephemeral });
      }
      await interaction.reply({ content: '🫡 Bin unterwegs …', ...ephemeral });
      const result = await raid(channel);
      return interaction.editReply(result);
    }

    case 'moderation': {
      g.moderation = interaction.options.getSubcommand() === 'an';
      save();
      return interaction.reply({
        content: g.moderation ? '👮 Quatsch-Moderation ist an. Gänse, nehmt euch in Acht.' : '🕊️ Quatsch-Moderation ist aus. Amnestie für alle.',
        ...ephemeral,
      });
    }

    case 'strafregister': {
      const user = interaction.options.getUser('nutzer') ?? interaction.user;
      return interaction.reply({ embeds: [strafregisterEmbed(interaction.guild, user)] });
    }

    case 'ram': {
      const user = interaction.options.getUser('nutzer') ?? interaction.user;
      return interaction.reply({ embeds: [ramEmbed(interaction.guild, user)], allowedMentions: { parse: [] } });
    }

    case 'regeln':
      return interaction.reply({ ...rulesPage(0), components: [], ...ephemeral, content: 'Seite 1. Alle Seiten stehen in #regeln.' });

    case 'einladung': {
      const guild = interaction.guild;
      const channel = findChannel(guild, 'start') ?? guild.systemChannel ?? guild.channels.cache.find((c) => c.isTextBased?.() && !c.isThread?.());
      if (!channel) return interaction.reply({ content: 'Ich finde keinen Kanal für die Einladung. Erst `/setup` ausführen.', ...ephemeral });
      try {
        // Läuft nie ab, unbegrenzt oft benutzbar; vorhandener Link wird wiederverwendet
        const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: false, reason: `/einladung von ${interaction.user.username}` });
        return interaction.reply({
          content:
            `📨 **Einladungslink:** ${invite.url}
` +
            'Läuft nie ab. Neue Leute landen direkt im Hintereingang und dürfen erstmal ein Captcha lösen. 🚦',
        });
      } catch (err) {
        logError('einladung', err);
        return interaction.reply({ content: `Konnte keinen Link erstellen (${err.message}).`, ...ephemeral });
      }
    }

    case 'insider': {
      if (INSIDERS.length === 0) return interaction.reply({ content: 'Keine Insider eingetragen. Traurig.', ...ephemeral });
      const insider = pick(INSIDERS);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle(`${insider.emoji ?? '⭐'} ${insider.name}`)
            .setDescription(pick(insider.reaktionen)),
        ],
      });
    }

    default:
      return interaction.reply({ content: 'Diesen Befehl kenne ich nicht. Er mich auch nicht.', ...ephemeral });
  }
}

// ---------------------------------------------------------------------------
// Knöpfe, Menüs, Formulare
// ---------------------------------------------------------------------------
async function handleComponent(interaction) {
  const [prefix, action, arg, arg2] = interaction.customId.split(':');
  switch (prefix) {
    case 'rules':
      return handleRules(interaction, action, arg);
    case 'cap':
      return handleCaptcha(interaction, action, arg);
    case 'lotto':
      return handleLottery(interaction);
    case 'ticket':
      return handleTicket(interaction, action);
    case 'setup':
      return handleSetupButton(interaction, action);
    case 'form':
      return handleFormular(interaction, action, arg);
    case 'schule':
      return handleSchule(interaction, action, arg, arg2);
    default:
      return interaction.reply({ content: 'Dieser Knopf ist aus einer anderen Zeit.', flags: MessageFlags.Ephemeral });
  }
}

/** Verarbeitet Befehle und Knöpfe – für Willy und für die Lehrer-Bots (deren Quiz-Knöpfe landen bei ihnen). */
async function onInteraction(interaction) {
  if (!interaction.inGuild()) return;
  const receivedAfter = Date.now() - interaction.createdTimestamp; // wie spät kam der Klick bei Willy an?
  try {
    if (interaction.isChatInputCommand()) await handleCommand(interaction);
    else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) await handleComponent(interaction);
  } catch (err) {
    // 10062 = Antwort kam zu spät (Discord gibt nur 3 Sekunden), 40060 = schon beantwortet
    if (err?.code === 10062 || err?.code === 40060) {
      const age = Date.now() - interaction.createdTimestamp;
      const what = interaction.customId ?? `/${interaction.commandName}`;
      console.warn(
        `⏱️ Discord-Interaktion "${what}" ${err.code === 10062 ? 'abgelaufen' : 'doppelt beantwortet'} ` +
          `(angekommen bei Willy nach ${receivedAfter} ms, Antwort nach ${age} ms, erlaubt sind 3000 ms).` +
          (err.code === 40060 ? ' Läuft der Bot vielleicht zweimal (z. B. zusätzlich auf deinem PC)?' : ''),
      );
      return;
    }
    logError('interaction', err);
    const msg = { content: '💥 Da ist was schiefgelaufen. Willy ist informiert. Willy ist es egal.', flags: MessageFlags.Ephemeral };
    if (interaction.isRepliable()) {
      (interaction.replied || interaction.deferred ? interaction.followUp(msg) : interaction.reply(msg)).catch(() => {});
    }
  }
}

client.on(Events.InteractionCreate, onInteraction);
startLehrerBots(onInteraction);

// ---------------------------------------------------------------------------
// Nachrichten: erst Tickets, dann Quatsch-Moderation
// ---------------------------------------------------------------------------
client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.author.bot || message.system) return;
  try {
    merkeAktiv(message.guild.id, message.author.id);
    if (await handleTicketMessage(message)) return;
    if (await handleSchulNachricht(message)) return;
    if (await lehrerErwaehnt(message)) return;
    if (await handleMention(message)) return;
    await handleModeration(message);
  } catch (err) {
    logError('message', err);
  }
});

process.on('unhandledRejection', (err) => logError('unhandledRejection', err));

client.login(config.token).catch((err) => {
  if (String(err?.message).toLowerCase().includes('disallowed intents')) {
    console.error(
      '❌ Discord verweigert die Anmeldung: "Message Content Intent" ist nicht eingeschaltet.\n' +
        '   → https://discord.com/developers/applications → deine App → Bot → Privileged Gateway Intents → MESSAGE CONTENT INTENT an.',
    );
  } else {
    console.error('❌ Login fehlgeschlagen:', err.message);
  }
  process.exit(1);
});
