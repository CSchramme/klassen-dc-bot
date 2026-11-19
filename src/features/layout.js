// Der absichtlich dumme Serveraufbau. Alles hier ist reine Daten - die Logik steckt in setup.js.
//
// sicht:
//   'verifiziert'   -> nur für Leute mit der Verifiziert-Rolle
//   'unverifiziert' -> nur für Leute OHNE Verifiziert-Rolle (der Eingang)
//   'team'          -> nur für die Team-Rolle
// key: markiert Kanäle, mit denen der Bot etwas Besonderes macht
// nurLesen: normale Mitglieder können dort nicht schreiben

export const SERVER_NAME = '🥔 Klasse (offiziell inoffiziell)';
export const BOT_NICKNAME = '🧹 Hausmeister Gerd (Azubi)';

export const ROLES = {
  verified: { name: '✅ Verifiziert (vielleicht)', color: 0x57f287 },
  team: { name: '🛡️ Ordnungsamt (Team)', color: 0xe67e22 },
};

export const LOTTERY_ROLES = [
  { name: '🤡 Klassenclown', color: 0xff66cc },
  { name: '📚 Streber:in', color: 0x3498db },
  { name: '🪑 Hinterste Reihe', color: 0x7f8c8d },
  { name: '🧃 Capri-Sonne-Beauftragte:r', color: 0xf1c40f },
  { name: '🦆 Ente (ehrenamtlich)', color: 0x2ecc71 },
  { name: '🧽 Tafeldienst für immer', color: 0x95a5a6 },
  { name: '💤 Schläft im Unterricht', color: 0x9b59b6 },
  { name: '📏 Hat das Geodreieck geklaut', color: 0xe74c3c },
  { name: '🥪 Pausenbrot-Tauscher:in', color: 0xd35400 },
  { name: '🚪 Kommt immer zu spät', color: 0x1abc9c },
  { name: '🔥 Feueralarm-Expert:in', color: 0xc0392b },
  { name: '🥔 Kartoffel', color: 0xa67c52 },
];

