// Das sinnlose Captcha. Acht Schritte, die nichts beweisen außer Geduld.
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  escapeMarkdown,
} from 'discord.js';
import { chance, pick, randInt, shuffle, sleep, truncate, logError } from '../util.js';
import { findChannel, findRole } from './roles.js';
import { INSIDER_CAPTCHA } from '../insider.js';

const STEPS = ['robot', 'grid', 'math', 'reverse', 'prime', 'loading', 'confirm', 'final'];
const SESSION_TTL = 30 * 60 * 1000;

/** userId -> { step, data, fails, startedAt, guildId } */
const sessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.startedAt > SESSION_TTL) sessions.delete(id);
}, 5 * 60 * 1000).unref();

const btn = (id, label, style = ButtonStyle.Secondary, disabled = false) =>
  new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
const row = (...components) => new ActionRowBuilder().addComponents(components);

// ---------------------------------------------------------------------------
// Inhalte
// ---------------------------------------------------------------------------
const ROBOT_ANSWERS = {
  ja: 'Ehrlich. Gefällt mir. Du darfst trotzdem weitermachen.',
  nein: 'Das würde ein Roboter auch sagen. 🤨 Weiter.',
  beep: 'Beep Boop zurück, Bruder. 🤖 Weiter.',
  weissnicht: 'Verständlich. Wer weiß das schon so genau. Weiter.',
};

const LIGHTS = ['🚦', '🚥'];
const NOT_LIGHTS = ['🦆', '🍕', '🧦', '🚗', '🌭', '🥔', '🚲', '🌳', '🐸', '🚌', '🧀', '🛹'];

const MATH = [
  { q: 'Was ist 7 × 6?', a: '42', wrong: ['41', '43', 'Mittwoch'] },
  { q: 'Was ist 0,1 + 0,2? (laut JavaScript)', a: '0.30000000000000004', wrong: ['0.3', '0.2', 'Kartoffel'] },
  { q: 'Was ergibt 🍌 + 🍌?', a: 'Obstsalat', wrong: ['2🍌', '🍌🍌', 'Banane²'] },
  { q: 'Wie viele Seiten hat ein Kreis?', a: 'Zwei (innen und außen)', wrong: ['0', '1', 'Unendlich'] },
  { q: 'Was ist 2 + 2 × 2?', a: '6', wrong: ['8', '4', '22'] },
  { q: 'Wie viele Löcher hat ein Strohhalm?', a: 'Diese Frage zerstört Freundschaften', wrong: ['1', '2', '0'] },
  ...INSIDER_CAPTCHA,
];

const PHRASE = 'Ich bin kein Roboter';
const PHRASE_REVERSED = [...PHRASE].reverse().join('');

const PRIME_HINTS = { 1: 'Sieht prim aus', 9: 'Fühlt sich prim an', 15: 'Ist bestimmt prim', 21: 'Blackjack-Prim', 25: 'Viertel-Hundert-Prim' };

const LOADING_FRAMES = [
  [0, 'Seele wird gescannt…'],
  [13, 'Hausaufgaben werden geladen…'],
  [37, 'Ampeln werden nachgezählt…'],
  [64, 'Mama wird um Erlaubnis gefragt…'],
  [99, 'Fast fertig…'],
  [99, 'Immer noch fast fertig…'],
  [99, 'Wirklich gleich…'],
  [100, 'Fertig! Glauben wir.'],
];

const FAIL_REASONS = [
  'Mondphase ungünstig 🌘',
  'Du hast zu menschlich geklickt',
  'Zu viele Ampeln im Umkreis',
  'Der Captcha-Praktikant hat gerade Pause',
  'Fehlercode 418: Ich bin eine Teekanne ☕',
  'Dein WLAN war zu laut',
];

// ---------------------------------------------------------------------------
// Darstellung
// ---------------------------------------------------------------------------
function embed(session, title, text, note, color = 0x9b59b6) {
  const n = STEPS.indexOf(session.step) + 1;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`🤖 Captcha – ${title}`)
    .setDescription((note ? `> ${note}\n\n` : '') + text)
    .setFooter({ text: `Schritt ${n} von ${n + randInt(1, 3)} · Fehlversuche: ${session.fails}` });
}

function newGrid() {
  const lightCount = randInt(3, 4);
  const cells = shuffle([
    ...Array.from({ length: lightCount }, () => pick(LIGHTS)),
    ...shuffle(NOT_LIGHTS).slice(0, 9 - lightCount),
  ]);
  return { cells, selected: [] };
}

