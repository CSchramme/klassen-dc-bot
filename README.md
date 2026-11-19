# 🧹 Hausmeister Gerd – der dümmste Discord-Bot für euren Klassenserver

Ein absichtlich dummer, aber gut gemeinter Bot. Er macht:

| Feature | Was passiert |
|---|---|
| 🏗️ **Chaos-Serveraufbau** | `/setup` baut 17 Kategorien mit über 50 Kanälen. Die Sprachkanäle heißen „Textkanäle“, „GANZ OBEN“ ist ganz unten, es gibt `#allgemein`, `#allgemein-2`, `#allgemein-final` und `#𝗮𝗹𝗹𝗴𝗲𝗺𝗲𝗶𝗻-final-final-v3`, und der „Schnell-Chat“ hat 6 Stunden Slowmode. |
| 🖼️ **Dumme Server-Icons** | Kartoffel mit Glupschaugen („KLASE“), frittierte Ente mit Sonnenbrille, Emoji-Suppe. Liegen in `assets/icons/`. |
| 📜 **Regeln + sinnloses Captcha** | Neue Leute sehen nur den „Hintereingang“. Sie müssen 6 Regelseiten durchblättern und dann ein 8-stufiges Captcha lösen: Roboter-Frage, Ampel-Raster, Quatsch-Mathe, Rückwärts-Schreiben, Lieblings-Primzahl, Ladebalken mit 99 %, Bestätigung der Bestätigung und ein zufälliges „Captcha fehlgeschlagen (Mondphase)“ mit Einspruch. |
| 🔊 **Soundboard-Überfälle** | Wenn jemand im Sprachkanal ist, kommt der Bot zufällig rein und spielt Soundboard-Sounds **eures Servers**. |
| 🎫 **Gerd-Ticketsystem** | Tickets beantwortet „Gerd“ (über Claude), maximal unmotiviert: „Und deswegen machst du ein Ticket?“ Bei ernsten Themen hört der Spaß auf (siehe unten). |
| 👮 **Quatsch-Moderation** | Gänse sind verboten (Nachricht weg, 30 s Timeout). Wer „Erster“ schreibt, wird Zweiter. Enten in `#nicht-enten` werden umgesiedelt, Buchstaben in `#mathe-nur-mit-zahlen` gelöscht. Dazu Routinekontrollen, ein Strafregister und eine `#🚨-polizeiwache`. |
| 📜 **Team-Kodex** | Todernste Richtlinie (Aktenzeichen OA-27b/6) darüber, wie dumm das Team schreiben muss. Der Bot ermahnt Teammitglieder, die einen Punkt ans Satzende setzen. |
| 🐏 **Insider** | „RAM Altmann“ ist schon drin. Eigene Insider kommen in `src/insider.js`. |
| ✏️ **Name & Logo ändern** | Servername, Server-Logo, Bot-Spitzname, Bot-Name und Bot-Avatar per Befehl ändern, plus Namens-Roulette alle 6 Stunden. |
| 🎰 **Rollen-Lotterie** | Knopf drücken und zufällig „🥔 Kartoffel“ oder „📏 Hat das Geodreieck geklaut“ werden. |

---

## 🪪 Wie soll der Bot heißen?

Der Bot spielt **Gerd, den Hausmeister**. Vorschläge für den Namen im Developer Portal:

- **Hausmeister Gerd** ← Empfehlung
- Captcha-Klaus
- Bürokratius 3000
- Klassenbuch.exe
- Ordnungsamt Olaf

Auf dem Server setzt `/setup` automatisch den Spitznamen **🧹 Hausmeister Gerd (Azubi)**. Ein passendes, absichtlich hässliches Profilbild liegt in `assets/gerd-avatar.png`. Du kannst es im Developer Portal hochladen oder einfach `/bot avatar` ausführen.

---

## 🚀 Einrichtung

### 1. Bot bei Discord anlegen
1. Geh auf https://discord.com/developers/applications → **New Application** → Name: `Hausmeister Gerd`
2. Links auf **Bot**:
   - **Reset Token** → Token kopieren (gut aufheben, niemandem zeigen!)
   - Unter **Privileged Gateway Intents**: **MESSAGE CONTENT INTENT** einschalten (sonst startet der Bot nicht)
3. Optional: unter **General Information** `assets/gerd-avatar.png` als App-Icon hochladen

