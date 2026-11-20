// Die Schulwoche: Lehrerkonferenz (freitags + /lehrerkonferenz), Elternsprechtag (/elternsprechtag)
// und die Schülerzeitung "Willy-Kurier" (freitags + /zeitung). Grundlage ist die Wochenchronik.
// Personen werden nur für Positives genannt (Quiz-Siege usw.), nie für Strafen oder schlechte Noten.
import { EmbedBuilder, MessageFlags, PermissionFlagsBits as P, escapeMarkdown } from 'discord.js';
import { config } from '../config.js';
import { askAI } from '../ai.js';
import { chronik, chronikNeu } from '../chronik.js';
import { save } from '../storage.js';
import { localNow, logError, pick, seededRng, shuffleWith, sleep, truncate } from '../util.js';
import { FACH_KEYS, FAECHER } from './schule-daten.js';
import { echteNoten, lehrerImLehrerzimmer, lehrerzimmerKanal, schuleEingerichtet } from './schule.js';
import { findChannel } from './roles.js';
import { RAM_DIEBSTAHL } from '../insider.js';

const NO_PINGS = { parse: [] };
const ephemeral = { flags: MessageFlags.Ephemeral };

// ---------------------------------------------------------------------------
// Zahlen der Woche
// ---------------------------------------------------------------------------
const ZAHLEN = {
  stunden: { label: 'Unterrichtsstunden gehalten', emoji: '📚' },
  klassenbuch: { label: 'Klassenbuch-Einträge', emoji: '📕' },
  nachsitzen: { label: 'Mal nachgesessen', emoji: '⛓️' },
  strafen: { label: 'Strafen verhängt', emoji: '🚨' },
  gaense: { label: 'Gänse gesichtet', emoji: '🪿' },
  ramGB: { label: 'GB RAM geklaut', emoji: '💾' },
  feueralarme: { label: 'Feueralarme', emoji: '🔥' },
  durchsagen: { label: 'Durchsagen', emoji: '📢' },
  kaffeepausen: { label: 'Kaffeepausen von Willy', emoji: '☕' },
  neueMitglieder: { label: 'Neue (Captcha überlebt)', emoji: '🆕' },
  tickets: { label: 'Tickets (alle ignoriert)', emoji: '🎫' },
  antraege: { label: 'Anträge ausgefüllt', emoji: '📝' },
  reparaturen: { label: 'Reparaturen (verschlimmbessert)', emoji: '🔧' },
  fundsachen: { label: 'Fundsachen abgegeben', emoji: '🧦' },
  duelle: { label: 'Duelle ausgetragen', emoji: '⚔️' },
  woerter: { label: 'Wort des Tages gelöst', emoji: '🟩' },
};

const SCHLAGZEILEN = {
  ramGB: (n) => [`SKANDAL: ${n} GB RAM verschwunden`, `${RAM_DIEBSTAHL.dieb} schweigt. Der RAM auch.`],
  gaense: (n) => [`${n} Gänse gesichtet – Polizei ratlos`, '§4 gilt weiterhin. Die Gänse wissen das nicht.'],
  feueralarme: (n) => [`${n}× Feueralarm – Feuer weiterhin nicht gefunden`, 'Die Feuerwehr fragt, ob wir das ernst meinen.'],
  strafen: (n) => [`Kriminalität auf Rekordniveau: ${n} Strafen`, 'Die Polizeiwache bittet um mehr Personal.'],
  klassenbuch: (n) => [`${n} Einträge – Klassenbuch beantragt Urlaub`, 'Das Klassenbuch war für eine Stellungnahme nicht erreichbar.'],
  nachsitzen: (n) => [`Nachsitz-Raum überfüllt (${n}×)`, 'Willy stellt Klappstühle dazu.'],
  stunden: (n) => [`${n} Stunden Unterricht – Lehrkräfte erschöpft`, 'Die Kaffeemaschine arbeitet im Schichtbetrieb.'],
  kaffeepausen: (n) => [`Willy macht ${n} Kaffeepausen`, 'Die Gewerkschaft ist sehr zufrieden.'],
  neueMitglieder: (n) => [`${n} Neue! Das Captcha hat sie nicht aufgehalten`, 'Wir prüfen, ob das Captcha zu leicht ist. (Ist es nicht.)'],
  tickets: (n) => [`${n} Tickets eingereicht – keins bearbeitet`, 'Willy: „Wieso macht ihr deswegen ein Ticket?"'],
  antraege: (n) => [`${n} Anträge ausgefüllt`, 'Willy hat sie gelocht, abgeheftet und weggeworfen.'],
  durchsagen: (n) => [`${n} Durchsagen – keiner hat zugehört`, 'Das Sekretariat ist trotzdem stolz.'],
  reparaturen: (n) => [`Willy repariert ${n} Dinge – alles schlimmer`, 'Die Handwerkskammer ermittelt.'],
  duelle: (n) => [`${n} Duelle! Schere, Stein, Papier außer Kontrolle`, 'Der Tafeldienst ist für Wochen ausgebucht.'],
};
// Wie spannend eine Zahl ist (für die Schlagzeile)
const GEWICHT = { gaense: 6, feueralarme: 5, ramGB: 0.5, nachsitzen: 3, neueMitglieder: 4, duelle: 2, reparaturen: 3, klassenbuch: 1, strafen: 0.7, stunden: 1, kaffeepausen: 2, tickets: 2, antraege: 2, durchsagen: 0.5 };