export const LAYOUT = [
  {
    name: '🔽 GANZ UNTEN (eigentlich oben)',
    sicht: 'verifiziert',
    channels: [{ type: 'text', name: '⬇️-scroll-runter', topic: 'Hier ist nichts. Scroll runter. Nein, weiter. Noch weiter.' }],
  },
  {
    name: '🚪 Hintereingang',
    sicht: 'unverifiziert',
    channels: [
      { type: 'text', name: 'start-hier-vielleicht', key: 'start', nurLesen: true, topic: 'Hier geht es los. Wahrscheinlich.' },
      { type: 'text', name: 'nicht-hier-starten', nurLesen: true, topic: 'Hier NICHT starten. Siehe #start-hier-vielleicht.' },
    ],
  },
  {
    name: '📌 WICHTIG (unwichtig)',
    sicht: 'verifiziert',
    channels: [
      { type: 'text', name: 'regeln-sind-woanders', key: 'fakeRules', nurLesen: true, topic: 'Die Regeln sind nicht hier.' },
      { type: 'text', name: 'ankündigungen-alt', key: 'announce', nurLesen: true, topic: 'Neue Ankündigungen.' },
      { type: 'text', name: 'ankündigungen-neu-aber-alt', nurLesen: true, topic: 'Alte Ankündigungen.' },
      { type: 'text', name: 'ankündigungen-für-ankündigungen', nurLesen: true, topic: 'Hier wird angekündigt, dass etwas angekündigt wird.' },
    ],
  },
  {
    name: '🍝 Sonstiges 2',
    sicht: 'verifiziert',
    channels: [
      { type: 'text', name: 'allgemein', topic: 'Bitte nicht für Allgemeines benutzen.' },
      { type: 'text', name: 'allgemein-2', topic: 'Für Allgemeines. Aber nur das Zweitwichtigste.' },
      { type: 'text', name: 'allgemein-final', topic: 'Der finale Allgemein-Kanal.' },
      { type: 'text', name: '𝗮𝗹𝗹𝗴𝗲𝗺𝗲𝗶𝗻-final-final-v3', topic: 'Der WIRKLICH finale Allgemein-Kanal (bis v4).' },
      { type: 'text', name: 'nicht-allgemein', key: 'system', topic: 'Spezielles. Hier landen auch die Willkommensnachrichten, weil warum nicht.' },
      { type: 'text', name: 'schnell-chat', slowmode: 21600, topic: 'Für schnelle Nachrichten! (Slowmode: 6 Stunden)' },
      { type: 'text', name: 'langsam-chat', topic: 'Bitte langsam tippen. Wir prüfen das.' },
    ],
  },
  {
    name: '📚 Schule (glaube ich)',
    sicht: 'verifiziert',
    channels: [
      { type: 'text', name: 'hausaufgaben', topic: 'Hausaufgaben bitte in #bio-und-pizza posten.' },
      { type: 'text', name: 'mathe-nur-mit-zahlen', key: 'mathe', topic: 'Nur Zahlen. 3. 14. 42. Buchstaben werden gelöscht.' },
      { type: 'text', name: 'deutsch-auf-englisch', topic: 'German on English. Here is everything well.' },
      { type: 'text', name: 'englisch-auf-deutsch', topic: 'Englisch auf Deutsch. Ich verstehe nur Bahnhof.' },
      { type: 'text', name: 'bio-und-pizza', topic: 'Biologie. Und Pizza. Und Hausaufgaben (siehe #hausaufgaben).' },
      { type: 'text', name: 'stundenplan-verwirrung', topic: 'Haben wir jetzt Sport oder Raum 204? Niemand weiß es.' },
      { type: 'text', name: 'lehrkraft-zitate', topic: 'Zitate von Lehrkräften. Nett bleiben, die lesen vielleicht mit.' },
    ],
  },
  {
    name: '🔊 Sprachkanäle',
    sicht: 'verifiziert',
    channels: [
      { type: 'text', name: '🔊-sprachkanal-1', topic: 'Das ist ein Textkanal. Überraschung.' },
      { type: 'text', name: '🔊-sprachkanal-2', topic: 'Auch ein Textkanal. Die Sprachkanäle sind unter "Textkanäle".' },
    ],
  },
  {
    name: '💬 Textkanäle',
    sicht: 'verifiziert',
    channels: [
      { type: 'voice', name: '💬 Chat' },
      { type: 'voice', name: '📝 Schreiben' },
      { type: 'voice', name: '🏫 Klassenzimmer' },
      { type: 'voice', name: '🧑‍🏫 Lehrerzimmer (VERBOTEN)' },
      { type: 'voice', name: '🚽 Klo (1 Person)', userLimit: 1 },
      { type: 'voice', name: '👥 Gruppenarbeit (max. 2)', userLimit: 2 },
      { type: 'voice', name: '🏃 Pausenhof' },
      { type: 'voice', name: '🤫 Bibliothek (LEISE!)' },
      { type: 'voice', name: '🏀 Hinter der Turnhalle' },
      { type: 'voice', name: '🚌 Schulbus (99 Plätze)', userLimit: 99 },
    ],
  },
  {
    name: '🦆 Enten-Bereich',
    sicht: 'verifiziert',
    channels: [
      { type: 'text', name: 'enten', topic: 'Enten erlaubt.' },
      { type: 'text', name: 'nicht-enten', key: 'nichtEnten', topic: 'Enten verboten. Wird kontrolliert.' },
      { type: 'text', name: 'ente-oder-gans-debatte', topic: 'Gänse sind serverweit verboten (§4). Die Debatte ist also schon entschieden.' },
    ],
  },
  {
    name: '🎰 Glücksspiel (legal)',
    sicht: 'verifiziert',
    channels: [{ type: 'text', name: 'rollen-lotterie', key: 'lottery', nurLesen: true, topic: 'Drück den Knopf. Werde jemand.' }],
  },
  {
    name: '🎫 Beschwerdestelle (geschlossen)',
    sicht: 'verifiziert',
    key: 'ticketCategory',
    channels: [{ type: 'text', name: 'tickets-bitte-nicht-benutzen', key: 'tickets', nurLesen: true, topic: 'Tickets. Bitte nicht.' }],
  },
  {
    name: '🗑️ Archiv (aktiv)',
    sicht: 'verifiziert',
    channels: [
      { type: 'text', name: 'memes-ernst', topic: 'Nur ernste Memes.' },
      { type: 'text', name: 'ernst-memes', topic: 'Nur memige Ernsthaftigkeit.' },
      { type: 'text', name: '🚨-polizeiwache', key: 'modlog', nurLesen: true, topic: 'Protokoll der Moderation. Alles hier ist rechtskräftig (nicht).' },
    ],
  },
  {
    name: '⚠️ NICHT ÖFFNEN',
    sicht: 'verifiziert',
    channels: [
      { type: 'text', name: 'ok-du-hast-es-geöffnet', key: 'nichtOeffnen', nurLesen: true, topic: 'Wir hatten EINE Bitte.' },
      { type: 'text', name: 'jetzt-ist-es-zu-spät', topic: 'Jetzt ist es auch egal.' },
    ],
  },
  {
    name: 'Kategorie',
    sicht: 'verifiziert',
    channels: [
      { type: 'text', name: 'kanal', topic: 'Kanal.' },
      { type: 'voice', name: 'Sprachkanal' },
    ],
  },
  {
    name: '🧦 Socken',
    sicht: 'verifiziert',
    channels: [
      { type: 'text', name: 'wer-hat-meine-socke-gesehen', key: 'realRules', nurLesen: true, topic: 'Socke weg. Außerdem: die echten Regeln.' },
      { type: 'text', name: 'socken-tausch', topic: 'Links gegen rechts. Fair ist fair.' },
    ],
  },
  {
    name: '🛡️ Team-Bereich (streng geheim)',
    sicht: 'team',
    channels: [
      { type: 'text', name: '📜-team-kodex', key: 'kodex', nurLesen: true, topic: 'Verbindliche Kommunikationsrichtlinie. Lesepflicht.' },
      { type: 'text', name: 'team-besprechung', topic: 'Bitte gemäß Team-Kodex dumm schreiben.' },
      { type: 'voice', name: '🛡️ Team-Sitzung (Kaffee mitbringen)' },
    ],
  },
  {
    name: '💤 Ruheraum',
    sicht: 'verifiziert',
    channels: [{ type: 'voice', name: '💤 Mathe-Unterricht', key: 'afk' }],
  },
  {
    name: '🔼 GANZ OBEN (eigentlich unten)',
    sicht: 'verifiziert',
    channels: [{ type: 'text', name: '⬆️-scroll-hoch', topic: 'Du bist unten. Die Kategorie sagt oben. Beides stimmt.' }],
  },
];

