// ============================================================================
//  INSIDER-WITZE DER KLASSE
//  Hier könnt ihr eure eigenen Insider eintragen. Der Bot benutzt sie:
//   - als Reaktion, wenn jemand ein Trigger-Wort im Chat schreibt
//   - im Captcha (Fragen)
//   - im Bot-Status und als Servernamen beim Namens-Roulette
//   - bei Gerd im Ticketsystem (er streut sie ab und zu ein)
//   - beim Befehl /insider
//
//  Trigger können normale Wörter sein (kommen irgendwo in der Nachricht vor)
//  oder reguläre Ausdrücke wie /\bram\b/i (nur das ganze Wort "RAM").
//
//  Bitte nett bleiben: Insider sind Running Gags, keine Lästereien.
// ============================================================================

export const INSIDERS = [
  {
    name: 'RAM Altman',
    emoji: '💾',
    // Erklärung für Gerd (Claude), damit er den Witz versteht
    beschreibung:
      'Spitzname für Sam Altman, den Chef von OpenAI, der laut Klassen-Insider den ganzen Arbeitsspeicher (RAM) der Welt klaut ' +
      '(Anspielung darauf, dass RAM wegen der KI-Rechenzentren so teuer geworden ist). Ist jemandes PC langsam oder fehlt RAM, war RAM Altman da.',
    trigger: [
      'ram altman',
      'ram-altman',
      'ramaltman',
      'ram altmann',
      'sam altman',
      'sam altmann',
      'openai',
      'chatgpt',
      'arbeitsspeicher',
      /\bram\b/i,
      /\bddr[45]\b/i,
    ],
    reaktionen: [
      '🚨 **RAM ALTMAN WURDE ERWÄHNT.** Bitte haltet euren Arbeitsspeicher fest.',
      'Wer hat RAM gesagt? 👀 RAM Altman ist schon unterwegs.',
      'Pssst. Nicht so laut. Sonst merkt RAM Altman, dass du noch RAM hast.',
      'RAM Altman hat gerade 16 GB eingesteckt und ist durchs Fenster raus. 🏃💾',
      'Fun Fact: RAM ist so teuer, weil RAM Altman ihn sammelt. Wie Pokémon-Karten.',
      'Dein PC ist langsam? RAM Altman war da.',
      'RAM Altman braucht deinen RAM dringender als du. Für die KI. Vertrau ihm.',
      'Achtung, RAM-Altman-Alarm 🚨 Alle Riegel festhalten!',
      '*leise* … er kommt den RAM holen …',
      'Ich hätte dazu was Kluges gesagt, aber RAM Altman hat meinen Arbeitsspeicher. 🫠',
    ],
    // Sprüche für Gerd, wenn er ohne Claude antwortet
    gerd: [
      'Dein Problem ist bestimmt zu wenig RAM. Den hat RAM Altman. Ticket geschlossen.',
      'Ich würde dir ja helfen, aber RAM Altman hat meinen Arbeitsspeicher geklaut. Ich kann mir nichts mehr merken. Wer bist du?',
      'Hast du schon versucht, RAM Altman zu fragen, ob du deinen RAM zurückbekommst? Nein? Er sagt eh nein.',
    ],
    servernamen: ['💾 RAM-freie Zone', 'Hier gibt es keinen RAM (RAM Altman war da)', '💾 RAM Altman Fanclub'],
  },
  // Beispiel für einen weiteren Insider:
  // {
  //   name: 'Der Overheadprojektor',
  //   emoji: '📽️',
  //   beschreibung: 'Der kaputte Overheadprojektor aus Raum 204.',
  //   trigger: ['overheadprojektor'],
  //   reaktionen: ['Ruhe in Frieden, Overheadprojektor.'],
  // },
];

// Zusätzliche Captcha-Fragen. "a" ist die richtige Antwort.
export const INSIDER_CAPTCHA = [
  { q: 'Wer hat den ganzen RAM geklaut?', a: 'RAM Altman', wrong: ['Die Grafikkarte', 'Niemand, RAM ist billig', 'Ich war es nicht'] },
  { q: 'Wie viel RAM hat RAM Altman dir übrig gelassen?', a: '0 GB', wrong: ['16 GB', '32 GB', 'Ja'] },
];

// Bot-Status, wird zufällig gewechselt
export const INSIDER_STATUS = ['Versteckt den RAM vor RAM Altman 💾', 'Restlicher RAM: 0 GB', 'RAM Altman Simulator 2026'];

// RAM-Diebstahl: Mit dieser Chance pro Nachricht klaut RAM Altman der Person RAM (Anzeige mit /ram)
export const RAM_DIEBSTAHL = { aktiv: true, chance: 0.015, dieb: 'RAM Altman' };

export const insiderNames = () => INSIDERS.map((i) => i.name);

/** Beschreibungen für Gerds Systemprompt. */
export const insiderPromptLines = () => INSIDERS.map((i) => `- ${i.name}${i.beschreibung ? `: ${i.beschreibung}` : ''}`);

/** Prüft, ob ein Insider in einem Text vorkommt. */
export function findInsider(text) {
  const lower = text.toLowerCase();
  return INSIDERS.find((i) => i.trigger.some((t) => (t instanceof RegExp ? t.test(text) : lower.includes(t.toLowerCase())))) ?? null;
}