function zahlenListe(c) {
  return Object.entries(ZAHLEN)
    .filter(([k]) => (c.zahlen[k] ?? 0) > 0)
    .map(([k, z]) => `${z.emoji} **${c.zahlen[k]}** ${z.label}`);
}

function schlagzeile(c) {
  const best = Object.keys(SCHLAGZEILEN)
    .filter((k) => (c.zahlen[k] ?? 0) > 0)
    .sort((a, b) => c.zahlen[b] * (GEWICHT[b] ?? 1) - c.zahlen[a] * (GEWICHT[a] ?? 1))[0];
  return best ? SCHLAGZEILEN[best](c.zahlen[best]) : ['Nichts passiert', 'Die Redaktion hat die ganze Woche geschlafen. Wie alle anderen auch.'];
}

/** Die Besten der Woche (Quiz-Siege, Rätsel, Duelle) als Text mit Anzeigenamen. */
async function bestenliste(guild, c, max = 3) {
  const top = Object.entries(c.sieger)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max);
  const out = [];
  for (const [id, punkte] of top) {
    const m = guild.members.cache.get(id) ?? (await guild.members.fetch(id).catch(() => null));
    if (m) out.push({ id, name: truncate(m.displayName, 32), punkte });
  }
  return out;
}

const seitText = (c) => `<t:${Math.floor(c.seit / 1000)}:d>`;

// ---------------------------------------------------------------------------
// Lehrerkonferenz
// ---------------------------------------------------------------------------
const KONFERENZ_SPRUECHE = {
  mathe: ['Ich möchte anmerken, dass diese Konferenz zu drei Vierteln aus Kaffee besteht.', 'Wer hat schon wieder einen Taschenrechner ins Lehrerzimmer gebracht? Das ist Teufelszeug.'],
  deutsch: ['Im Protokoll der letzten Konferenz fehlten 14 Kommas. Ich habe nachgezählt. Zweimal.', 'Wie schon Goethe sagte: „Konferenzen sind schön.“ Hat er nicht gesagt. Aber er hätte.'],
  englisch: ['Before we start: Has anyone seen my tea? It was right here. Very suspicious.', 'Please, no Denglisch today. Kein „Meeting“, kein „Call“. Konferenz. Thank you.'],
  bio: ['Die Pflanze in der Ecke ist übrigens Heinz. Er hört alles. Er ist Photosynthese-Profi.', 'Ich habe festgestellt: Lehrkräfte brauchen Licht, Wasser und Kekse. Genau wie Pflanzen.'],
  geschichte: ['Früher, im Jahr 1648, hatten wir auch so eine Konferenz. Die hat 30 Jahre gedauert.', 'Ich erinnere an die Konferenz von 1999. Da gab es noch Kekse. Gute Zeiten.'],
  sport: ['*pfeift* Wer zu spät zur Konferenz kommt, macht zehn Liegestütze!', 'Ich schlage vor, wir machen die Konferenz im Stehen. Gut für den Rücken.'],
  chemie: ['Der Kaffee riecht heute leicht nach Schwefel. Das war ich. Tut mir leid.', 'Ich habe die Kaffeemaschine optimiert. Sie raucht jetzt ein bisschen. Das ist normal.'],
  musik: ['Diese Konferenz ist in Moll. Ich höre das. Können wir bitte nach Dur wechseln?', 'Ich schlage vor, wir singen die Tagesordnung. Im Kanon.'],
  kunst: ['Ich habe das Protokoll ausgemalt. Es ist jetzt ein Kunstwerk und darf nicht gelesen werden.', 'Die Flecken auf dem Tisch sind kein Kaffee. Das ist eine Installation.'],
};

