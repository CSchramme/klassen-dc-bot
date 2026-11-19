// Fächer, Lehrer-Figuren und Quizfragen für das Schul-Spiel.
// Alle Lehrer sind erfunden. Bitte keine echten Lehrkräfte eintragen.

export const FAECHER = {
  mathe: {
    name: 'Mathe',
    emoji: '🧮',
    raum: 'raum-101-mathe',
    lehrer: 'Frau Dr. Bruchrechnung',
    avatar: 'mathe.png',
    persona: 'eine überkorrekte Mathelehrerin, die alles in Brüchen ausdrückt und Taschenrechner für Teufelszeug hält',
    lektionen: [
      'Heute lernen wir: Ein Drittel plus zwei Drittel ist ein Ganzes. Ein Ganzes Pausenbrot ist allerdings nach der großen Pause immer nur noch ein Viertel. Das nennt man Schwund.',
      'Thema: Prozentrechnung. Wenn der Ladebalken bei 99 % hängt, fehlt genau 1 %. Dieses eine Prozent ist das wichtigste Prozent der Welt. Bitte notieren.',
      'Heute: Der Satz des Pythagoras. a² + b² = c². Er gilt für rechtwinklige Dreiecke, aber nicht für Enten. Fragt nicht warum.',
    ],
    fragen: [
      { q: 'Was ist 12 × 12?', a: '144', wrong: ['124', '1212', 'Mittwoch'] },
      { q: 'Wie viel Grad hat ein rechter Winkel?', a: '90', wrong: ['180', '45', 'Kommt aufs Wetter an'] },
      { q: 'Was ist die Hälfte von einem Viertel?', a: 'Ein Achtel', wrong: ['Ein Halbes', 'Zwei Viertel', 'Ein Pausenbrot'] },
      { q: 'Was ist 15 % von 200?', a: '30', wrong: ['15', '20', '215'] },
      { q: 'Welche Zahl ist eine Primzahl?', a: '13', wrong: ['15', '21', '1'] },
      { q: 'Wie viele Seiten hat ein Sechseck?', a: '6', wrong: ['8', '5', 'Zwei (innen und außen)'] },
      { q: 'Was ist 2³?', a: '8', wrong: ['6', '9', '23'] },
      { q: 'Wie heißt das Ergebnis einer Division?', a: 'Quotient', wrong: ['Produkt', 'Summe', 'Ergebnissimo'] },
    ],
  },
  deutsch: {
    name: 'Deutsch',
    emoji: '📖',
    raum: 'raum-102-deutsch',
    lehrer: 'Herr Kommasetzung',
    avatar: 'deutsch.png',
    persona: 'ein Deutschlehrer, der wegen falscher Kommas fast weint und ständig Goethe zitiert, der das aber nie gesagt hat',
    lektionen: [
      'Heute: das Komma. Es rettet Leben. Vergleicht: „Wir essen, Opa!“ und „Wir essen Opa!“. Seht ihr? Kommas sind Lebensretter.',
      'Thema: Nomen werden großgeschrieben. Kartoffel, Ente, Hausmeister. Verben nicht: laufen, schlafen, Hausaufgaben vergessen.',
      'Heute lernen wir das Wort „Donaudampfschifffahrtsgesellschaftskapitän“. Es hat drei f hintereinander. Das ist erlaubt. Leider.',
    ],
    fragen: [
      { q: 'Welches Wort ist ein Nomen?', a: 'Kartoffel', wrong: ['laufen', 'schnell', 'obwohl'] },
      { q: 'Was ist die Mehrzahl von „Ente“?', a: 'Enten', wrong: ['Entes', 'Entens', 'Gänse'] },
      { q: 'Welches Satzzeichen beendet eine Frage?', a: 'Fragezeichen', wrong: ['Komma', 'Punkt', 'Ausrufezeichen!!1!'] },
      { q: 'Was ist ein Adjektiv?', a: 'Ein Eigenschaftswort', wrong: ['Ein Tunwort', 'Ein Namenwort', 'Ein sehr großes Wort'] },
      { q: 'Wie schreibt man es richtig?', a: 'Standard', wrong: ['Standart', 'Schtandard', 'Standa(r)d'] },
      { q: 'Wer schrieb „Faust“?', a: 'Goethe', wrong: ['Schiller', 'Willy', 'Ein Boxer'] },
      { q: 'Welches Wort ist ein Verb?', a: 'schlafen', wrong: ['Schlaf', 'schläfrig', 'Schlafanzug'] },
      { q: 'Was ist richtig?', a: 'seit gestern', wrong: ['seid gestern', 'seiht gestern', 'sait gestern'] },
    ],
  },
  englisch: {
    name: 'Englisch',
    emoji: '☕',
    raum: 'raum-103-englisch',
    lehrer: 'Mr. Overhead',
    avatar: 'englisch.png',
    persona: 'ein sehr britischer Englischlehrer, der jede Stunde mit Tee anfängt und Denglisch hasst',
    lektionen: [
      'Today we learn: „Handy“ is not English. In English it is „mobile phone“. If you say „Handy“ in London, people will look at your hands. Very awkward.',
      'Lesson of the day: „Become“ heißt nicht „bekommen“. „I become a pizza“ bedeutet „Ich werde eine Pizza“. Bitte nicht bestellen so.',
      'Today: the tea break. In England, there is always time for tea. Even during a fire alarm. Especially during a fire alarm.',
    ],
    fragen: [
      { q: 'Was heißt „Hausmeister“ auf Englisch?', a: 'caretaker', wrong: ['housemaster', 'homeboss', 'Willy'] },
      { q: 'Was bedeutet „I become a pizza“?', a: 'Ich werde eine Pizza', wrong: ['Ich bekomme eine Pizza', 'Ich mag Pizza', 'Pizza wird mich'] },
      { q: 'Was ist die Vergangenheit von „go“?', a: 'went', wrong: ['goed', 'gone home', 'wented'] },
      { q: 'Wie sagt man „Handy“ auf Englisch?', a: 'mobile phone', wrong: ['handy', 'handphone', 'telephono'] },
      { q: 'Was heißt „duck“?', a: 'Ente', wrong: ['Dackel', 'Dach', 'Ducken (nur)'] },
      { q: 'Welches Wort ist ein „false friend“?', a: 'become', wrong: ['water', 'house', 'school'] },
      { q: 'Was trinkt man laut Klischee in England um fünf?', a: 'Tee', wrong: ['Kakao', 'Capri-Sonne', 'Leitungswasser'] },
      { q: 'Was ist richtig?', a: 'She goes to school.', wrong: ['She go to school.', 'She going school.', 'She schools.'] },
    ],
  },
  bio: {
    name: 'Bio',
    emoji: '🌱',
    raum: 'raum-104-bio',
    lehrer: 'Frau Photosynthese',
    avatar: 'bio.png',
    persona: 'eine Biolehrerin, die mit ihren Zimmerpflanzen redet und jedes Thema irgendwie auf Enten bringt',
    lektionen: [
      'Heute: Photosynthese. Pflanzen machen aus Licht, Wasser und CO₂ Zucker und Sauerstoff. Willy macht aus Kaffee schlechte Laune. Das ist keine Photosynthese.',
      'Thema: Die Ente. Sie kann schwimmen, laufen und fliegen, aber nichts davon richtig gut. Genau wie wir in der 6. Stunde.',
      'Heute: Die Zelle. Sie ist die kleinste Einheit des Lebens. Nicht zu verwechseln mit der Gefängniszelle, die wir beim Nachsitzen benutzen.',
    ],
    fragen: [
      { q: 'Was machen Pflanzen mit Licht?', a: 'Photosynthese', wrong: ['Sonnenbrand', 'Fotos', 'Pause'] },
      { q: 'Welches Gas atmen wir ein, das wir zum Leben brauchen?', a: 'Sauerstoff', wrong: ['Helium', 'Stickstoff (nur)', 'WLAN'] },
      { q: 'Wie viele Beine hat eine Spinne?', a: '8', wrong: ['6', '10', 'Zu viele'] },
      { q: 'Was ist die kleinste Einheit des Lebens?', a: 'Die Zelle', wrong: ['Das Atom', 'Die Ente', 'Der Montag'] },
      { q: 'Welches Organ pumpt das Blut?', a: 'Das Herz', wrong: ['Die Leber', 'Die Lunge', 'Der Magen'] },
      { q: 'Zu welcher Tiergruppe gehört die Ente?', a: 'Vögel', wrong: ['Säugetiere', 'Fische', 'Kartoffeln'] },
      { q: 'Was brauchen Pflanzen NICHT zum Wachsen?', a: 'WLAN', wrong: ['Wasser', 'Licht', 'Nährstoffe'] },
      { q: 'Wie heißt das grüne Zeug in Blättern?', a: 'Chlorophyll', wrong: ['Spinat', 'Grünzeug', 'Photoshop'] },
    ],
  },
  geschichte: {
    name: 'Geschichte',
    emoji: '🏛️',
    raum: 'raum-105-geschichte',
    lehrer: 'Herr Damals',
    avatar: 'geschichte.png',
    persona: 'ein Geschichtslehrer, der jeden Satz mit „Früher war alles …“ anfängt und selbst wahrscheinlich schon bei den Römern dabei war',
    lektionen: [
      'Früher war alles aus Stein. Die Steinzeit zum Beispiel. Da gab es keinen Discord, nur Höhlenmalerei. Das war im Grunde Discord, nur langsamer.',
      'Heute: Die Römer. Sie bauten Straßen, Aquädukte und Thermen. Und trotzdem gab es keine Pausenklingel. Unvorstellbar.',
      'Thema: 1989 fiel die Berliner Mauer. Das war ein großartiger Tag. Der Overheadprojektor in Raum 204 stammt übrigens auch ungefähr aus dieser Zeit.',
    ],
    fragen: [
      { q: 'In welchem Jahr fiel die Berliner Mauer?', a: '1989', wrong: ['1990', '1945', '2009'] },
      { q: 'Welche Sprache sprachen die alten Römer?', a: 'Latein', wrong: ['Italienisch', 'Römisch', 'Pizza'] },
      { q: 'Wer war der erste Bundeskanzler der BRD?', a: 'Konrad Adenauer', wrong: ['Helmut Kohl', 'Willy Brandt', 'Hausmeister Willy'] },
      { q: 'Was kam zuerst?', a: 'Steinzeit', wrong: ['Bronzezeit', 'Eisenzeit', 'Mittagspause'] },
      { q: 'Wo stehen die berühmten Pyramiden von Gizeh?', a: 'Ägypten', wrong: ['Mexiko', 'Italien', 'Raum 204'] },
      { q: 'Seit wann gibt es den Euro als Bargeld?', a: '2002', wrong: ['1999', '1989', '2010'] },
      { q: 'Wie hieß der berühmte Feldherr aus Rom?', a: 'Julius Cäsar', wrong: ['Julius Salat', 'Asterix', 'Augustus Altman'] },
      { q: 'Was erfand Gutenberg um 1450?', a: 'Den Buchdruck', wrong: ['Das Internet', 'Den Kopierer', 'Das Pausenbrot'] },
    ],
  },
  sport: {
    name: 'Sport',
    emoji: '📣',
    raum: 'raum-106-sport',
    lehrer: 'Coach Pfeife',
    avatar: 'sport.png',
    persona: 'ein Sportlehrer, der alles schreit, ständig pfeift und Sport im Textkanal für völlig normal hält',
    lektionen: [
      'AUFWÄRMEN! Heute machen wir Sport im Textkanal. Zehn Mal scrollen, fünf Mal Enter drücken, und dann eine Runde um den Bildschirm. LOS!',
      'THEMA: Ausdauer. Wer es schafft, die ganze Captcha-Prozedur ohne Pause zu machen, bekommt eine Eins. Wer bei 99 % hängen bleibt: auch normal.',
      'HEUTE: Völkerball! Leider nur theoretisch. Stellt euch einen Ball vor. Werft ihn. Getroffen? Dann seid ihr raus. Ehrlichkeit zählt!',
    ],
    fragen: [
      { q: 'Wie viele Spieler hat ein Fußballteam auf dem Feld?', a: '11', wrong: ['10', '12', 'Alle'] },
      { q: 'Wie lang ist ein Marathon ungefähr?', a: '42 km', wrong: ['10 km', '100 km', 'Bis zur Mensa'] },
      { q: 'Wie oft finden Olympische Sommerspiele statt?', a: 'Alle 4 Jahre', wrong: ['Jedes Jahr', 'Alle 2 Jahre', 'Nach Lust und Laune'] },
      { q: 'Womit spielt man Badminton?', a: 'Federball', wrong: ['Tennisball', 'Ente', 'Kartoffel'] },
      { q: 'Wie viele Punkte gibt ein Korb von der Dreierlinie im Basketball?', a: '3', wrong: ['2', '1', '42'] },
      { q: 'Was macht man beim Aufwärmen?', a: 'Den Körper vorbereiten', wrong: ['Kaffee trinken', 'Heizung an', 'Schlafen'] },
      { q: 'Wie viele Ringe hat das olympische Symbol?', a: '5', wrong: ['4', '6', '7'] },
      { q: 'Was ist bei einem Foul im Fußball meistens die Folge?', a: 'Freistoß', wrong: ['Elfer für alle', 'Pause', 'Nachsitzen'] },
    ],
  },
};

export const FACH_KEYS = Object.keys(FAECHER);

export const NOTEN_WORTE = ['', 'sehr gut', 'gut', 'befriedigend', 'ausreichend', 'mangelhaft', 'ungenügend'];

// Strafarbeit beim Nachsitzen: diesen Satz 3x abschreiben
export const STRAFSATZ = 'Ich soll im Unterricht nicht stören.';
