// Gemeinsame Erkennung ernster Themen (Mobbing usw.). Solche Nachrichten gehen nie an die KI.
export const SERIOUS_WORDS =
  /(mobb|belästig|bedroh|erpress|schlägt mich|geschlagen|verprügel|ritz|umbring|suizid|selbstmord|nicht mehr leben|will sterben|missbrauch|nacktbild|nacktfoto)/i;

export const SERIOUS_CHAT_REPLY =
  'Hey, das klingt ernst – da hört der Spaß auf. Bitte schreib direkt einem Admin oder mach ein Ticket, dann kümmert sich ein Mensch darum. ' +
  'Und sprich mit jemandem, dem du vertraust: Eltern, eine Lehrkraft, die Vertrauenslehrkraft oder die Schulsozialarbeit. ' +
  'Wenn du in Gefahr bist, ruf die 112 an. Die Nummer gegen Kummer (116 111) ist kostenlos und anonym.';
