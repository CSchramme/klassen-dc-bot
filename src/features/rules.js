// Regeln: Startnachricht im Eingang, seitenweises Durchblättern, Akzeptieren -> Captcha.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { RULE_PAGES } from './layout.js';
import { startCaptcha } from './captcha.js';
import { isVerified } from './roles.js';

const btn = (id, label, style = ButtonStyle.Secondary, disabled = false) =>
  new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);

/** Die Nachricht im Kanal #start-hier-vielleicht. */
export function startMessage() {
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('👋 Willkommen im Hintereingang!')
    .setDescription(
      'Um den Server zu betreten, musst du:\n' +
        '1. die Regeln lesen (alle Seiten),\n' +
        '2. die Regeln akzeptieren,\n' +
        '3. ein kleines Captcha lösen.\n\n' +
        'Geschätzte Dauer: **2 bis 45 Minuten**.\n' +
        '_Der Vordereingang ist leider seit 2009 wegen Bauarbeiten geschlossen._',
    )
    .setFooter({ text: 'Formular E-1 · Eingangsprüfung' });

  const row = new ActionRowBuilder().addComponents(
    btn('rules:open', '📜 Regeln lesen (Pflicht)', ButtonStyle.Primary),
    btn('rules:skip', '⏩ Regeln überspringen'),
    btn('rules:direkt', '🤖 Direkt zum Captcha'),
  );
  return { embeds: [embed], components: [row] };
}

/** Eine Seite der Regeln (ephemeral). */
export function rulesPage(i) {
  const page = RULE_PAGES[i];
  const last = i === RULE_PAGES.length - 1;
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`📜 Regeln – ${page.title}`)
    .setDescription(page.text)
    .setFooter({ text: `Seite ${i + 1} von ${RULE_PAGES.length} · Bitte nicht vorblättern` });

  const buttons = [btn(`rules:page:${i - 1}`, '◀ Zurück', ButtonStyle.Secondary, i === 0)];
  if (last) {
    buttons.push(btn('rules:accept', '✅ Akzeptieren', ButtonStyle.Success), btn('rules:decline', '❌ Ablehnen', ButtonStyle.Danger));
  } else {
    buttons.push(btn(`rules:page:${i + 1}`, 'Weiter ▶', ButtonStyle.Primary));
  }
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(buttons)] };
}

/** Alle Regeln am Stück (für #wer-hat-meine-socke-gesehen). */
export function allRulesMessage() {
  const embeds = RULE_PAGES.map((p, i) =>
    new EmbedBuilder()
      .setColor(i === 1 ? 0xe74c3c : 0x3498db)
      .setTitle(i === 0 ? `📜 DIE ECHTEN REGELN – ${p.title}` : p.title)
      .setDescription(p.text),
  );
  return { content: '🧦 Socke immer noch nicht gefunden. Dafür hier die Regeln:', embeds };
}

export async function handleRules(interaction, action, arg) {
  const ephemeral = { flags: MessageFlags.Ephemeral };

  switch (action) {
    case 'open':
      if (isVerified(interaction.member)) {
        return interaction.reply({ content: 'Du bist schon verifiziert. Du kannst die Regeln aber gerne nochmal lesen. Freiwillig. Sagt keiner was.', ...rulesPage(0), ...ephemeral });
      }
      return interaction.reply({ ...rulesPage(0), ...ephemeral });

    case 'page': {
      const i = Math.max(0, Math.min(RULE_PAGES.length - 1, Number(arg) || 0));
      return interaction.update(rulesPage(i));
    }

    case 'skip':
      return interaction.reply({ content: 'Nein.', ...ephemeral });

    case 'direkt':
      return interaction.reply({
        content: 'Erst die Regeln lesen. Für das Überspringen der Regeln gibt es leider kein Captcha. Wir arbeiten daran.',
        ...ephemeral,
      });

    case 'decline':
      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('❌ Ablehnung abgelehnt')
            .setDescription('Dein Antrag auf Ablehnung der Regeln wurde abgelehnt.\nBitte akzeptiere die Regeln.'),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            btn('rules:accept', '✅ Akzeptieren', ButtonStyle.Success),
            btn('rules:decline2', '😤 Trotzdem ablehnen', ButtonStyle.Danger),
          ),
        ],
      });

    case 'decline2':
      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle('📎 Okay.')
            .setDescription('Du hast abgelehnt. Gemäß §9 gilt Ablehnen als Akzeptieren.\nBitte bestätige das, indem du akzeptierst.'),
        ],
        components: [new ActionRowBuilder().addComponents(btn('rules:accept', '✅ Akzeptieren', ButtonStyle.Success))],
      });

    case 'accept':
      return startCaptcha(interaction);

    default:
      return interaction.reply({ content: 'Dieser Knopf existiert nicht. Du hast ihn trotzdem gedrückt. Respekt.', ...ephemeral });
  }
}
