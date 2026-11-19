// Dumme Texte: Vertretungsplan, Zeugnis, Ausreden, Hausaufgaben, Durchsagen, Spitznamen.
// Alles reine Generatoren ohne Discord-Logik (die steckt in events.js und index.js).
import { EmbedBuilder } from 'discord.js';
import { pick, pickWith, seededRng, shuffleWith } from '../util.js';
import { insiderNames } from '../insider.js';

const insiders = () => insiderNames();
const hasRam = () => insiders().includes('RAM Altman');

// ---------------------------------------------------------------------------
// Vertretungsplan (pro Tag und Server immer gleich)
// ---------------------------------------------------------------------------
const FAECHER = ['Mathe', 'Deutsch', 'Englisch', 'Bio', 'Physik', 'Chemie', 'Erdkunde', 'Geschichte', 'Kunst', 'Musik', 'Sport', 'Ethik', 'Informatik', 'Französisch', 'Politik'];
const RAEUME = ['Raum ???', 'Klo (1 Person)', 'Pausenhof', 'Turnhalle (unter Wasser)', 'Raum 0', 'Keller, 3. Stock', 'Raum 204 (oder 206)', 'Lehrerzimmer (VERBOTEN)', 'Schulbus'];

function aenderungen(rng) {
  const fach2 = pickWith(rng, FAECHER);
  const raum = pickWith(rng, RAEUME);
  const list = [
    '**entfällt.** Stattdessen: Enten zählen',
    'findet **im Kopf** statt',
    'wird von **Hausmeister Willy** vertreten',
    'wird **auf gestern** verschoben',
    'findet statt, aber **leiser**',
    'nur für Leute mit **zwei gleichen Socken**',
    `**Raumänderung:** ${raum} → ${raum}`,
    `wird durch **${fach2}** ersetzt, aber rückwärts`,
    'als **Gruppenarbeit** (max. 2 Personen)',
    '**Test verschoben.** Wohin? Ja.',
    'Lehrkraft steht **im Stau** (auf dem Pausenhof)',
    `findet in **${raum}** statt`,
    '**entfällt nicht.** (Das ist die Änderung.)',
    'wird **gestreamt**. Auf einem Overheadprojektor.',
  ];
  if (hasRam()) list.push('**entfällt wegen RAM-Mangel** (Grund: RAM Altman)');
  return list;
}

const HINWEISE = [
  'Morgen ist hitzefrei. (Gilt nur ab 45 °C.)',
  'Die große Pause wird heute klein geschrieben.',
  'Der Vordereingang bleibt wegen Bauarbeiten geschlossen. Seit 2009.',
  'Wer seine Socke sucht: siehe #wer-hat-meine-socke-gesehen.',
  'Bitte keine Gänse mitbringen (§4).',
  'Die Mensa bietet heute an: Essen. Vielleicht.',
];