// ---------------------------------------------------------------------------
// Regeln (werden beim Captcha seitenweise gezeigt und in #wer-hat-meine-socke-gesehen gepostet)
// ---------------------------------------------------------------------------
export const RULE_PAGES = [
  {
    title: 'Präambel',
    text:
      'Diese Regeln regeln das Regeln von Regeln auf diesem Server.\n\n' +
      'Wer die Regeln nicht liest, hat sie trotzdem gelesen (siehe §9).\n' +
      'Wer sie liest, hat sie danach auch gelesen. Das ist fair.\n\n' +
      '_Bitte blättere alle Seiten durch. Wir merken das. (Tun wir nicht.)_',
  },
  {
    title: '§1 – §2: Die einzigen Regeln, die wirklich wichtig sind',
    text:
      '**§1** Sei nett zu allen.\n' +
      '**§1a** Es gibt keine Ausnahme zu §1.\n\n' +
      '**§2** Kein Mobbing, keine Beleidigungen, kein Spam, keine Bilder oder Videos von Leuten ohne deren Erlaubnis, ' +
      'keine privaten Infos von anderen (Adressen, Nummern usw.).\n\n' +
      '⚠️ **Diese Seite ist ernst gemeint.** Wenn dich jemand mobbt oder dir etwas komisch vorkommt: ' +
      'Sag einem Admin oder einer Lehrkraft Bescheid. Der Rest hier ist Quatsch, das hier nicht.',
  },
  {
    title: '§3 – §5: Schulisches',
    text:
      '**§3** Hausaufgaben teilen: erlaubt. Hausaufgaben essen: nicht erlaubt (Ausnahme: Esspapier).\n\n' +
      '**§4** Gänse sind auf dem gesamten Server verboten. Das Wort auch.\n' +
      '**§4b** Enten sind nur in #enten erlaubt, nicht in #nicht-enten. Logisch.\n\n' +
      '**§5** Wer „Erster" schreibt, ist automatisch Zweiter.',
  },
  {
    title: '§6 – §8: Verwaltungsrecht',
    text:
      '**§6** Diese Regel wurde gelöscht.\n' +
      '**§7** Siehe §6.\n\n' +
      '**§8** Der Bot darf jederzeit deinem Sprachkanal beitreten und Geräusche machen. Widerstand ist zwecklos.\n' +
      '**§8b** Beschwerden über §8 bitte per Ticket. Tickets werden von Gerd bearbeitet. Gerd bearbeitet keine Tickets.',
  },
  {
    title: '§9 – §12: Sonstiges',
    text:
      '**§9** Wer die Regeln akzeptiert, bestätigt, sie gelesen zu haben – auch wenn das gelogen ist.\n\n' +
      '**§10** Regeln, deren Nummer mit „1" anfängt, gelten doppelt (§1, §10, §11, §12).\n\n' +
      '**§11** Diese Regel gilt nur an Tagen, die auf „tag" enden.\n\n' +
      '**§12** Was im Discord passiert, bleibt nicht unbedingt im Discord. Benimm dich so, als würde deine Lehrkraft mitlesen.',
  },
  {
    title: 'Schlussbestimmungen',
    text:
      'Sollte eine Regel unwirksam sein, gilt stattdessen die Regel daneben.\n' +
      'Die Admins haben immer recht, außer wenn nicht.\n\n' +
      '_Zuletzt geändert: gestern. Nächste Änderung: vorgestern._\n\n' +
      'Drück jetzt auf **Akzeptieren**. Danach kommt nur noch ein kleines Captcha. Ein ganz kleines. Wirklich.',
  },
];