const ZAHL_KOMMENTARE = {
  feueralarme: (n) => `${n}× Feueralarm diese Woche. Ich packe meine Tasche gar nicht mehr aus.`,
  gaense: (n) => `Es wurden ${n} Gänse gemeldet. Ich bitte um Ruhe. Und um Wachsamkeit.`,
  ramGB: (n) => `Uns fehlen ${n} GB RAM. Ich habe einen Verdacht. Er heißt ${RAM_DIEBSTAHL.dieb}.`,
  klassenbuch: (n) => `Das Klassenbuch hat ${n} neue Einträge. Es ist jetzt schwerer als mein Rucksack.`,
  nachsitzen: (n) => `Es wurde ${n}× nachgesessen. Der Raum braucht mehr Stühle.`,
  stunden: (n) => `Wir haben ${n} Stunden unterrichtet. Ich bin stolz auf uns. Und müde.`,
  kaffeepausen: (n) => `Der Hausmeister hat ${n} Kaffeepausen gemacht. Ich möchte auch Hausmeister werden.`,
  strafen: (n) => `${n} Strafen in einer Woche. Die Polizeiwache hat Überstunden.`,
  tickets: (n) => `Es gab ${n} Tickets. Bearbeitet wurde keins. Das ist Tradition.`,
  neueMitglieder: (n) => `Wir haben ${n} neue Gesichter. Sie haben das Captcha geschafft. Respekt.`,
};

const WILLY_EINWUERFE = [
  'Ich muss hier gleich durchwischen. Bitte alle die Füße hoch.',
  'Entschuldigung, ich suche nur meinen Besen. Macht ruhig weiter.',
  'Die Kaffeemaschine ist übrigens kaputt. Schon seit 2009.',
  'Wer hat das Fenster aufgemacht? Jetzt ist die Gans wieder drin. Kleiner Scherz. (Hoffentlich.)',
];

const BESCHLUESSE = [
  'Die Kaffeemaschine wird ab sofort als Lehrkraft geführt.',
  'Gänse bleiben verboten (§4). Einstimmig.',
  'Taschenrechner werden weiterhin ignoriert.',
  'Heinz der Kaktus bekommt mehr Wasser. Und ein Namensschild.',
  'Der Server bleibt bei 99 %. Das ist Tradition.',
  'Die nächste Konferenz findet wieder hier statt. Leider.',
  'Kekse werden ab sofort in Bruchteilen verteilt. (Antrag von Mathe)',
  'Der Feueralarm darf weiter üben. Er wird immer besser.',
];

/** Wer sitzt heute in der Konferenz? 4–5 zufällige Lehrkräfte. */
function teilnehmer(rng) {
  return shuffleWith(rng, [...FACH_KEYS]).slice(0, 4 + Math.floor(rng() * 2));
}

export function fachVonName(name) {
  const n = name.replace(/[*_~]/g, '').trim().toLowerCase();
  if (!n) return null;
  return FACH_KEYS.find((f) => {
    const l = FAECHER[f].lehrer.toLowerCase();
    const kurz = l.replace(/^(frau|herr|mr\.|mrs\.|coach)\s+(dr\.\s+)?/, '');
    return n === l || n.includes(kurz) || l.includes(n);
  }) ?? null;
}

/** Ablauf ohne KI: aus Bausteinen zusammengesetzt. */
function konferenzOhneKI(rng, faecher, c, lob) {
  const zeilen = [];
  const sag = (wer, text) => zeilen.push({ wer, text });
  const [leitung, ...rest] = faecher;
  sag(leitung, `Ich eröffne die Konferenz. Kaffee ist leider alle. ${pick(['Wir fangen trotzdem an.', 'Das ist der erste Tagesordnungspunkt.', 'Bitte nicht weinen.'])}`);
  for (const f of rest) sag(f, pick(KONFERENZ_SPRUECHE[f]));
  const zahlen = Object.keys(ZAHL_KOMMENTARE).filter((k) => (c.zahlen[k] ?? 0) > 0);
  for (const k of shuffleWith(rng, zahlen).slice(0, 2)) sag(pick(faecher), ZAHL_KOMMENTARE[k](c.zahlen[k]));
  if (lob.length) {
    sag(pick(faecher), `Ich möchte ${lob[0].name} loben. ${lob[0].punkte} Punkte diese Woche. Ich bin fast gerührt.`);
    if (lob[1]) sag(pick(faecher), `${lob[1].name} war auch sehr gut. Bitte nicht weitersagen, sonst werden sie übermütig.`);
  } else {
    sag(pick(faecher), 'Diese Woche hat niemand ein Quiz gewonnen. Vielleicht waren meine Fragen zu schwer. Oder zu leicht. Oder zu früh.');
  }
  sag('willy', pick(WILLY_EINWUERFE));
  sag('heinz', '…');
  sag(leitung, 'Gut. Dann kommen wir zu den Beschlüssen. Und dann zu den Keksen.');
  return { zeilen, beschluesse: shuffleWith(rng, BESCHLUESSE).slice(0, 3) };
}