### 2. Bot starten
Du brauchst **Node.js 22.12 oder neuer** (https://nodejs.org).

```bash
npm install
```

```bash
cp .env.example .env
```

Trag in `.env` deinen Token bei `DISCORD_TOKEN=` ein. Optional kommt ein Claude-API-Key bei `ANTHROPIC_API_KEY=` dazu (siehe unten). Dann:

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
- Moderator:innen die Rolle **🛡️ Ordnungsamt (Team)** geben. Dann sehen sie den Team-Bereich mit dem Kodex.
- Fertig. Neue Leute landen im `#start-hier-vielleicht` und müssen durchs Captcha.

---

## 💬 Befehle

| Befehl | Wer | Was |
|---|---|---|
| `/setup [alles_loeschen] [servername]` | Admin | Baut den dummen Server auf |
| `/server name <name>` | Server verwalten | Server umbenennen |
| `/server icon [bild]` | Server verwalten | Logo ändern (ohne Bild: zufälliges dummes Logo) |
| `/server zufall` | Server verwalten | Zufälliger dummer Name + zufälliges Logo |
| `/server roulette <an/aus>` | Server verwalten | Alle 6 h ein neuer dummer Servername |
| `/bot spitzname <name>` | Admin | Spitzname des Bots auf dem Server |
| `/bot avatar [bild]` | Admin | Profilbild des Bots (ohne Bild: Gerd) |
| `/bot name <name>` | Admin | Benutzername des Bots (max. 2× pro Stunde) |
| `/chaos an / aus / jetzt / status` | Server verwalten | Soundboard-Überfälle steuern. `jetzt` = sofort in deinen Sprachkanal |
| `/moderation an / aus` | Server verwalten | Quatsch-Moderation |
| `/strafregister [nutzer]` | alle | Zeigt die Akte |
| `/regeln` | alle | Regeln anzeigen |
| `/insider` | alle | Zufälliger Insider |

---

## 🐏 Insider eintragen

In `src/insider.js` stehen die Insider. „RAM Altmann“ ist schon drin. Für jeden Insider kannst du festlegen:
- **Trigger-Wörter:** Schreibt jemand das, reagiert der Bot.
- **Reaktionen:** zufällige Sprüche.
- **Captcha-Fragen** und **Bot-Status**.

Gerd streut die Insider auch ab und zu in Tickets ein. Danach den Bot neu starten.

Bitte nett bleiben: Insider sind Running Gags, keine Lästereien über echte Personen (auch nicht über Lehrkräfte).

---

## 🎫 Gerd & Claude (optional)

Mit `ANTHROPIC_API_KEY` in der `.env` beantwortet Claude die Tickets als Gerd. Ohne Key antwortet Gerd mit vorgefertigten Sprüchen. Das funktioniert auch, ist aber weniger lustig.

- Den API-Key gibt es auf https://console.anthropic.com. **Das kostet Geld** (pro Nachricht ein paar Zehntel Cent).
- Standardmodell: `claude-opus-5-5` mit niedrigem Aufwand (`effort: low`), weil Gerd nur kurz antwortet. Günstiger geht es mit `CLAUDE_MODEL=claude-haiku-5-5`.
- Kostenbremse: Nach `TICKET_MAX_REPLIES` Antworten (Standard 25) hat Gerd Feierabend.
- Wenn Claude eine Antwort ablehnt, versucht die API automatisch ein Ersatzmodell (Server-Side-Fallback). Klappt das auch nicht, kommt ein Spruch aus der Dose.

### ⚠️ Ernste Themen
Gerd ist nur für Quatsch da. Wenn in einem Ticket etwas Ernstes steht (Mobbing, Bedrohung, Selbstverletzung, jemandem geht es richtig schlecht):
- wird Gerd sofort ernst und freundlich,
- verweist auf Vertrauenspersonen, die 112 und die Nummer gegen Kummer (116 111),
- pingt den Serverbesitzer und das Team im Ticket,
- und hält danach den Mund, damit echte Menschen übernehmen.

Das erkennt Claude, und zusätzlich gibt es einen Stichwort-Filter als Sicherheitsnetz.

---

## ⚙️ Einstellungen (`.env`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `CHAOS_MIN_MINUTES` / `CHAOS_MAX_MINUTES` | 10 / 45 | Abstand zwischen zufälligen Überfällen |
| `CHAOS_JOIN_CHANCE` | 0.25 | Chance, dass der Bot direkt hinterherkommt, wenn jemand einem Sprachkanal beitritt |
| `CHAOS_MIN_SOUNDS` / `CHAOS_MAX_SOUNDS` | 1 / 4 | Sounds pro Besuch |
| `CHAOS_DEFAULT_SOUNDS` | true | Discord-Standardsounds nehmen, wenn der Server keine eigenen hat |
| `MOD_TIMEOUT_SECONDS` | 30 | Timeout für Gans-Erwähnungen (0 = keiner) |
| `CLAUDE_MODEL` | claude-opus-5-5 | Modell für Gerd |
| `TICKET_MAX_REPLIES` | 25 | Max. Gerd-Antworten pro Ticket |

---

## 🛠️ Für Bastler

- `npm run check`: Selbsttest ohne Discord. Prüft Layout und Nachrichten-Limits und spielt das Captcha und die Moderation einmal durch.
- `npm run icons`: Icons neu generieren (braucht Python + Pillow).
- Kanäle, Rollen, Regeln und Team-Kodex stehen alle in `src/features/layout.js`.
- Gespeichert wird in `data/state.json` (Einstellungen, Strafregister, offene Tickets).
