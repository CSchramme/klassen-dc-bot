import { ChannelType, InteractionContextType, PermissionFlagsBits as P, SlashCommandBuilder } from 'discord.js';
import { AUTOMATIK } from './features/events.js';

const guildOnly = (b) => b.setContexts(InteractionContextType.Guild);

export const COMMANDS = [
  guildOnly(
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Baut den dümmsten Server der Welt auf (Kanäle, Rollen, Captcha, Icon …)')
      .setDefaultMemberPermissions(P.Administrator)
      .addBooleanOption((o) => o.setName('alles_loeschen').setDescription('Vorher ALLE Kanäle löschen (nur bei neuem/leerem Server!)'))
      .addStringOption((o) => o.setName('servername').setDescription('Eigener Servername (sonst ein dummer)').setMaxLength(100))
      .addBooleanOption((o) => o.setName('nur_rollen').setDescription('Nur Rollen anlegen/sortieren (Owner, Co-Owner …), keine Kanäle')),
  ),

  guildOnly(
    new SlashCommandBuilder()
      .setName('co-owner')
      .setDescription('Jemanden zum Co-Owner ernennen oder absetzen (nur für den Owner)')
      .setDefaultMemberPermissions(P.Administrator)
      .addUserOption((o) => o.setName('nutzer').setDescription('Wer?').setRequired(true)),
  ),

  guildOnly(
    new SlashCommandBuilder()
      .setName('chaos')
      .setDescription('Soundboard-Überfälle in Sprachkanälen')
      .setDefaultMemberPermissions(P.ManageGuild)
      .addSubcommand((s) => s.setName('an').setDescription('Bot platzt ab jetzt zufällig in Sprachkanäle'))
      .addSubcommand((s) => s.setName('aus').setDescription('Ruhe bitte'))
      .addSubcommand((s) =>
        s
          .setName('jetzt')
          .setDescription('Sofortiger Überfall auf einen Sprachkanal')
          .addChannelOption((o) =>
            o.setName('kanal').setDescription('Welcher Sprachkanal? (sonst deiner)').addChannelTypes(ChannelType.GuildVoice),
          ),
      )
      .addSubcommand((s) => s.setName('status').setDescription('Zeigt, ob Chaos an ist und welche Sounds es gibt')),
  ),

  guildOnly(
    new SlashCommandBuilder()
      .setName('moderation')
      .setDescription('Quatsch-Moderation an/aus')
      .setDefaultMemberPermissions(P.ManageGuild)
      .addSubcommand((s) => s.setName('an').setDescription('Gänse werden wieder verfolgt'))
      .addSubcommand((s) => s.setName('aus').setDescription('Amnestie für alle')),
  ),

  guildOnly(
    new SlashCommandBuilder()
      .setName('server')
      .setDescription('Servername und Logo ändern')
      .setDefaultMemberPermissions(P.ManageGuild)
      .addSubcommand((s) =>
        s
          .setName('name')
          .setDescription('Server umbenennen')
          .addStringOption((o) => o.setName('name').setDescription('Neuer Servername').setRequired(true).setMinLength(2).setMaxLength(100)),
      )
      .addSubcommand((s) =>
        s
          .setName('icon')
          .setDescription('Server-Logo ändern (ohne Bild: zufälliges dummes Logo)')
          .addAttachmentOption((o) => o.setName('bild').setDescription('Eigenes Bild als Logo')),
      )
      .addSubcommand((s) => s.setName('zufall').setDescription('Zufälliger dummer Name UND zufälliges dummes Logo'))
      .addSubcommand((s) =>
        s
          .setName('roulette')
          .setDescription('Alle 6 Stunden ein neuer dummer Servername')
          .addBooleanOption((o) => o.setName('aktiv').setDescription('An oder aus').setRequired(true)),
      ),
  ),

  guildOnly(
    new SlashCommandBuilder()
      .setName('bot')
      .setDescription('Name und Aussehen des Bots ändern')
      .setDefaultMemberPermissions(P.Administrator)
      .addSubcommand((s) =>
        s
          .setName('spitzname')
          .setDescription('Spitzname des Bots auf diesem Server')
          .addStringOption((o) => o.setName('name').setDescription('Neuer Spitzname').setRequired(true).setMaxLength(32)),
      )
      .addSubcommand((s) =>
        s
          .setName('avatar')
          .setDescription('Profilbild des Bots (ohne Bild: Willy-Avatar)')
          .addAttachmentOption((o) => o.setName('bild').setDescription('Neues Profilbild')),
      )
      .addSubcommand((s) =>
        s
          .setName('name')
          .setDescription('Benutzername des Bots (gilt überall, max. 2× pro Stunde)')
          .addStringOption((o) => o.setName('name').setDescription('Neuer Benutzername').setRequired(true).setMinLength(2).setMaxLength(32)),
      ),
  ),

  guildOnly(
    new SlashCommandBuilder()
      .setName('strafregister')
      .setDescription('Zeigt das Strafregister (deins oder von jemand anderem)')
      .addUserOption((o) => o.setName('nutzer').setDescription('Wessen Akte?')),
  ),

  guildOnly(new SlashCommandBuilder().setName('regeln').setDescription('Zeigt die Regeln (nochmal)')),

  guildOnly(new SlashCommandBuilder().setName('insider').setDescription('Ein zufälliger Insider')),

  guildOnly(new SlashCommandBuilder().setName('einladung').setDescription('Einladungslink für den Server (führt direkt zum Captcha)')),

  guildOnly(
    new SlashCommandBuilder()
      .setName('ram')
      .setDescription('Wie viel RAM hat RAM Altman dir schon geklaut?')
      .addUserOption((o) => o.setName('nutzer').setDescription('Wessen RAM-Konto?')),
  ),

  guildOnly(
    new SlashCommandBuilder()
      .setName('sounds')
      .setDescription('Willys eigene Soundboard-Sounds')
      .setDefaultMemberPermissions(P.ManageGuild)
      .addSubcommand((s) =>
        s
          .setName('hochladen')
          .setDescription('Willys Sounds (Feueralarm, Schulgong …) ins Soundboard laden')
          .addBooleanOption((o) => o.setName('ersetzen').setDescription('Willys Sounds, die schon da sind, durch die neueste Version ersetzen')),
      )
      .addSubcommand((s) => s.setName('liste').setDescription('Welche Sounds hat der Server?')),
  ),

  guildOnly(new SlashCommandBuilder().setName('vertretungsplan').setDescription('Der heutige Vertretungsplan (ohne Gewähr)')),

  guildOnly(
    new SlashCommandBuilder()
      .setName('zeugnis')
      .setDescription('Stellt ein Zeugnis aus (einmal pro Tag, dann bleibt es gleich)')
      .addUserOption((o) => o.setName('nutzer').setDescription('Für wen?')),
  ),

  guildOnly(new SlashCommandBuilder().setName('ausrede').setDescription('Ausrede für vergessene Hausaufgaben')),

  guildOnly(new SlashCommandBuilder().setName('hausaufgabe').setDescription('Eine sinnlose Hausaufgabe')),

  guildOnly(
    new SlashCommandBuilder()
      .setName('feueralarm')
      .setDescription('🚨 Feueralarm: alle aus den Sprachkanälen auf den Pausenhof (und zurück)')
      .setDefaultMemberPermissions(P.ManageGuild),
  ),

  guildOnly(
    new SlashCommandBuilder()
      .setName('automatik')
      .setDescription('Automatischen Unsinn an-/ausschalten')
      .setDefaultMemberPermissions(P.ManageGuild)
      .addSubcommand((s) => s.setName('status').setDescription('Was ist an, was ist aus?'))
      .addSubcommand((s) =>
        s
          .setName('setzen')
          .setDescription('Eine Funktion an- oder ausschalten')
          .addStringOption((o) =>
            o
              .setName('funktion')
              .setDescription('Welche?')
              .setRequired(true)
              .addChoices(...Object.entries(AUTOMATIK).map(([value, name]) => ({ name, value }))),
          )
          .addBooleanOption((o) => o.setName('aktiv').setDescription('An oder aus').setRequired(true)),
      ),
  ),

  guildOnly(
    new SlashCommandBuilder()
      .setName('namensroulette')
      .setDescription('Jeden Tag ein dummer Spitzname für eine Person (nur wer mitmacht)')
      .addSubcommand((s) => s.setName('mitmachen').setDescription('Ich mach mit!'))
      .addSubcommand((s) => s.setName('aussteigen').setDescription('Ich will meinen Namen zurück'))
      .addSubcommand((s) => s.setName('liste').setDescription('Wer macht mit?'))
      .addSubcommand((s) => s.setName('drehen').setDescription('Sofort drehen (nur mit „Server verwalten“)')),
  ),
].map((c) => c.toJSON());