/** Ablauf mit KI. Gibt null zurück, wenn die KI nicht kann oder Unsinn liefert. */
async function konferenzMitKI(faecher, c, lob) {
  const leute = faecher.map((f) => `- ${FAECHER[f].lehrer} (${FAECHER[f].name}): ${FAECHER[f].persona}`).join('\n');
  const zahlen = zahlenListe(c).map((z) => z.replace(/\*\*/g, '')).join(', ') || 'kaum etwas passiert';
  const lobText = lob.length ? lob.map((l) => `${l.name} (${l.punkte} Punkte)`).join(', ') : 'niemand';
  const system =
    'Du schreibst das Drehbuch für eine kurze, lustige Lehrerkonferenz in einem Discord-Spiel für eine Schulklasse. ' +
    'Alle Lehrkräfte sind erfundene Figuren. Jugendfrei, freundlich, niemand wird beleidigt oder bloßgestellt. ' +
    'Schüler:innen dürfen NUR positiv erwähnt werden und nur die aus der Lob-Liste. Erfinde keine weiteren Namen.';
  const prompt =
    `Teilnehmende Lehrkräfte:\n${leute}\n` +
    '- Willy (Hausmeister, wischt dazwischen, darf einmal reinrufen)\n- Heinz (ein Kaktus, sagt nur „…“)\n\n' +
    `Was diese Woche auf dem Server passiert ist: ${zahlen}.\nLob-Liste (Quiz-Gewinner:innen): ${lobText}.\n\n` +
    'Schreib 10 bis 14 Zeilen Dialog, jede Zeile genau im Format "Name: Text" (Name exakt wie oben, ohne Fach in Klammern). ' +
    'Jede Lehrkraft redet in ihrer Rolle, 1–2 kurze Sätze pro Zeile. Erwähne 2–3 der Zahlen. ' +
    'Danach genau eine Zeile "BESCHLÜSSE: Beschluss 1 | Beschluss 2 | Beschluss 3" mit lustigen, harmlosen Beschlüssen.';
  const text = await askAI(system, [{ role: 'user', content: prompt }]);
  if (!text) return null;
  const zeilen = [];
  let beschluesse = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const m = /^\**\s*([^:*]{2,40}?)\s*\**\s*:\s*\**\s*(.+)$/.exec(line);
    if (!m) continue;
    const name = m[1].trim();
    const inhalt = truncate(m[2].replace(/\*\*$/, '').trim(), 400);
    if (/^beschl/i.test(name)) {
      beschluesse = inhalt.split('|').map((b) => b.trim()).filter(Boolean).slice(0, 4);
      continue;
    }
    if (/willy|hausmeister/i.test(name)) zeilen.push({ wer: 'willy', text: inhalt });
    else if (/heinz|kaktus/i.test(name)) zeilen.push({ wer: 'heinz', text: inhalt });
    else {
      const f = fachVonName(name);
      if (f) zeilen.push({ wer: f, text: inhalt });
    }
  }
  if (zeilen.length < 5) return null;
  return { zeilen: zeilen.slice(0, 16), beschluesse: beschluesse.length ? beschluesse : null };
}

const laufend = new Set(); // guildIds mit laufender Konferenz

/**
 * Hält die Lehrerkonferenz im ☕-lehrerzimmer ab. Gibt einen Text zurück, falls es nicht geht.
 * Läuft ca. eine halbe Minute (die Lehrkräfte reden nacheinander).
 */
