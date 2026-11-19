// Rollen-Lotterie: Knopf drücken, zufällige Quatsch-Rolle bekommen.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { LOTTERY_ROLES } from './layout.js';
import { chance, logError, pick } from '../util.js';

const cooldown = new Map(); // userId -> Zeitstempel
const COOLDOWN_MS = 15_000;

export function lotteryMessage() {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe91e63)
        .setTitle('🎰 Rollen-Lotterie')
        .setDescription(
          'Drück den Knopf und bekomme eine zufällige Rolle!\n' +
            'Deine alte Lotterie-Rolle verfällt dabei. Kein Umtausch. Keine Rückgabe.\n\n' +
            `Mögliche Gewinne:\n${LOTTERY_ROLES.map((r) => `• ${r.name}`).join('\n')}`,
        )
        .setFooter({ text: 'Glücksspiel kann süchtig machen. Diese Lotterie nicht, sie ist zu schlecht.' }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('lotto:pull').setLabel('🎰 Hebel ziehen').setStyle(ButtonStyle.Success),
      ),
    ],
  };
}

export async function handleLottery(interaction) {
  const ephemeral = { flags: MessageFlags.Ephemeral };
  const last = cooldown.get(interaction.user.id) ?? 0;
  const wait = Math.ceil((last + COOLDOWN_MS - Date.now()) / 1000);
  if (wait > 0) {
    return interaction.reply({ content: `🛑 Spielsucht-Prävention: Bitte warte noch ${wait} Sekunden.`, ...ephemeral });
  }
  cooldown.set(interaction.user.id, Date.now());

  if (chance(0.07)) {
    return interaction.reply({ content: '💰 **JACKPOT!!!** Du gewinnst: nichts. Herzlichen Glückwunsch.', ...ephemeral });
  }

  const guild = interaction.guild;
  const member = interaction.member;
  const lotteryRoles = LOTTERY_ROLES.map((r) => guild.roles.cache.find((gr) => gr.name === r.name)).filter(Boolean);
  if (lotteryRoles.length === 0) {
    return interaction.reply({ content: 'Die Lotterie-Rollen fehlen. Ein Admin muss `/setup` ausführen.', ...ephemeral });
  }

  const won = pick(lotteryRoles);
  try {
    const old = lotteryRoles.filter((r) => member.roles.cache.has(r.id) && r.id !== won.id);
    if (old.length) await member.roles.remove(old, 'Lotterie');
    await member.roles.add(won, 'Lotterie');
  } catch (err) {
    logError('lottery', err);
    return interaction.reply({ content: 'Die Lotterie-Maschine klemmt. (Mir fehlen Rechte für Rollen.)', ...ephemeral });
  }
  return interaction.reply({ content: `🎰 *ratter ratter ratter* … **${won.name}**! Steht dir.`, ...ephemeral });
}
