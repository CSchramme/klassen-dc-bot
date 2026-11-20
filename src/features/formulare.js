// Nervige Formulare: mehrseitig, mit absurden Pflichtangaben, Bescheid und Widerspruchsformular.
// Discord erlaubt nur 5 Felder pro Formular-Fenster, deshalb geht es Seite für Seite weiter.
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { pick, randInt, truncate } from '../util.js';
import { insiderNames } from '../insider.js';
import { zaehle } from '../chronik.js';

const SESSION_TTL = 30 * 60 * 1000;
const sessions = new Map(); // userId -> { form, page, answers, startedAt, prefill }

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.startedAt > SESSION_TTL) sessions.delete(id);
}, 5 * 60 * 1000).unref();

const norm = (v) => v.toLowerCase().replace(/[.!\s]+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Seiten, die in fast jedem Formular vorkommen
// ---------------------------------------------------------------------------
const PERSONALIEN = {
  title: 'Personalien',
  fields: [
    {
      id: 'nachname',
      label: 'Nachname (in GROSSBUCHSTABEN)',
      desc: 'Kleinbuchstaben führen zur Ablehnung des gesamten Antrags.',
      max: 40,
      check: (v) => (v !== v.toUpperCase() ? 'Nachname nicht in GROSSBUCHSTABEN (Seite 1)' : null),
    },
    { id: 'vorname', label: 'Vorname (rückwärts geschrieben)', desc: 'Beispiel: Willy → ylliW', max: 40 },
    { id: 'anrede', label: 'Anrede', type: 'select', options: ['Herr', 'Frau', 'Divers', 'Ente', 'Kartoffel', 'Keine Angabe', 'Doch eine Angabe'] },
    { id: 'klasse', label: 'Klasse, Raum und Lieblingsfarbe von Raum', placeholder: 'z. B. 10b, 204, beige', max: 60 },
    {
      id: 'ampeln',
      label: 'Wie viele Ampeln haben Sie heute gesehen?',
      desc: 'Nur ganze Zahlen. Halbe Ampeln bitte aufrunden.',
      max: 6,
      check: (v) => (!/^\d+$/.test(v.trim()) ? 'Ampel-Anzahl ist keine ganze Zahl (Seite 1)' : null),
    },
  ],
};

const ERKLAERUNG = {
  title: 'Erklärung',
  fields: [
    {
      id: 'bestaetigung',
      label: 'Bestätigung',
      desc: 'Bitte exakt eintippen: Ja, ich bestätige hiermit ausdrücklich',
      max: 80,
      check: (v) => (norm(v) !== norm('Ja, ich bestätige hiermit ausdrücklich') ? 'Bestätigungssatz nicht exakt eingetippt (letzte Seite)' : null),
    },
    { id: 'unterschrift', label: 'Unterschrift', desc: 'Bitte mit der Tastatur zeichnen.', para: true, min: 5, max: 300, placeholder: '~~~~~ ✍️' },
    { id: 'ortdatum', label: 'Ort, Datum', desc: 'Das Datum bitte von morgen.', max: 60 },
    {
      id: 'erfahren',
      label: 'Wie haben Sie von diesem Formular erfahren?',
      type: 'select',
      options: ['Durch Willy', 'Durch Zufall', 'Durch eine Ente', 'Es hat mich gefunden', 'Ich bin das Formular'],
    },
    {
      id: 'nichts',
      label: 'Bitte HIER NICHTS eintragen',
      desc: 'Dieses Feld muss leer bleiben. Auch keine Leerzeichen.',
      required: false,
      max: 10,
      check: (v) => (v.length > 0 ? 'Das Feld „Bitte HIER NICHTS eintragen“ enthielt etwas (letzte Seite)' : null),
    },
  ],
};

const intCheck = (seite, min = 0) => (v) => (!/^\d+$/.test(v.trim()) || Number(v) < min ? `Keine gültige ganze Zahl${min ? ` (mindestens ${min})` : ''} (Seite ${seite})` : null);

// ---------------------------------------------------------------------------
// Die Formulare
// ---------------------------------------------------------------------------
export const FORMS = {
  klo: {
    code: 'WC-1',
    name: '🚽 Antrag auf Toilettengang',
    pages: [
      PERSONALIEN,
      {
        title: 'Antragsgegenstand',
        fields: [
          { id: 'dringlichkeit', label: 'Dringlichkeit', type: 'select', options: ['niedrig', 'mittel', 'hoch', 'SEHR HOCH', 'zu spät'] },
          {
            id: 'uhrzeit',
            label: 'Gewünschte Uhrzeit',
            desc: 'Format: HH:MM:SS,mmm (mit Millisekunden)',
            placeholder: '10:15:00,000',
            max: 12,
            check: (v) => (!/^\d{2}:\d{2}:\d{2},\d{3}$/.test(v.trim()) ? 'Uhrzeit nicht im Format HH:MM:SS,mmm (Seite 2)' : null),
          },
          { id: 'begruendung', label: 'Begründung (mindestens 80 Zeichen)', para: true, min: 80, max: 1000 },
          {
            id: 'dauer',
            label: 'Voraussichtliche Dauer in Minuten',
            desc: 'Bitte mit Kommastelle, z. B. 3,5',
            max: 8,
            check: (v) => (!/^\d+,\d+$/.test(v.trim()) ? 'Dauer ohne Kommastelle angegeben (Seite 2)' : null),
          },
          { id: 'reserviert', label: 'Wurde die Toilette bereits reserviert?', type: 'select', options: ['Ja', 'Nein', 'Man kann reservieren?'] },
        ],
      },
      ERKLAERUNG,
    ],
  },
  pause: {
    code: 'P-7',
    name: '☕ Antrag auf Pausenverlängerung',
    pages: [
      PERSONALIEN,
      {
        title: 'Pausendaten',
        fields: [
          { id: 'sekunden', label: 'Gewünschte Verlängerung in Sekunden', max: 6, check: intCheck(2, 1) },
          { id: 'grund', label: 'Hauptgrund', type: 'select', options: ['Hunger', 'Durst', 'Müdigkeit', 'Mathe', 'Alles davon'] },
          { id: 'begruendung', label: 'Begründung (mind. 100 Zeichen, gereimt)', para: true, min: 100, max: 1000 },
          { id: 'zeuge', label: 'Name einer Person, die Ihre Pause bezeugt', max: 40 },
          {
            id: 'kaffee',
            label: 'Haltung zur Kaffeemaschine im Lehrerzimmer',
            type: 'select',
            options: ['Neutral', 'Besorgt', 'Sie ist kaputt', 'Welche Kaffeemaschine?'],
          },
        ],
      },
      ERKLAERUNG,
    ],
  },
  fenster: {
    code: 'F-12',
    name: '🪟 Antrag auf Fensteröffnung',
    pages: [
      PERSONALIEN,
      {
        title: 'Fensterangaben',
        fields: [
          { id: 'welches', label: 'Welches Fenster?', desc: 'Bitte so genau beschreiben, dass man es blind findet.', para: true, min: 40, max: 500 },
          { id: 'winkel', label: 'Gewünschter Öffnungswinkel in Grad', desc: 'Nur ganze Zahlen zwischen 1 und 180.', max: 3, check: intCheck(2, 1) },
          { id: 'wetter', label: 'Aktuelles Wetter', type: 'select', options: ['Sonnig', 'Regen', 'Schnee', 'Weiß nicht, Fenster ist zu'] },
          { id: 'frischluft', label: 'Warum Frischluft? (mindestens 60 Zeichen)', para: true, min: 60, max: 1000 },
          { id: 'schliessen', label: 'Wer schließt das Fenster danach?', max: 40 },
        ],
      },
      ERKLAERUNG,
    ],
  },
  hausaufgaben: {
    code: 'HA-0',
    name: '📚 Antrag auf Hausaufgabenbefreiung',
    pages: [
      PERSONALIEN,
      {
        title: 'Hausaufgabe',
        fields: [
          { id: 'fach', label: 'Fach', type: 'select', options: ['Mathe', 'Deutsch', 'Englisch', 'Bio', 'Physik', 'Chemie', 'Geschichte', 'Alle'] },
          {
            id: 'ausrede',
            label: 'Ihre Ausrede (mind. 120 Zeichen)',
            desc: 'Ausreden mit Hund werden nicht akzeptiert.',
            para: true,
            min: 120,
            max: 1000,
            check: (v) => (/hund/i.test(v) ? 'Ausrede enthält einen Hund (Seite 2)' : null),
          },
          { id: 'seiten', label: 'Wie viele Seiten hätten Sie geschrieben?', max: 4, check: intCheck(2) },
          { id: 'chance', label: 'Wahrscheinlichkeit, dass Sie sie nachholen', type: 'select', options: ['0 %', '1 %', '99 %', 'Hängt vom Ladebalken ab'] },
          { id: 'reue', label: 'Zeigen Sie Reue (mindestens 50 Zeichen)', para: true, min: 50, max: 1000 },
        ],
      },
      ERKLAERUNG,
    ],
  },
  formular: {
    code: '27b/6',
    name: '📎 Antrag auf ein Antragsformular',
    pages: [
      PERSONALIEN,
      {
        title: 'Gewünschtes Formular',
        fields: [
          { id: 'welches', label: 'Welches Antragsformular möchten Sie?', type: 'select', options: ['WC-1', 'P-7', 'F-12', 'HA-0', 'Ein anderes'] },
          { id: 'wozu', label: 'Wozu brauchen Sie es? (mindestens 80 Zeichen)', para: true, min: 80, max: 1000 },
          { id: 'vorher', label: 'Haben Sie bereits ein Antragsformular?', type: 'select', options: ['Nein', 'Ja, aber das falsche', 'Ja, aber verloren', 'Was ist ein Antragsformular?'] },
          { id: 'kopien', label: 'Anzahl der Durchschläge', desc: 'Mindestens 3.', max: 3, check: intCheck(2, 3) },
          { id: 'stempel', label: 'Gewünschte Stempelfarbe', type: 'select', options: ['Rot', 'Blau', 'Durchsichtig'] },
        ],
      },
      ERKLAERUNG,
    ],
  },
  // Nicht direkt auswählbar: kommen über Knöpfe
  widerspruch: {
    code: 'W-1',
    name: '⚖️ Widerspruch gegen einen Bescheid',
    hidden: true,
    pages: [
      PERSONALIEN,
      {
        title: 'Widerspruch',
        fields: [
          { id: 'aktenzeichen', label: 'Aktenzeichen des Bescheids', max: 20, prefill: (s) => s.prefill?.aktenzeichen },
          { id: 'grund', label: 'Begründung (mindestens 150 Zeichen)', para: true, min: 150, max: 1000 },
          { id: 'gefuehl', label: 'Wie fühlen Sie sich?', type: 'select', options: ['Ungerecht behandelt', 'Sehr ungerecht behandelt', 'Wie eine Ente', 'Eigentlich okay'] },
        ],
      },
      ERKLAERUNG,
    ],
  },
  abbruch: {
    code: 'AB-1',
    name: '🛑 Antrag auf Abbruch eines Antrags',
    hidden: true,
    pages: [
      {
        title: 'Abbruch',
        fields: [
          { id: 'grund', label: 'Grund des Abbruchs', type: 'select', options: ['Keine Lust', 'Zu lang', 'Zu viele Seiten', 'Willy'] },
          {
            id: 'sicher',
            label: 'Sind Sie sicher?',
            desc: 'Bitte „ganz sicher“ eintippen.',
            max: 20,
            check: (v) => (norm(v) !== 'ganz sicher' ? 'Nicht „ganz sicher“ eingetippt' : null),
          },
          { id: 'feedback', label: 'Wie können wir das Formular länger machen?', para: true, required: false, max: 1000 },
        ],
      },
    ],
  },
};

export const FORM_CHOICES = Object.entries(FORMS)
  .filter(([, f]) => !f.hidden)
  .map(([value, f]) => ({ name: `${f.name} (${f.code})`, value }));

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------
function pageModal(session) {
  const form = FORMS[session.form];
  const page = form.pages[session.page];
  const modal = new ModalBuilder()
    .setCustomId(`form:submit:${session.page}`)
    .setTitle(truncate(`${form.code} · ${page.title} (Seite ${session.page + 1}/${form.pages.length})`, 45));
  for (const f of page.fields) {
    const label = new LabelBuilder().setLabel(f.label);
    if (f.desc) label.setDescription(f.desc);
    if (f.type === 'select') {
      label.setStringSelectMenuComponent(
        new StringSelectMenuBuilder()
          .setCustomId(f.id)
          .setPlaceholder('Bitte auswählen …')
          .addOptions(f.options.map((o) => ({ label: o, value: o }))),
      );
    } else {
      const input = new TextInputBuilder()
        .setCustomId(f.id)
        .setStyle(f.para ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(f.required !== false)
        .setMaxLength(f.max ?? (f.para ? 1000 : 100));
      if (f.min) input.setMinLength(f.min);
      if (f.placeholder) input.setPlaceholder(f.placeholder);
      const prefill = f.prefill?.(session);
      if (prefill) input.setValue(prefill);
      label.setTextInputComponent(input);
    }
    modal.addLabelComponents(label);
  }
  return modal;
}

function progress(session) {
  const form = FORMS[session.form];
  const done = session.page / form.pages.length;
  const filled = Math.round(done * 10);
  return `\`${'█'.repeat(filled)}${'░'.repeat(10 - filled)}\` ${Math.round(done * 100)} % · geschätzte Restdauer: ${randInt(2, 45)} Minuten`;
}

const btn = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

/** ownMessage: Das Formular wurde von Willys privater Fortschritts-Nachricht aus geöffnet (die darf er überschreiben). */
function startSession(userId, form, prefill, ownMessage = false) {
  const session = { form, page: 0, answers: {}, startedAt: Date.now(), prefill, ownMessage };
  sessions.set(userId, session);
  return session;
}

const BESCHEIDE = [
  '✅ **Genehmigt.** Allerdings nur an Tagen, die auf „tag“ enden.',
  '❌ **Abgelehnt.** Begründung: Die Unterschrift war zu schön.',
  '⏸️ **Zurückgestellt** bis nach den Ferien. Welchen Ferien? Ja.',
  '📎 **Weitergeleitet** an die Abteilung für Zuständigkeitsfragen (3. Stock, kein Aufzug).',
  '✅ **Genehmigt.** Die Genehmigung ist leider gestern abgelaufen.',
  '❌ **Abgelehnt** wegen eines Formfehlers auf Seite 2. (Wir haben Seite 2 nicht gelesen.)',
  '🟡 **Teilweise genehmigt.** Welcher Teil, entscheidet Willy nach dem Mittagessen.',
  '❌ **Abgelehnt.** Es fehlt Formular 27b/6. Bitte zuerst einen Antrag auf ein Antragsformular stellen.',
];

function bescheidEmbed(session, member, nr) {
  const form = FORMS[session.form];
  const a = session.answers;
  const list = [...BESCHEIDE, ...insiderNames().map((n) => `📨 **Weitergeleitet an ${n}.** Antwort nicht zu erwarten.`)];
  const entscheidung = session.form === 'formular' ? '✅ **Genehmigt.** Sie erhalten hiermit ein Antragsformular. Bitte füllen Sie es aus.' : pick(list);
  const fields = [
    { name: 'Antragsteller:in', value: member.displayName, inline: true },
    { name: 'Formular', value: `${form.name} (${form.code})`, inline: true },
    { name: 'Bearbeitungsdauer', value: `${(Math.random() * 0.9 + 0.1).toFixed(1).replace('.', ',')} Sekunden (Rekord)`, inline: true },
  ];
  if (a.anrede) fields.push({ name: 'Anrede laut Antrag', value: a.anrede, inline: true });
  if (a.ampeln) fields.push({ name: 'Gesichtete Ampeln', value: a.ampeln.trim(), inline: true });
  fields.push({ name: 'Entscheidung', value: entscheidung });
  return new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle(`📨 Bescheid · Aktenzeichen ${nr}`)
    .addFields(fields)
    .setFooter({ text: 'Rechtsbehelfsbelehrung: Gegen diesen Bescheid können Sie innerhalb von 3 Sekunden Widerspruch einlegen (Formular W-1).' })
    .setTimestamp();
}

// ---------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------
/** /formular art:<…> */
export async function handleFormularCommand(interaction) {
  const form = interaction.options.getString('art', true);
  const session = startSession(interaction.user.id, form);
  return interaction.showModal(pageModal(session));
}

/** Alle Knöpfe, Menüs und Formulare mit customId "form:…" */
export async function handleFormular(interaction, action, arg) {
  const ephemeral = { flags: MessageFlags.Ephemeral };
  const userId = interaction.user.id;

  // Diese Aktionen brauchen keine laufende Sitzung
  if (action === 'widerspruch') return interaction.showModal(pageModal(startSession(userId, 'widerspruch', { aktenzeichen: arg })));
  if (action === 'abholen') {
    return interaction.reply({
      content: '📎 Bitte wählen Sie Ihr Antragsformular aus:',
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('form:wahl')
            .setPlaceholder('Antragsformular auswählen …')
            .addOptions(FORM_CHOICES.map((c) => ({ label: c.name, value: c.value }))),
        ),
      ],
      ...ephemeral,
    });
  }
  if (action === 'wahl') return interaction.showModal(pageModal(startSession(userId, interaction.values[0])));

  const session = sessions.get(userId);
  if (!session) {
    return interaction.reply({ content: '🗑️ Ihre Sitzung ist abgelaufen. Ihr Formular wurde aus Datenschutzgründen geschreddert. Bitte mit `/formular` neu beginnen.', ...ephemeral });
  }
  const form = FORMS[session.form];

  switch (action) {
    case 'next':
      return interaction.showModal(pageModal(session));

    case 'restart':
      session.page = 0;
      session.answers = {};
      return interaction.showModal(pageModal(session));

    case 'cancel':
      return interaction.showModal(pageModal(startSession(userId, 'abbruch', undefined, true)));

    case 'submit': {
      if (Number(arg) !== session.page) {
        return interaction.reply({ content: 'Diese Seite wurde bereits eingereicht. Doppelt einreichen ist nur mit Formular D-2 erlaubt.', ...ephemeral });
      }
      for (const f of form.pages[session.page].fields) {
        session.answers[f.id] = f.type === 'select' ? interaction.fields.getStringSelectValues(f.id)[0] ?? '' : interaction.fields.getTextInputValue(f.id) ?? '';
      }
      // Nur Willys eigene private Fortschritts-Nachricht überschreiben, nie z. B. einen öffentlichen Bescheid
      const canUpdate = session.ownMessage && interaction.isFromMessage();
      session.ownMessage = true; // ab jetzt gibt es eine eigene private Nachricht
      const respond = (payload) => (canUpdate ? interaction.update(payload) : interaction.reply({ ...payload, ...ephemeral }));

      // Noch Seiten übrig?
      if (session.page < form.pages.length - 1) {
        session.page++;
        return respond({
          content:
            `📄 **${form.name} (${form.code})**\nSeite ${session.page} von ${form.pages.length} gespeichert ✅\n` +
            `${progress(session)}\n\n_Hinweis: Fehler werden erst ganz am Ende angezeigt. Viel Glück._`,
          components: [
            new ActionRowBuilder().addComponents(
              btn('form:next', `Weiter zu Seite ${session.page + 1} ▶`, ButtonStyle.Primary),
              btn('form:cancel', 'Abbrechen (Formular AB-1)', ButtonStyle.Danger),
            ),
          ],
        });
      }

      // Letzte Seite: alles prüfen
      const errors = form.pages
        .flatMap((p) => p.fields)
        .map((f) => f.check?.(session.answers[f.id] ?? '', session.answers))
        .filter(Boolean);
      if (errors.length) {
        return respond({
          content:
            `❌ **Formular ${form.code} ungültig.**\n${errors.map((e) => `• ${e}`).join('\n')}\n\n` +
            'Ihre Angaben wurden aus Datenschutzgründen vollständig gelöscht. Bitte füllen Sie das Formular erneut aus.',
          components: [new ActionRowBuilder().addComponents(btn('form:restart', '🔁 Von vorne (Seite 1)', ButtonStyle.Primary))],
        });
      }

      sessions.delete(userId);
      if (session.form === 'abbruch') {
        return respond({
          content: '🛑 **Abbruch genehmigt.** Ihr ursprünglicher Antrag wurde abgebrochen. Ihr Abbruchantrag wird nun bearbeitet (6–8 Wochen).',
          components: [],
        });
      }

      const nr = `${new Date().getFullYear()}/${randInt(1000, 99999)}`;
      zaehle(interaction.guildId, 'antraege');
      await respond({ content: `✅ **Eingereicht.** Aktenzeichen ${nr}. Der Bescheid wurde öffentlich zugestellt.`, components: [] });
      const buttons = [btn(`form:widerspruch:${nr}`, '⚖️ Widerspruch einlegen (W-1)')];
      if (session.form === 'formular') buttons.unshift(btn('form:abholen', '📎 Antragsformular abholen', ButtonStyle.Success));
      await interaction.channel
        ?.send({
          embeds: [bescheidEmbed(session, interaction.member, nr)],
          components: [new ActionRowBuilder().addComponents(buttons)],
          allowedMentions: { parse: [] },
        })
        .catch(() => {});
      return;
    }

    default:
      return interaction.reply({ content: 'Unbekannter Vorgang. Bitte Formular U-1 ausfüllen.', ...ephemeral });
  }
}