export async function lehrerkonferenz(guild, { pause = 2500 } = {}) {
  if (!schuleEingerichtet(guild)) return 'Erst `/schule einrichten`, dann gibt es auch ein Lehrerzimmer.';
  const lz = lehrerzimmerKanal(guild);
  if (!lz) return 'Das Lehrerzimmer fehlt. `/schule einrichten` legt es wieder an.';
  if (laufend.has(guild.id)) return 'Die Konferenz läuft schon. Bitte nicht stören. Psst.';
  laufend.add(guild.id);
  try {
    const c = chronik(guild.id);
    const rng = seededRng(`${guild.id}:${Date.now()}`);
    const faecher = teilnehmer(rng);
    const lob = await bestenliste(guild, c);
    const ablauf = (await konferenzMitKI(faecher, c, lob).catch((err) => logError('konferenz:ki', err))) ?? konferenzOhneKI(rng, faecher, c, lob);
    const beschluesse = ablauf.beschluesse ?? shuffleWith(rng, BESCHLUESSE).slice(0, 3);

    await lz.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x6f4e37)
          .setTitle('☕ Lehrerkonferenz')
          .setDescription(
            `**Anwesend:** ${faecher.map((f) => FAECHER[f].lehrer).join(', ')}, Heinz (Kaktus, Ehrengast)\n` +
              '**Protokoll:** Hausmeister Willy (wischt nebenbei)\n\n' +
              '**Tagesordnung**\n1. Begrüßung\n2. Bericht der Woche\n3. Lob\n4. Verschiedenes\n5. Kekse',
          )
          .setFooter({ text: 'Schüler:innen dürfen mitlesen. Aber nicht mitreden. Psst.' }),
      ],
      allowedMentions: NO_PINGS,
    });

    for (const { wer, text } of ablauf.zeilen) {
      await sleep(pause);
      if (wer === 'willy') await lz.send({ content: `🧹 **Willy:** ${text}`, allowedMentions: NO_PINGS });
      else if (wer === 'heinz') await lz.send({ content: `🌵 **Heinz:** ${text.length > 20 ? '…' : text}`, allowedMentions: NO_PINGS });
      else await lehrerImLehrerzimmer(guild, wer, text);
    }

    await sleep(pause);
    await lz.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x6f4e37)
          .setTitle('📋 Beschlüsse der Konferenz')
          .setDescription(beschluesse.map((b, i) => `${i + 1}. ${b}`).join('\n'))
          .setFooter({ text: 'Einstimmig beschlossen. Heinz hat sich enthalten.' }),
      ],
      allowedMentions: NO_PINGS,
    });
    return null;
  } finally {
    laufend.delete(guild.id);
  }
}

// ---------------------------------------------------------------------------
// Elternsprechtag
// ---------------------------------------------------------------------------
const GUT = [
  'Ein Vergnügen. Fast unheimlich.',
  'Ich habe nichts zu meckern. Das macht mich nervös.',
  'Wenn alle so wären, hätte ich nichts mehr zu tun. Bitte nicht.',
  'Ich habe extra eine Urkunde gebastelt. Sie ist leider im Kopierer.',
];
const MITTEL = [
  'Solide. Wie ein gutes Pausenbrot.',
  'Da geht noch was. Aber es geht auch schon was.',
  'Im Großen und Ganzen: im Großen und Ganzen.',
];
const SCHWACH = [
  'Großes Potenzial. Es ist nur gut versteckt.',
  'Wir arbeiten dran. Also, ich arbeite dran. Das Kind schläft.',
  'Kommt öfter vorbei, dann wird das schon. Ich glaube an sie oder ihn. Fest.',
];

const ELTERN = [
  'Und was gibt es heute in der Mensa?',
  'Unser Kind sagt, es lernt sehr viel. Vor allem Discord.',
  'Können wir das Gespräch kürzer machen? Wir parken im Halteverbot.',
  'Ah, Sie sind also Frau/Herr Lehrkraft. Wir dachten, Sie wären größer.',
  'Zu Hause ist es auch so.',
];

function bewertung(note) {
  if (note.value <= 2.4) return pick(GUT);
  if (note.value <= 3.9) return pick(MITTEL);
  return pick(SCHWACH);
}