function newMath() {
  const m = pick(MATH);
  return { question: m.q, answer: m.a, options: shuffle([m.a, ...m.wrong]) };
}

function render(session, note) {
  const s = session;
  switch (s.step) {
    case 'robot':
      return {
        embeds: [embed(s, 'Identitätsprüfung', '**Bist du ein Roboter?**\nBitte ehrlich antworten. Lügen wird mit weiteren Captchas bestraft.', note)],
        components: [
          row(
            btn('cap:robot:ja', 'Ja'),
            btn('cap:robot:nein', 'Nein'),
            btn('cap:robot:beep', 'Beep Boop'),
            btn('cap:robot:weissnicht', 'Weiß ich nicht mehr'),
          ),
        ],
      };

    case 'grid': {
      const { cells, selected } = s.data.grid;
      const rows = [0, 1, 2].map((r) =>
        row(
          ...[0, 1, 2].map((c) => {
            const i = r * 3 + c;
            return new ButtonBuilder()
              .setCustomId(`cap:grid:${i}`)
              .setEmoji(cells[i])
              .setStyle(selected.includes(i) ? ButtonStyle.Success : ButtonStyle.Secondary);
          }),
        ),
      );
      rows.push(row(btn('cap:grid:ok', '✅ Bestätigen', ButtonStyle.Primary), btn('cap:grid:none', 'Hier sind keine Ampeln')));
      return {
        embeds: [
          embed(
            s,
            'Bilderrätsel',
            '**Wähle alle Felder mit Ampeln aus.**\nWenn keine mehr übrig sind, klicke auf Bestätigen. Wenn doch noch welche übrig sind, auch.',
            note,
          ),
        ],
        components: rows,
      };
    }

    case 'math': {
      const m = s.data.math;
      return {
        embeds: [embed(s, 'Mathematik', `**${m.question}**\nTaschenrechner sind erlaubt. Sie helfen aber nicht.`, note)],
        components: [row(...m.options.map((o, i) => btn(`cap:math:${i}`, truncate(o, 80))))],
      };
    }

    case 'reverse':
      return {
        embeds: [
          embed(s, 'Sprachtest', `**Schreibe „${PHRASE}" rückwärts.**\nGroß- und Kleinschreibung ist egal. Dein Stolz nicht.`, note),
        ],
        components: [row(btn('cap:rev:open', '✏️ Antwort eingeben', ButtonStyle.Primary))],
      };

    case 'prime': {
      const menu = new StringSelectMenuBuilder()
        .setCustomId('cap:prime')
        .setPlaceholder('Lieblings-Primzahl auswählen…')
        .addOptions(
          Array.from({ length: 25 }, (_, i) => {
            const n = i + 1;
            const opt = { label: String(n), value: String(n) };
            if (PRIME_HINTS[n]) opt.description = PRIME_HINTS[n];
            return opt;
          }),
        );
      return {
        embeds: [embed(s, 'Persönlichkeitstest', '**Wähle deine Lieblings-Primzahl.**\nEs gibt keine falsche Antwort. Außer den falschen.', note)],
        components: [row(menu)],
      };
    }

    case 'loading': {
      const [p, label] = LOADING_FRAMES[s.data.frame ?? 0];
      const filled = Math.floor(p / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
      const done = p === 100;
      return {
        embeds: [embed(s, 'Überprüfung', `\`${bar}\` **${p}%**\n${label}`, note)],
        components: done ? [row(btn('cap:load:done', 'Weiter ▶', ButtonStyle.Primary))] : [],
      };
    }

    case 'confirm': {
      const stage = s.data.confirm ?? 0;
      if (stage === 0) {
        return {
          embeds: [embed(s, 'Bestätigung', '**Bitte bestätige, dass du bestätigen möchtest.**', note)],
          components: [row(btn('cap:confirm:0', '✅ Bestätigen', ButtonStyle.Success))],
        };
      }
      if (stage === 1) {
        return {
          embeds: [embed(s, 'Bestätigung der Bestätigung', '**Bitte bestätige jetzt die Bestätigung.**', note)],
          components: [
            row(btn('cap:confirm:1', '✅ Bestätigung bestätigen', ButtonStyle.Success), btn('cap:nope', '❌ Abbrechen', ButtonStyle.Danger, true)),
          ],
        };
      }
      return {
        embeds: [embed(s, 'Letzte Rückfrage', '**Bist du dir sicher, dass du die Bestätigung bestätigt hast?**', note)],
        components: [row(btn('cap:confirm:2', 'Ja', ButtonStyle.Primary), btn('cap:confirm:2', 'Ja, aber in Grün', ButtonStyle.Success).setCustomId('cap:confirm:2g'))],
      };
    }

    case 'final':
      return {
        embeds: [
          embed(
            s,
            'Ergebnis',
            `❌ **Captcha fehlgeschlagen.**\nGrund: ${s.data.failReason}\n\nDu kannst Einspruch einlegen. Einsprüche werden innerhalb von 3–5 Werktagen bearbeitet.`,
            note,
            0xe74c3c,
          ),
        ],
        components: [row(btn('cap:appeal', '📝 Einspruch einlegen', ButtonStyle.Primary))],
      };

    default:
      return { content: 'Unbekannter Schritt. Das Captcha hat sich verlaufen.', embeds: [], components: [] };
  }
}

function nextStep(session) {
  session.step = STEPS[STEPS.indexOf(session.step) + 1];
  if (session.step === 'grid') session.data.grid = newGrid();
  if (session.step === 'math') session.data.math = newMath();
  if (session.step === 'loading') session.data.frame = 0;
  if (session.step === 'confirm') session.data.confirm = 0;
}

// ---------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------
export async function startCaptcha(interaction) {
  const session = { step: 'robot', data: {}, fails: 0, startedAt: Date.now(), guildId: interaction.guildId };
  sessions.set(interaction.user.id, session);
  return interaction.update({ content: '', ...render(session) });
}

/** Ladebalken animieren (bearbeitet die ephemere Nachricht mehrmals). */
async function animateLoading(interaction, session) {
  for (let f = 1; f < LOADING_FRAMES.length; f++) {
    await sleep(randInt(1100, 1900));
    if (sessions.get(interaction.user.id) !== session || session.step !== 'loading') return;
    session.data.frame = f;
    await interaction.editReply(render(session));
  }
}

async function finish(interaction, session, respond) {
  sessions.delete(interaction.user.id);
  const guild = interaction.guild;
  const role = guild && findRole(guild, 'verified');
  if (!role) {
    return respond({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('🙈 Peinlich').setDescription('Die Verifiziert-Rolle gibt es nicht. Ein Admin muss erst `/setup` ausführen.')],
      components: [],
    });
  }
  try {
    await interaction.member.roles.add(role, 'Captcha bestanden (irgendwie)');
  } catch (err) {
    logError('captcha:role', err);
    return respond({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🙈 Das hat nicht geklappt')
          .setDescription('Ich darf dir die Rolle nicht geben. Ein Admin muss meine Rolle in den Servereinstellungen ganz nach oben schieben.'),
      ],
      components: [],
    });
  }
  const seconds = Math.round((Date.now() - session.startedAt) / 1000);
  const regeln = findChannel(guild, 'realRules');
  return respond({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🎉 Verifiziert (vielleicht)!')
        .setDescription(
          'Herzlichen Glückwunsch, du hast das Captcha bestanden und bist jetzt auf dem Server.\n\n' +
            `Die Regeln findest du in ${regeln ? `<#${regeln.id}>` : '#regeln'}. Diesmal stehen sie wirklich da.\n\n` +
            `⏱️ Benötigte Zeit: **${seconds} Sekunden** (Rekord: 3 Sekunden, gelogen)\n` +
            `💥 Fehlversuche: **${session.fails}**`,
        ),
    ],
    components: [],
  });
}

