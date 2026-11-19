// ============================================================================
//  INSIDER-WITZE DER KLASSE
//  Hier könnt ihr eure eigenen Insider eintragen. Der Bot benutzt sie:
//   - als Reaktion, wenn jemand das Trigger-Wort im Chat schreibt
//   - im Captcha (Fragen)
//   - im Bot-Status
//   - bei Gerd im Ticketsystem (er streut sie ab und zu ein)
//   - beim Befehl /insider
//
//  Bitte nett bleiben: Insider sind Running Gags, keine Lästereien über echte
//  Personen (auch nicht über Lehrkräfte). Sonst gibt's Ärger, und zwar echten.
// ============================================================================

export const INSIDERS = [
  {
    name: 'RAM Altmann',
    emoji: '🐏',
    // Wenn eins dieser Wörter in einer Nachricht vorkommt, reagiert der Bot (Groß-/Kleinschreibung egal)
    trigger: ['ram altmann', 'ramaltmann', 'ram-altmann'],
    reaktionen: [
      '🚨 **RAM ALTMANN WURDE ERWÄHNT.** Bitte alle kurz aufstehen.',
      'Wir sprechen nicht über RAM Altmann. 🤫',
      'RAM Altmann sieht alles. 👀',
      'Ein Hoch auf RAM Altmann! 🥂',
      'RAM Altmann hätte das so gewollt.',
      'RAM Altmann ist kein Insider. RAM Altmann ist ein Lebensgefühl.',
      'Achtung, RAM-Altmann-Alarm. Das ist keine Übung. 🐏',
      '*leise* ...RAM Altmann...',
    ],
  },
  // Beispiel für einen weiteren Insider:
  // {
  //   name: 'Der Overheadprojektor',
  //   emoji: '📽️',
  //   trigger: ['overheadprojektor'],
  //   reaktionen: ['Ruhe in Frieden, Overheadprojektor.', 'Er hat nie funktioniert. Wir vermissen ihn trotzdem.'],
  // },
];

// Zusätzliche Captcha-Fragen. Die erste Antwort in "a" ist die richtige.
export const INSIDER_CAPTCHA = [
  { q: 'Wer ist RAM Altmann?', a: 'Darüber sprechen wir nicht', wrong: ['Arbeitsspeicher', 'Ein Schaf 🐏', 'Keine Ahnung'] },
];

// Bot-Status ("Spielt ...", "Schaut ..."), wird zufällig gewechselt
export const INSIDER_STATUS = ['Wartet auf RAM Altmann', 'RAM Altmann Simulator 2026'];

/** Alle Insider-Namen (für Gerds Systemprompt). */
export const insiderNames = () => INSIDERS.map((i) => i.name);