// ---------------------------------------------------------------------------
// Team-Kodex: todernst formuliert, inhaltlich Unsinn (bis auf §7 und §8, die gelten wirklich)
// ---------------------------------------------------------------------------
export const TEAM_KODEX = [
  {
    title: 'TEAM-KODEX',
    text:
      '**Verbindliche Richtlinie über die schriftliche Kommunikation von Teammitgliedern (TKRL)**\n' +
      'Fassung 4.2 · Aktenzeichen OA-27b/6 · Lesepflicht für alle Mitglieder des Ordnungsamtes\n\n' +
      'Die nachfolgenden Bestimmungen sind ab sofort verbindlich einzuhalten. Unkenntnis schützt nicht vor Anwendung.',
  },
  {
    title: '§1 Geltungsbereich',
    text:
      '(1) Diese Richtlinie gilt für sämtliche schriftlichen Äußerungen von Teammitgliedern in allen Kanälen, Threads und Direktnachrichten.\n' +
      '(2) Sie gilt sinngemäß auch für Sprachnachrichten, Statusmeldungen und Reaktions-Emojis.',
  },
  {
    title: '§2 Grundsatz',
    text:
      '(1) Teammitglieder sind verpflichtet, sich so zu äußern, dass ein Mangel an Sachkenntnis zweifelsfrei erkennbar ist.\n' +
      '(2) Kompetent wirkende Nachrichten sind zu vermeiden. Im Zweifel ist die dümmere Formulierung zu wählen.',
  },
  {
    title: '§3 Rechtschreibung',
    text:
      '(1) Jede Nachricht hat mindestens einen Rechtschreibfehler zu enthalten.\n' +
      '(2) Die Groß- und Kleinschreibung erfolgt nach dem Zufallsprinzip.\n' +
      '(3) Das Wort „Standard" ist ausschließlich als „Standart" zu schreiben. „Wieso" ist als „wiso" zu schreiben.',
  },
  {
    title: '§4 Zeichensetzung',
    text:
      '(1) Fragen enden mit mindestens drei Fragezeichen.\n' +
      '(2) Ausrufe enden mit der Zeichenfolge „!!1!".\n' +
      '(3) Der Punkt am Satzende ist untersagt, da er als aggressiv empfunden werden kann.',
  },
  {
    title: '§5 Inhaltliche Anforderungen',
    text:
      '(1) Fragen von Mitgliedern sind grundsätzlich mit einer Gegenfrage zu beantworten.\n' +
      '(2) Wird ausnahmsweise eine Antwort erteilt, hat diese das Thema zu verfehlen.\n' +
      '(3) Fachbegriffe sind falsch zu verwenden (Beispiel: „Der Server hat zu wenig WLAN").',
  },
  {
    title: '§6 Emojis',
    text:
      '(1) Jede Nachricht enthält mindestens ein Emoji, das inhaltlich nicht passt.\n' +
      '(2) Empfohlen werden 🦆, 🥔 und 🧦. Die Verwendung von 🪿 ist gemäß §4 der Serverregeln untersagt.',
  },
  {
    title: '§7 Verbote (gilt wirklich)',
    text:
      '(1) Ausnahmslos untersagt sind Beleidigungen, Mobbing, das Bloßstellen von Personen, das Weitergeben privater Informationen ' +
      'und der Missbrauch von Teamrechten.\n' +
      '(2) Die Pflicht zur Dummheit entbindet nicht von der Pflicht zur Freundlichkeit.',
  },
  {
    title: '§8 Ernstfälle (gilt wirklich)',
    text:
      '(1) Meldet ein Mitglied Mobbing, eine Bedrohung oder persönliche Probleme, ist diese Richtlinie mit sofortiger Wirkung außer Kraft gesetzt.\n' +
      '(2) In diesem Fall ist sachlich, freundlich und vollständig ernst zu antworten. Bei Bedarf ist eine Lehrkraft oder eine andere Vertrauensperson einzubeziehen.',
  },
  {
    title: '§9 Verstöße',
    text:
      '(1) Verstöße gegen §§ 3 bis 6 (zu intelligentes Schreiben) werden mit einer Ermahnung in #team-besprechung geahndet.\n' +
      '(2) Wiederholte Kompetenz kann zum Entzug der Teamrolle führen.',
  },
  {
    title: 'Anlage 1: Musterformulierungen',
    text:
      '✅ **Korrekt:** „hä wiso machst du deswegn ein ticket??? 🦆"\n' +
      '✅ **Korrekt:** „dass ist Standart so!!1! 🥔"\n' +
      '❌ **Unzulässig:** „Danke für deine Nachricht. Ich kümmere mich darum."\n\n' +
      '_Gezeichnet: Die Serverleitung. Diese Richtlinie tritt mit ihrer Veröffentlichung in Kraft._',
  },
];