export async function handleCaptcha(interaction, action, arg) {
  if (action === 'restart') return startCaptcha(interaction);
  const session = sessions.get(interaction.user.id);

  if (!session) {
    return interaction.reply({
      content: '⌛ Deine Captcha-Sitzung ist abgelaufen (der Bot hat sie vergessen). Fang nochmal an:',
      components: [row(btn('cap:restart', '🔁 Nochmal von vorne', ButtonStyle.Primary))],
      flags: MessageFlags.Ephemeral,
    });
  }
  const stepFor = { robot: 'robot', grid: 'grid', math: 'math', rev: 'reverse', revmodal: 'reverse', prime: 'prime', load: 'loading', confirm: 'confirm', appeal: 'final' };
  if (stepFor[action] !== session.step) {
    return interaction.reply({ content: 'Dieser Knopf ist veraltet. Wie dein Handy. Benutze die neueste Captcha-Nachricht.', flags: MessageFlags.Ephemeral });
  }

  switch (action) {
    case 'robot': {
      const note = ROBOT_ANSWERS[arg] ?? 'Interessante Antwort. Weiter.';
      nextStep(session);
      return interaction.update(render(session, note));
    }

    case 'grid': {
      const grid = session.data.grid;
      if (arg === 'none') return interaction.update(render(session, 'Doch. Da sind Ampeln. Ich sehe sie. Du siehst sie. Wir alle sehen sie.'));
      if (arg === 'ok') {
        const correct = grid.cells.map((c, i) => (LIGHTS.includes(c) ? i : -1)).filter((i) => i >= 0);
        const ok = correct.length === grid.selected.length && correct.every((i) => grid.selected.includes(i));
        if (ok) {
          nextStep(session);
          return interaction.update(render(session, `Korrekt. Du hast ${correct.length} Ampeln gefunden. Die Verkehrspolizei bedankt sich.`));
        }
        session.fails++;
        session.data.grid = newGrid();
        const decoy = pick(NOT_LIGHTS);
        return interaction.update(render(session, `Falsch. Das ${decoy} war übrigens eine Ampel. (Nein, war es nicht.) Neues Bild:`));
      }
      const i = Number(arg);
      grid.selected = grid.selected.includes(i) ? grid.selected.filter((x) => x !== i) : [...grid.selected, i];
      return interaction.update(render(session));
    }

    case 'math': {
      const m = session.data.math;
      if (m.options[Number(arg)] === m.answer) {
        nextStep(session);
        return interaction.update(render(session, 'Richtig! Du bist jetzt offiziell schlauer als ein Taschenrechner.'));
      }
      session.fails++;
      session.data.math = newMath();
      return interaction.update(render(session, 'Falsch. Das Mathe-Ministerium wurde informiert. Neue Frage:'));
    }

    case 'rev': {
      const modal = new ModalBuilder()
        .setCustomId('cap:revmodal')
        .setTitle('Rückwärts-Test')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('antwort')
              .setLabel(`„${PHRASE}" rückwärts`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('rettel nednE riw tim nahcsuz')
              .setRequired(true)
              .setMaxLength(60),
          ),
        );
      return interaction.showModal(modal);
    }

    case 'revmodal': {
      const input = interaction.fields.getTextInputValue('antwort');
      const norm = (t) => t.toLowerCase().replace(/\s+/g, ' ').trim();
      const reply = (payload) => (interaction.isFromMessage() ? interaction.update(payload) : interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }));
      if (norm(input) === norm(PHRASE_REVERSED)) {
        nextStep(session);
        return reply(render(session, 'Perfekt. Du kannst rückwärts schreiben. Das kann kein Roboter. Glauben wir.'));
      }
      session.fails++;
      return reply(render(session, `Falsch. Du hast „${escapeMarkdown(truncate(input, 60))}" geschrieben. Tipp: Fang hinten an.`));
    }

    case 'prime': {
      const n = Number(interaction.values[0]);
      if (n === 1) {
        session.fails++;
        return interaction.update(render(session, '1 ist keine Primzahl. Das ist ein weit verbreiteter Irrtum. Schäm dich ein bisschen.'));
      }
      const factor = [2, 3, 5].find((f) => n % f === 0 && n !== f);
      if (factor) {
        session.fails++;
        return interaction.update(render(session, `${n} ist keine Primzahl. ${n} = ${factor} × ${n / factor}. Nochmal.`));
      }
      nextStep(session);
      await interaction.update(render(session, `${n}? Gute Wahl. Sehr prim.`));
      animateLoading(interaction, session).catch((err) => logError('captcha:loading', err));
      return;
    }

    case 'load':
      nextStep(session);
      return interaction.update(render(session));

    case 'confirm': {
      const stage = session.data.confirm ?? 0;
      if (stage < 2) {
        session.data.confirm = stage + 1;
        return interaction.update(render(session));
      }
      if (chance(0.3)) {
        nextStep(session); // -> 'final' (fehlgeschlagen, Einspruch möglich)
        session.data.failReason = pick(FAIL_REASONS);
        return interaction.update(render(session));
      }
      return finish(interaction, session, (p) => interaction.update(p));
    }

    case 'appeal': {
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('📝 Einspruch wird geprüft…').setDescription('Bitte warten. Ein Beamter liest gerade deinen Einspruch. Er liest langsam.')],
        components: [],
      });
      await sleep(3000);
      return finish(interaction, session, (p) =>
        interaction.editReply({
          ...p,
          content: '✅ **Einspruch stattgegeben.** Der Mond steht jetzt richtig.',
        }),
      );
    }

    default:
      return interaction.reply({ content: 'Hä?', flags: MessageFlags.Ephemeral });
  }
}