async function sprechtagMitKI(name, termine) {
  const system =
    'Du schreibst kurze, lustige Aussagen erfundener Lehrkräfte beim Elternsprechtag in einem Discord-Schulspiel. ' +
    'Freundlich und aufmunternd, auch bei schlechten Noten. Keine Beleidigungen, nichts Peinliches, jugendfrei.';
  const prompt =
    `Kind: ${name}\n` +
    termine.map((t) => `- ${FAECHER[t.fach].lehrer} (${FAECHER[t.fach].name}, ${FAECHER[t.fach].persona}): Note ${t.note.text}`).join('\n') +
    '\n\nSchreib für jede Lehrkraft genau eine Zeile im Format "Name: Aussage" (1–2 Sätze, in ihrer Rolle, über das Fach und die Note). ' +
    'Danach eine Zeile "Eltern: ..." mit einer lustigen Antwort der Eltern.';
  const text = await askAI(system, [{ role: 'user', content: prompt }]);
  if (!text) return null;
  const out = {};
  for (const raw of text.split('\n')) {
    const m = /^\**\s*([^:*]{2,40}?)\s*\**\s*:\s*(.+)$/.exec(raw.trim());
    if (!m) continue;
    if (/^eltern/i.test(m[1])) out.eltern = truncate(m[2].trim(), 300);
    else {
      const f = fachVonName(m[1]);
      if (f) out[f] = truncate(m[2].trim(), 300);
    }
  }
  return termine.every((t) => out[t.fach]) ? out : null;
}

export async function elternsprechtagEmbed(guild, member) {
  const name = member.displayName;
  const echt = echteNoten(guild.id, member.id);
  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle(`👪 Elternsprechtag: ${truncate(name, 200)}`)
    .setThumbnail(member.displayAvatarURL?.() ?? null)
    .setFooter({ text: 'Wartezeit: 2 Stunden · Gesprächszeit: 3 Minuten · Kaffee: lauwarm' });

  if (!echt) {
    return embed.setDescription(
      `**${FAECHER.geschichte.lehrer}:** Ich kenne dieses Kind nicht. War es schon mal im Unterricht? Ich führe seit 1648 Buch, da steht nichts.\n\n` +
        `**Eltern:** „Unser Kind geht zur Schule? Das ist ja schön.“\n\n` +
        '_Tipp: Beim nächsten Unterricht (`/stundenplan`) auf „Hier!“ drücken, dann gibt es auch Noten._',
    );
  }

  // Bestes und schwächstes Fach
  const mitKey = echt.noten
    .map((n) => ({ note: n, fach: FACH_KEYS.find((f) => FAECHER[f].name === n.fach) }))
    .filter((t) => t.fach)
    .sort((a, b) => a.note.value - b.note.value);
  const termine = mitKey.length > 1 ? [mitKey[0], mitKey[mitKey.length - 1]] : mitKey;
  const ki = await sprechtagMitKI(name, termine).catch((err) => logError('sprechtag:ki', err));

  for (const t of termine) {
    const f = FAECHER[t.fach];
    embed.addFields({ name: `${f.emoji} ${f.lehrer} (${f.name}) · Note ${t.note.text}`, value: truncate(ki?.[t.fach] ?? bewertung(t.note), 1024) });
  }
  embed.addFields(
    { name: '📊 Akte', value: `Fehlstunden: **${echt.fehlstunden}** · Klassenbuch: **${echt.eintraege}** Einträge · Fächer mit Note: **${echt.noten.length}**` },
    { name: '🗣️ Die Eltern', value: `„${truncate(ki?.eltern?.replace(/^„|“$|^"|"$/g, '') ?? pick(ELTERN), 300)}“` },
  );
  return embed.setDescription('Termin in Raum 0.00 (der Abstellraum von Willy). Es nehmen teil: die Lehrkraft vom besten und die vom schwächsten Fach.');
}

// ---------------------------------------------------------------------------
// Willy-Kurier (Schülerzeitung)
// ---------------------------------------------------------------------------
const WETTER = [
  '☀️ Sonnig, außer im Mathe-Kanal. Dort Nebel.',
  '🌧️ Regen. Willy hat die Fenster offen gelassen.',
  '🌪️ Leichter Sturm im #allgemein. Bitte festhalten.',
  '🌫️ Dichter Ladebalken-Nebel. Sichtweite: 99 %.',
  '❄️ Kalt. Die Heizung ist im Kaffeepausen-Modus.',
  '🪿 Gänsezug aus Norden. Bitte Fenster schließen (§4).',
];
const HOROSKOP = [
  'Du wirst diese Woche etwas finden. Wahrscheinlich eine Socke.',
  'Die Sterne sagen: Mach die Hausaufgaben. Die Sterne lügen nie.',
  'Ein Captcha wird dich überraschen. Bleib ruhig.',
  'Dein Glückstag ist Mittwoch. Oder Donnerstag. Die Sterne sind sich uneinig.',
  'Vermeide Gänse. Das gilt eigentlich immer.',
  'Jemand wird dich heute „Standart“ schreiben sehen. Bleib stark.',
];
const ANZEIGEN = [
  'Suche: meine Socke. Belohnung: eine andere Socke.',
  'Verkaufe: Taschenrechner, kaum benutzt (Mathe-Verbot).',
  'Biete: Nachhilfe im Nichtstun. Referenzen: Willy.',
  'Gefunden: 1 Prozent. Gehört wohl zum Ladebalken.',
  'Tausche: RAM gegen RAM. Kein Altman.',
];

