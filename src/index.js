import { ActivityType, Client, EmbedBuilder, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { config } from './config.js';
import { COMMANDS } from './commands.js';
import { aiStatus } from './ai.js';
import { guildState, save } from './storage.js';
import { logError, pick } from './util.js';
import { INSIDERS, INSIDER_STATUS } from './insider.js';
import { handleRules, rulesPage } from './features/rules.js';
import { handleCaptcha } from './features/captcha.js';
import { handleLottery } from './features/lottery.js';
import { handleTicket, handleTicketMessage } from './features/tickets.js';
import { handleModeration, ramEmbed, strafregisterEmbed } from './features/moderation.js';
import { getSounds, initChaos, raid } from './features/chaos.js';
import { handleBotCommand, handleServerCommand, initRoulette } from './features/server.js';
import { handleSetupButton, handleSetupCommand } from './features/setup.js';

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
  for (const guild of client.guilds.cache.values()) await registerCommands(guild);
  rotateStatus();
  setInterval(rotateStatus, 5 * 60 * 1000);
  initChaos(client);
  initRoulette(client);
});

client.on(Events.GuildCreate, (guild) => registerCommands(guild));

// ---------------------------------------------------------------------------
// Slash-Befehle
// ---------------------------------------------------------------------------
async function handleCommand(interaction) {
  const ephemeral = { flags: MessageFlags.Ephemeral };
  const g = guildState(interaction.guildId);

  switch (interaction.commandName) {
    case 'setup':
      return handleSetupCommand(interaction);

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
        const list = sounds.slice(0, 20).map((s) => `• ${s.name}`).join('\n') || '_keine_';
        return interaction.reply({
          content: `Chaos: **${g.chaos ? 'an 😈' : 'aus 😇'}**\nSounds (${sounds.length}):\n${list}`,
          ...ephemeral,
        });
      }
      // jetzt
      const channel = interaction.member.voice?.channel;
      if (!channel) return interaction.reply({ content: 'Du musst selbst in einem Sprachkanal sein. Ich komm dann. Versprochen.', ...ephemeral });
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
      return interaction.reply({ ...rulesPage(0), components: [], ...ephemeral, content: 'Seite 1. Die anderen Seiten gibt es beim Captcha. Oder in #wer-hat-meine-socke-gesehen.' });

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
  const [prefix, action, arg] = interaction.customId.split(':');
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
    default:
      return interaction.reply({ content: 'Dieser Knopf ist aus einer anderen Zeit.', flags: MessageFlags.Ephemeral });
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.inGuild()) return;
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
          `(Bot hat nach ${age} ms geantwortet, erlaubt sind 3000 ms).` +
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
});

// ---------------------------------------------------------------------------
// Nachrichten: erst Tickets, dann Quatsch-Moderation
// ---------------------------------------------------------------------------
client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.author.bot || message.system) return;
  try {
    if (await handleTicketMessage(message)) return;
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