export function vertretungsplanEmbed(guildId, datumText, dateKey) {
  const rng = seededRng(`vp:${guildId}:${dateKey}`);
  const stunden = shuffleWith(rng, [1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 4 + Math.floor(rng() * 3)).sort((a, b) => a - b);
  const zeilen = stunden.map((std) => `\`${std}. Std.\` **${pickWith(rng, FAECHER)}**: ${pickWith(rng, aenderungen(rng))}`);
  return new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle(`📋 Vertretungsplan für ${datumText}`)
    .setDescription(`${zeilen.join('\n')}\n\n📌 **Hinweis:** ${pickWith(rng, HINWEISE)}`)
    .setFooter({ text: 'Alle Angaben ohne Gewähr. Und ohne Sinn. · Erstellt von Willy (vertretungsweise Schulleitung)' });
}

// ---------------------------------------------------------------------------
// Zeugnis (pro Person und Tag immer gleich)
// ---------------------------------------------------------------------------
const ZEUGNIS_FAECHER = [
  'Ampeln erkennen',
  'Gänse vermeiden',
  'Captcha-Geduld',
  'Pausenbrot-Tausch',
  'Rückwärts schreiben',
  'Socken-Paarung',
  'Tickets NICHT erstellen',
  'Pünktlich zu spät kommen',
  'Enten-Kunde',
  'Soundboard-Toleranz',
  'Primzahlen lieben',
  'Kanäle finden',
  'Formulare ausfüllen (27b/6)',
];

const BEMERKUNGEN = [
  '{name} beteiligt sich rege am Unterricht, meistens am falschen.',
  '{name} hat dieses Jahr keine einzige Gans erwähnt. Vorbildlich.',
  '{name} findet jeden Kanal. Irgendwann.',
  '{name} hat das Captcha bestanden und erzählt es seitdem allen.',
  '{name} ist stets bemüht. Worum, ist unklar.',
  '{name} bringt gute Laune mit. Und manchmal ein Pausenbrot.',
  '{name} hat großes Talent, das noch entdeckt werden muss. Wir suchen weiter.',
];

const VERSETZUNG = ['nicht gefährdet ✅', 'gefährdet, aber nur ein bisschen ⚠️', 'wird ausgewürfelt 🎲', 'hängt bei 99 % ⏳'];

function note(rng) {
  const n = 1 + Math.floor(rng() * 6);
  const mod = n < 6 ? pickWith(rng, ['+', '', '-']) : '';
  return { text: `${n}${mod}`, value: n + (mod === '+' ? -0.3 : mod === '-' ? 0.3 : 0) };
}

export function zeugnisEmbed(user, displayName, dateKey) {
  const rng = seededRng(`zeugnis:${user.id}:${dateKey}`);
  const faecher = [...ZEUGNIS_FAECHER];
  if (hasRam()) faecher.push('RAM verteidigen');
  const auswahl = shuffleWith(rng, faecher).slice(0, 7);
  const noten = auswahl.map((f) => ({ fach: f, ...note(rng) }));
  const schnitt = (noten.reduce((a, n) => a + n.value, 0) / noten.length).toFixed(1).replace('.', ',');
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`📜 Zeugnis: ${displayName}`)
    .setDescription(
      noten.map((n) => `• ${n.fach}: **${n.text}**`).join('\n') +
        `\n\n**Durchschnitt:** ${schnitt}\n**Versetzung:** ${pickWith(rng, VERSETZUNG)}\n\n` +
        `_Bemerkung: ${pickWith(rng, BEMERKUNGEN).replaceAll('{name}', displayName)}_`,
    )
    .setFooter({ text: 'Gez. Willy (Hausmeister, vertretungsweise Schulleitung) · Zeugnisse gibt es einmal pro Tag' });
}

// ---------------------------------------------------------------------------
// Ausreden & Hausaufgaben
// ---------------------------------------------------------------------------
export function ausrede() {
  const a = ['Ich konnte die Hausaufgaben leider nicht machen, weil', 'Sorry, aber', 'Also, das war so:', 'Ich hatte sie fertig, aber', 'Ehrlich gesagt,'];
  const b = [
    'mein Hund sie gegessen hat',
    'mein WLAN in den Urlaub gefahren ist',
    'ich im Captcha bei 99 % hängen geblieben bin',
    'eine Ente mein Heft entführt hat',
    'ich zu lange Ampeln gezählt habe',
    'mein Füller eingetrocknet ist',
    'ich sie aus Versehen rückwärts geschrieben habe',
    'mein kleiner Bruder sie als Papierflieger benutzt hat',
    'Willy sie abgeheftet hat',
    'ich die falsche Primzahl gewählt habe',
    'ich den Kanal mit den Hausaufgaben nicht gefunden habe',
  ];
  const c = [
    'und jetzt steht es in meinem Strafregister.',
    'und das Ticket dazu wird seit 4 Schuljahren bearbeitet.',
    'aber ich kann es beweisen. Nicht.',
    'und mein Kaktus Heinz kann das bezeugen.',
    'und außerdem war die Mondphase ungünstig.',
    'deswegen habe ich Formular 27b/6 ausgefüllt.',
    'und dann ging auch noch der Feueralarm los.',
  ];
  if (hasRam()) c.push('und dann hat RAM Altman meinen RAM geklaut.');
  return `${pick(a)} ${pick(b)}, ${pick(c)}`;
}

