# 🧹 Hausmeister Willy – der dümmste Discord-Bot für euren Klassenserver

Ein absichtlich dummer, aber gut gemeinter Bot. Er macht:

| Feature | Was passiert |
|---|---|
| 🏗️ **Chaos-Serveraufbau** | `/setup` baut 17 Kategorien mit über 50 Kanälen. Die Sprachkanäle heißen „Textkanäle“, „GANZ OBEN“ ist ganz unten, es gibt `#allgemein`, `#allgemein-2`, `#allgemein-final` und `#𝗮𝗹𝗹𝗴𝗲𝗺𝗲𝗶𝗻-final-final-v3`, und der „Schnell-Chat“ hat 6 Stunden Slowmode. |
| 🖼️ **Dumme Server-Icons** | Kartoffel mit Glupschaugen („KLASE“), frittierte Ente mit Sonnenbrille, Emoji-Suppe und ein weinender RAM-Riegel („WO RAM???“). Liegen in `assets/icons/`. |
| 📜 **Regeln + sinnloses Captcha** | Neue Leute sehen nur den „Hintereingang“. Sie müssen 6 Regelseiten durchblättern und dann ein 8-stufiges Captcha lösen: Roboter-Frage, Ampel-Raster, Quatsch-Mathe, Rückwärts-Schreiben, Lieblings-Primzahl, Ladebalken mit 99 %, Bestätigung der Bestätigung und ein zufälliges „Captcha fehlgeschlagen (Mondphase)“ mit Einspruch. |
| 🔊 **Soundboard-Überfälle** | Wenn jemand im Sprachkanal ist, kommt der Bot zufällig rein und spielt Soundboard-Sounds **eures Servers**. |
| 🎫 **Willy-Ticketsystem** | Tickets beantwortet „Willy“ (über eine KI, kostenlos mit Gemini), maximal unmotiviert: „Und deswegen machst du ein Ticket?“ Bei ernsten Themen hört der Spaß auf (siehe unten). |
| 👮 **Quatsch-Moderation** | Gänse sind verboten (Nachricht weg, 30 s Timeout). Wer „Erster“ schreibt, wird Zweiter. Enten in `#nicht-enten` werden umgesiedelt, Buchstaben in `#mathe-nur-mit-zahlen` gelöscht. Dazu Routinekontrollen, ein Strafregister und eine `#🚨-polizeiwache`. |
| 📜 **Team-Kodex** | Todernste Richtlinie (Aktenzeichen OA-27b/6) darüber, wie dumm das Team schreiben muss. Der Bot ermahnt Teammitglieder, die einen Punkt ans Satzende setzen. |
| 💾 **Insider: RAM Altman** | Der OpenAI-Chef, der allen den RAM klaut. Schreibt jemand „RAM“, „ChatGPT“ oder „Arbeitsspeicher“, kommt eine Reaktion. Ab und zu klaut RAM Altman jemandem ein paar GB (Kontostand mit `/ram`). Dazu gibt es Captcha-Fragen, Willy-Sprüche und ein eigenes Server-Icon. Eigene Insider kommen in `src/insider.js`. |
| ✏️ **Name & Logo ändern** | Servername, Server-Logo, Bot-Spitzname, Bot-Name und Bot-Avatar per Befehl ändern, plus Namens-Roulette alle 6 Stunden. |
| 🎰 **Rollen-Lotterie** | Knopf drücken und zufällig „🥔 Kartoffel“ oder „📏 Hat das Geodreieck geklaut“ werden. |

---

## 🪪 Wie soll der Bot heißen?

Der Bot spielt **Willy, den Hausmeister**. Vorschläge für den Namen im Developer Portal:

- **Hausmeister Willy** ← Empfehlung
- Captcha-Klaus
- Bürokratius 3000
- Klassenbuch.exe
- Ordnungsamt Olaf

Auf dem Server setzt `/setup` automatisch den Spitznamen **🧹 Hausmeister Willy (Azubi)**. Ein passendes, absichtlich hässliches Profilbild liegt in `assets/willy-avatar.png`. Du kannst es im Developer Portal hochladen oder einfach `/bot avatar` ausführen.

---

## 🚀 Einrichtung

### 1. Bot bei Discord anlegen
1. Geh auf https://discord.com/developers/applications → **New Application** → Name: `Hausmeister Willy`
2. Links auf **Bot**:
   - **Reset Token** → Token kopieren (gut aufheben, niemandem zeigen!)
   - Unter **Privileged Gateway Intents**: **MESSAGE CONTENT INTENT** einschalten (sonst startet der Bot nicht)
3. Optional: unter **General Information** `assets/willy-avatar.png` als App-Icon hochladen