async function kommentarMitKI(c) {
  const zahlen = zahlenListe(c).map((z) => z.replace(/\*\*/g, '')).join(', ') || 'kaum etwas';
  const text = await askAI(
    'Du bist Hausmeister Willy, Chefredakteur der Schülerzeitung „Willy-Kurier“ auf einem Discord-Server einer Schulklasse. ' +
      'Du schreibst kurz, trocken-lustig, freundlich und jugendfrei. Keine Namen.',
    [{ role: 'user', content: `Diese Woche: ${zahlen}. Schreib einen Kommentar der Chefredaktion in 2–3 Sätzen.` }],
  );
  return text ? truncate(text.trim(), 600) : null;
}

/** Baut die aktuelle Ausgabe (aus der laufenden Woche). */
export async function kurierEmbed(guild, { vorab = false } = {}) {
  const c = chronik(guild.id);
  const rng = seededRng(`${guild.id}:kurier:${c.ausgabe}`);
  const [titel, unterzeile] = schlagzeile(c);
  const zahlen = zahlenListe(c);
  const beste = await bestenliste(guild, c);
  const spitznamen = c.listen.spitznamen ?? [];
  const fund = c.listen.fundsachen ?? [];
  const kommentar = (await kommentarMitKI(c).catch(() => null)) ?? pick([
    'Diese Woche war eine Woche. Das kann man so sagen. Die Redaktion sagt es so.',
    'Wir haben recherchiert. Es war anstrengend. Jetzt machen wir Kaffeepause.',
    'Die Redaktion dankt allen, die diese Zeitung lesen. Also dir. Danke.',
  ]);

  const embed = new EmbedBuilder()
    .setColor(0x2c3e50)
    .setAuthor({ name: `📰 Willy-Kurier · Ausgabe ${c.ausgabe + 1}${vorab ? ' (Vorabdruck)' : ''}` })
    .setTitle(truncate(`📢 ${titel}`, 256))
    .setDescription(`_${unterzeile}_\n\nBerichtszeitraum: seit ${seitText(c)}`)
    .addFields({ name: '📊 Zahlen der Woche', value: truncate(zahlen.join('\n') || 'Keine. Alle haben geschlafen.', 1024) });
  if (beste.length) {
    embed.addFields({ name: '🏆 Die Besten der Woche', value: beste.map((b, i) => `${['🥇', '🥈', '🥉'][i]} ${escapeMarkdown(b.name)} – ${b.punkte} Punkte`).join('\n') });
  }
  if (spitznamen.length) embed.addFields({ name: '🏷️ Spitznamen der Woche', value: truncate(spitznamen.slice(-5).map((n) => `„${escapeMarkdown(n)}“`).join(', '), 1024) });
  embed.addFields(
    { name: '✍️ Kommentar der Chefredaktion', value: kommentar },
    { name: '🌦️ Wetter', value: shuffleWith(rng, WETTER)[0], inline: true },
    { name: '🔮 Horoskop', value: shuffleWith(rng, HOROSKOP)[0], inline: true },
    { name: '📌 Kleinanzeigen', value: truncate(fund.length ? fund.slice(-3).map((f) => `Gefunden: ${escapeMarkdown(f)}. Abholen bei Willy.`).join('\n') : shuffleWith(rng, ANZEIGEN)[0], 1024) },
  );
  return embed.setFooter({ text: 'Auflage: 3 Stück · Preis: 1 Socke · Druckerei: Willys Kopierer (kaputt)' }).setTimestamp();
}