export function hausaufgabe() {
  const themen = [
    'deinen Lieblingsstuhl',
    'die Geschichte der Socke',
    'warum Gänse verboten sind',
    'das Innenleben einer Ampel',
    'die Gefühle einer Kartoffel',
    'eine Primzahl, die du nicht magst',
    'den Overheadprojektor',
    'die Pause',
    'Willys Kaktus Heinz',
  ];
  if (hasRam()) themen.push('RAM Altman und die Folgen für deinen PC');
  const extras = ['Mit Quellen.', 'Handschriftlich. Mit links.', 'Abgabe: gestern.', 'In Reimform.', 'Ohne den Buchstaben „e“.', 'Als Gruppenarbeit. Allein.', 'Bewertet wird nur die Schriftfarbe.'];
  return pick([
    `Schreibe ${pick([2, 4, 7, 12])} Seiten über ${pick(themen)}. ${pick(extras)}`,
    'Zähle alle Ampeln auf deinem Schulweg und berechne den Durchschnitt. Pro Ampel.',
    'Lerne die Primzahlen von 1 bis 25 auswendig. (Tipp: 1 ist keine.)',
    'Bastle ein Modell dieses Discord-Servers. Maßstab 1:1.',
    `Fasse den Inhalt von #nicht-allgemein in einem Satz zusammen. ${pick(extras)}`,
    `Erkläre deiner Familie, was ein Captcha ist. Lass dir die Erklärung unterschreiben.`,
  ]);
}

// ---------------------------------------------------------------------------
// Durchsagen, 13:37, Spitznamen
// ---------------------------------------------------------------------------
export function durchsage() {
  const list = [
    'Der Besitzer eines silbernen Fahrrads soll sich bitte im Sekretariat melden. Das Fahrrad vermisst dich.',
    'Die Kaffeemaschine im Lehrerzimmer ist wieder kaputt. Alle Lehrkräfte werden gebeten, Ruhe zu bewahren.',
    'Wer hat den Schlüssel für Raum 204? Bitte zurückbringen. Raum 204 vermisst ihn auch.',
    'Im Flur wurde eine einzelne Socke gefunden. Bitte in #wer-hat-meine-socke-gesehen melden.',
    'Der Hausmeister bittet darum, die Ente im 2. Stock nicht weiter zu füttern.',
    'Das WLAN-Passwort lautet ab sofort „passwort“. Nein, Spaß.',
    'Der Overheadprojektor sucht ein neues Zuhause. Er ist stubenrein.',
    'Die Schulglocke ist heute leider heiser. Bitte selbstständig Pause machen.',
    'Fundsache: ein Geodreieck. Es weiß, wer es geklaut hat.',
    'Das ist eine Testdurchsage. Bitte ignorieren. Danke fürs Ignorieren.',
    'Wegen Bauarbeiten bleibt der Vordereingang geschlossen. Seit 2009.',
    'Heute ist Wandertag. Für Willy. Willy wandert zur Kaffeemaschine.',
    'Der Kaktus Heinz hat heute Geburtstag. Bitte nicht gießen, er ist empfindlich.',
    'Die Ampel vor der Schule wurde gezählt. Es ist eine. Danke an alle Beteiligten.',
  ];
  for (const name of insiders()) list.push(`Achtung: ${name} wurde im Gebäude gesichtet. Bitte Wertsachen festhalten.`);
  return `📢 *Ding Dong* … **Durchsage aus dem Sekretariat:**\n> ${pick(list)}`;
}

export function leetDurchsage() {
  return pick([
    '🕐 Es ist 13:37. Danke für eure Aufmerksamkeit.',
    '🕐 13:37. Das war es schon.',
    '🕐 Es ist wieder 13:37. Wie gestern. Unglaublich.',
    '🕐 Kurze Durchsage: Es ist 13:37. Weitermachen.',
    '🕐 13:37 Uhr. Willy hat es auch gesehen.',
  ]);
}

export const SPITZNAMEN = [
  '🥔 Kartoffel des Tages',
  '🚦 Ampel-Profi',
  '🦆 Enten-Beauftragte:r',
  '🧦 Sockensucher:in',
  '🧽 Tafelschwamm',
  '🥪 Pausenbrot',
  '📏 Geodreieck-Dieb:in',
  '🧹 Willys Azubi',
  '🐌 Kommt gleich',
  '🎺 Ehrenwerte Blockflöte',
  '🔢 Lieblingsprimzahl: 1',
  '📎 Neuer Ordner (2)',
  '🌵 Heinz der Zweite',
  '⏳ Lädt… 99 %',
  '🧃 Capri-Sonne-Sommelier',
  '🚌 Schulbus-Fahrgast Nr. 99',
];

export function spitzname() {
  const extra = hasRam() ? ['💾 Hat noch RAM (verdächtig)'] : [];
  return pick([...SPITZNAMEN, ...extra]);
}

export const FEUERALARM_TEXT = '🚨🚨🚨 **FEUERALARM!** Bitte ruhig das Gebäude verlassen. Nicht rennen. (Doch, rennen.) Sammelpunkt: 🏃 Pausenhof.';