### 2. Bot starten
Du brauchst **Node.js 22.12 oder neuer** (https://nodejs.org).

```bash
npm install
```

```bash
cp .env.example .env
```

Trag in `.env` deinen Token bei `DISCORD_TOKEN=` ein. Optional kommt ein KI-Key für Willy dazu, kostenlos mit Google Gemini (siehe unten). Dann:

```bash
npm start
```

Beim Start steht ein **Einladungslink** in der Konsole. Damit lädst du den Bot auf deinen Server ein (mit Administrator-Rechten).

> Der Bot läuft nur, solange das Programm läuft. Für 24/7 brauchst du einen PC, der immer an ist, einen Raspberry Pi oder einen kleinen Server.

### 3. Server verdummen
Auf dem Discord-Server:

- **Neuer/leerer Server:** `/setup alles_loeschen:True`. Das löscht **alle** Kanäle und baut alles neu auf. Du musst das noch einmal bestätigen.
- **Bestehender Server:** `/setup`. Das baut alles zusätzlich auf. Achtung: Deine alten Kanäle bleiben dann für alle sichtbar, auch ohne Captcha.

Danach:
- **Soundboard-Sounds hochladen:** Servereinstellungen → Soundboard. Ohne eigene Sounds nimmt der Bot die Discord-Standardsounds.
- Du (der Serverbesitzer) bekommst automatisch die Rolle **👑 Owner (Chef vom Ganzen)**. Co-Owner ernennst du mit `/co-owner @name`. Beide Rollen haben Admin-Rechte, also nur an Leute geben, denen du vertraust.
- Moderator:innen die Rolle **🛡️ Ordnungsamt (Team)** geben. Dann sehen sie den Team-Bereich mit dem Kodex.
- Wenn `/setup` schon gelaufen ist und nur Rollen fehlen: `/setup nur_rollen:True`. Das legt keine Kanäle doppelt an.
- Fertig. Neue Leute landen im `#start-hier-vielleicht` und müssen durchs Captcha.

---

## 💬 Befehle

| Befehl | Wer | Was |
|---|---|---|
| `/setup [alles_loeschen] [servername]` | Admin | Baut den dummen Server auf |
| `/setup nur_rollen:True` | Admin | Legt nur die Rollen an (Owner, Co-Owner, Team …) und sortiert sie, ohne neue Kanäle |
| `/co-owner <nutzer>` | nur Owner | Ernennt jemanden zum Co-Owner oder setzt ihn wieder ab |
| `/server name <name>` | Server verwalten | Server umbenennen |
| `/server icon [bild]` | Server verwalten | Logo ändern (ohne Bild: zufälliges dummes Logo) |
| `/server zufall` | Server verwalten | Zufälliger dummer Name + zufälliges Logo |
| `/server roulette <an/aus>` | Server verwalten | Alle 6 h ein neuer dummer Servername |
| `/bot spitzname <name>` | Admin | Spitzname des Bots auf dem Server |
| `/bot avatar [bild]` | Admin | Profilbild des Bots (ohne Bild: Willy) |
| `/bot name <name>` | Admin | Benutzername des Bots (max. 2× pro Stunde) |
| `/chaos an / aus / jetzt / status` | Server verwalten | Soundboard-Überfälle steuern. `jetzt` = sofort in deinen Sprachkanal |
| `/moderation an / aus` | Server verwalten | Quatsch-Moderation |
| `/strafregister [nutzer]` | alle | Zeigt die Akte |
| `/regeln` | alle | Regeln anzeigen |
| `/einladung` | alle | Einladungslink für den Server (führt direkt zum Captcha, läuft nie ab) |
| `/insider` | alle | Zufälliger Insider |
| `/ram [nutzer]` | alle | Wie viel RAM hat RAM Altman dir schon geklaut? (mit Bestenliste) |

---

## 💾 Insider eintragen

In `src/insider.js` stehen die Insider. „RAM Altman“ ist schon drin. Für jeden Insider kannst du festlegen:
- **Trigger-Wörter:** Schreibt jemand das, reagiert der Bot. Das geht auch als ganzes Wort, z. B. `/\bram\b/i`, damit „Programm“ nicht zählt.
- **Reaktionen:** zufällige Sprüche im Chat.
- **Beschreibung:** erklärt Willys KI den Witz.
- **Willy-Sprüche:** für Willy ohne KI.
- **Servernamen:** fürs Namens-Roulette.
- **Captcha-Fragen** und **Bot-Status**.

Den RAM-Diebstahl stellst du unter `RAM_DIEBSTAHL` ein (Chance pro Nachricht, Standard 1,5 %). Nach Änderungen den Bot neu starten.

Bitte nett bleiben: Insider sind Running Gags, keine Lästereien.

---

## 🎫 Willy & KI (optional)

Ohne KI antwortet Willy mit vorgefertigten Sprüchen. Mit KI denkt er sich die dummen Antworten selbst aus. Welche KI benutzt wird, hängt davon ab, welcher Key in der `.env` steht.

### Variante 1: Google Gemini (kostenlos)
1. Auf https://aistudio.google.com/apikey mit einem Google-Konto anmelden und **API-Schlüssel erstellen**. Eine Kreditkarte braucht man dafür nicht.
2. In die `.env` eintragen: `GEMINI_API_KEY=...`
3. Bot neu starten. In der Konsole steht dann „🤖 Willy antwortet mit Google Gemini“.

**Bitte vorher lesen:**
- **Alter:** Laut Googles Bedingungen muss die Person, die den Key erstellt, **mindestens 18** sein. In einer älteren Fassung stand außerdem, dass man die API nicht in Apps nutzen darf, die vermutlich von unter 18-Jährigen benutzt werden. Ob das noch gilt, steht in den aktuellen Bedingungen: https://ai.google.dev/gemini-api/terms. Prüft das, bevor ihr es auf einem Klassenserver mit Minderjährigen nutzt.
- **Datenschutz:** Im Gratis-Kontingent darf Google die Eingaben zur Verbesserung seiner Produkte verwenden, und Menschen können sie lesen. Deshalb steht im Ticket-Panel ein Hinweis, dass man keine privaten Infos reinschreiben soll. Ernste Nachrichten (z. B. über Mobbing) schickt der Bot gar nicht erst an die KI.
- **Limits:** Das Gratis-Kontingent erlaubt nur eine begrenzte Zahl Anfragen pro Minute und pro Tag. Ist es aufgebraucht, antwortet Willy so lange mit Sprüchen.

### Variante 2: Claude (kostet Guthaben)
- **Ein Claude-Abo (Pro/Max auf claude.ai) funktioniert dafür nicht.** Bots brauchen einen API-Key, der getrennt abgerechnet wird.
- So kommst du an den Key: Auf https://console.anthropic.com anmelden, unter **Billing** Guthaben aufladen (ab 5 $), dann unter **API Keys** einen Key erstellen und als `ANTHROPIC_API_KEY=...` in die `.env` eintragen.
- **Kosten** (grob geschätzt): Mit `claude-opus-5-5` kostet eine Willy-Antwort etwa 1 Cent, 5 $ reichen also für ungefähr 500 Antworten. Mit `CLAUDE_MODEL=claude-haiku-5-5` ist es rund 40-mal billiger.
- Wenn Claude eine Antwort ablehnt, versucht die API automatisch ein Ersatzmodell (Server-Side-Fallback).

### Für beide gilt
- Stehen beide Keys drin, gewinnt Claude.
- Nach `TICKET_MAX_REPLIES` Antworten (Standard 25) pro Ticket hat Willy Feierabend.
- Keys niemals posten oder auf GitHub hochladen. Die `.env` ist in `.gitignore` und wird deshalb nicht mit hochgeladen.

### ⚠️ Ernste Themen
Willy ist nur für Quatsch da. Wenn in einem Ticket etwas Ernstes steht (Mobbing, Bedrohung, Selbstverletzung, jemandem geht es richtig schlecht):
- wird Willy sofort ernst und freundlich,
- verweist auf Vertrauenspersonen, die 112 und die Nummer gegen Kummer (116 111),
- pingt den Serverbesitzer und das Team im Ticket,
- und hält danach den Mund, damit echte Menschen übernehmen.

Ein Stichwort-Filter erkennt solche Nachrichten, bevor sie an die KI gehen. Solche Nachrichten bekommt die KI gar nicht zu sehen. Zusätzlich ist die KI angewiesen, bei ernsten Themen von selbst ernst zu werden.

---

## ⚙️ Einstellungen (`.env`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `CHAOS_MIN_MINUTES` / `CHAOS_MAX_MINUTES` | 10 / 45 | Abstand zwischen zufälligen Überfällen |
| `CHAOS_JOIN_CHANCE` | 0.25 | Chance, dass der Bot direkt hinterherkommt, wenn jemand einem Sprachkanal beitritt |
| `CHAOS_MIN_SOUNDS` / `CHAOS_MAX_SOUNDS` | 1 / 4 | Sounds pro Besuch |
| `CHAOS_DEFAULT_SOUNDS` | true | Discord-Standardsounds nehmen, wenn der Server keine eigenen hat |
| `MOD_TIMEOUT_SECONDS` | 30 | Timeout für Gans-Erwähnungen (0 = keiner) |
| `GEMINI_MODEL` | gemini-3.8-flash | Gemini-Modell für Willy |
| `CLAUDE_MODEL` | claude-opus-5-5 | Claude-Modell für Willy |
| `TICKET_MAX_REPLIES` | 25 | Max. Willy-Antworten pro Ticket |

---

## 🛠️ Für Bastler

- `npm run check`: Selbsttest ohne Discord. Prüft Layout und Nachrichten-Limits und spielt das Captcha und die Moderation einmal durch.
- `npm run icons`: Icons neu generieren (braucht Python + Pillow).
- Kanäle, Rollen, Regeln und Team-Kodex stehen alle in `src/features/layout.js`.
- Gespeichert wird in `data/state.json` (Einstellungen, Strafregister, offene Tickets).