/** Druckt die Ausgabe in #ankündigungen und startet eine neue Woche. */
export async function kurierDrucken(guild) {
  const kanal = findChannel(guild, 'announce') ?? guild.systemChannel;
  if (!kanal?.isTextBased()) return 'Ich finde #ankündigungen nicht.';
  const embed = await kurierEmbed(guild);
  await kanal.send({ content: '🗞️ **Extrablatt! Extrablatt!** Der neue Willy-Kurier ist da.', embeds: [embed], allowedMentions: NO_PINGS });
  const c = chronik(guild.id);
  c.ausgabe += 1;
  save();
  chronikNeu(guild.id);
  return null;
}

// ---------------------------------------------------------------------------
// Zeitplan (wird von events.js alle 30 Sekunden aufgerufen)
// ---------------------------------------------------------------------------
export async function wochenTick(guild, a, z, nowDate = new Date()) {
  const t = localNow(config.spass.zeitzone, nowDate);
  if (t.weekday !== 5) return;
  if (a.lehrerkonferenz && t.minutes >= 15 * 60 && t.minutes < 16 * 60 && z.lehrerkonferenz !== t.date) {
    z.lehrerkonferenz = t.date;
    save();
    if (schuleEingerichtet(guild)) await lehrerkonferenz(guild).catch((err) => logError('konferenz', err));
  }
  if (a.kurier && t.minutes >= 16 * 60 && t.minutes < 18 * 60 && z.kurier !== t.date) {
    z.kurier = t.date;
    save();
    await kurierDrucken(guild).catch((err) => logError('kurier', err));
  }
}

// ---------------------------------------------------------------------------
// Befehle
// ---------------------------------------------------------------------------
export const WOCHEN_COMMANDS = ['lehrerkonferenz', 'elternsprechtag', 'zeitung'];
const cooldown = new Map(); // guildId -> Zeitstempel der letzten Konferenz von Hand

export async function handleWochenCommand(interaction) {
  const guild = interaction.guild;
  const istTeam = interaction.memberPermissions?.has(P.ManageMessages);

  switch (interaction.commandName) {
    case 'lehrerkonferenz': {
      const warten = (cooldown.get(guild.id) ?? 0) + (istTeam ? 5 : 60) * 60_000 - Date.now();
      if (warten > 0) {
        return interaction.reply({ content: `☕ Die Lehrkräfte trinken noch Kaffee. Nächste Konferenz in ${Math.ceil(warten / 60_000)} Minuten.`, ...ephemeral });
      }
      const lz = lehrerzimmerKanal(guild);
      if (!schuleEingerichtet(guild) || !lz) return interaction.reply({ content: 'Erst `/schule einrichten`, dann gibt es auch ein Lehrerzimmer.', ...ephemeral });
      cooldown.set(guild.id, Date.now());
      await interaction.reply({ content: `🔔 Die Lehrkräfte werden ins Lehrerzimmer gerufen: <#${lz.id}>. Bitte leise mitlesen.`, allowedMentions: NO_PINGS });
      const fehler = await lehrerkonferenz(guild).catch((err) => (logError('konferenz', err), 'Die Konferenz ist ausgefallen (Kaffeemaschine explodiert).'));
      if (fehler) await interaction.followUp({ content: fehler, ...ephemeral }).catch(() => {});
      return;
    }
    case 'elternsprechtag': {
      const user = interaction.options.getUser('nutzer') ?? interaction.user;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'Die Person ist nicht (mehr) auf dem Server.', ...ephemeral });
      if (user.bot) return interaction.reply({ content: 'Bots haben keine Eltern. Nur Entwickler:innen. Das ist schlimmer.', ...ephemeral });
      // Über andere nur privat, damit niemand vorgeführt wird
      const privat = user.id !== interaction.user.id;
      await interaction.deferReply(privat ? ephemeral : {});
      return interaction.editReply({ embeds: [await elternsprechtagEmbed(guild, member)], allowedMentions: NO_PINGS });
    }
    case 'zeitung': {
      const sub = interaction.options.getSubcommand();
      if (sub === 'drucken') {
        if (!interaction.memberPermissions?.has(P.ManageGuild)) return interaction.reply({ content: 'Nur die Chefredaktion (Admins) darf drucken.', ...ephemeral });
        await interaction.deferReply(ephemeral);
        const fehler = await kurierDrucken(guild);
        return interaction.editReply(fehler ?? '🗞️ Gedruckt und in #ankündigungen verteilt. Die neue Woche beginnt.');
      }
      await interaction.deferReply();
      return interaction.editReply({ embeds: [await kurierEmbed(guild, { vorab: true })], allowedMentions: NO_PINGS });
    }
    default:
      return null;
  }
}
