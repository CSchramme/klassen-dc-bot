// Netzwerk-Tuning und -Diagnose für die Verbindung zu Discord.
// Hintergrund: Discord gibt Bots nur 3 Sekunden für die Antwort auf einen Befehl. Auf manchen
// Docker-Servern dauert schon der Verbindungsaufbau (DNS + TLS) länger.
import dns from 'node:dns';
import { Agent, fetch } from 'undici';
import { Routes } from 'discord.js';

// IPv4 zuerst: In vielen Docker-Containern hängt IPv6 und jede Anfrage wartet erst auf einen Timeout.
dns.setDefaultResultOrder('ipv4first');

/** HTTP-Verbindungen zu Discord länger offen halten (Standard wären 4 Sekunden). */
export const restAgent = new Agent({
  keepAliveTimeout: 60_000,
  keepAliveMaxTimeout: 10 * 60_000,
  connect: { timeout: 30_000 },
});

/** Alle 50 Sekunden ein winziges Lebenszeichen, damit die Verbindung warm bleibt. */
export function keepWarm(client) {
  setInterval(() => client.rest.get(Routes.gateway(), { auth: false }).catch(() => {}), 50_000).unref();
}

/** Misst beim Start Verbindungsaufbau und Uhrzeit-Abweichung zu Discord und meldet Probleme. */
export async function diagnose() {
  try {
    const started = Date.now();
    const res = await fetch('https://discord.com/api/v10/gateway', { dispatcher: restAgent });
    const ms = Date.now() - started;
    const serverDate = Date.parse(res.headers.get('date') ?? '');
    const offset = Number.isFinite(serverDate) ? Math.round((Date.now() - ms / 2 - serverDate) / 1000) : 0;
    console.log(`🌐 Verbindung zu Discord: ${ms} ms${Math.abs(offset) >= 2 ? `, Server-Uhr geht ${offset > 0 ? 'vor' : 'nach'} um ${Math.abs(offset)} s` : ''}`);
    if (ms > 1500) {
      console.warn(
        '⚠️ Der Verbindungsaufbau zu Discord ist sehr langsam. Dann laufen Befehle oft in Discords 3-Sekunden-Limit.\n' +
          '   Meist liegt es an langsamem DNS im Container. In Pterodactyl: /etc/pterodactyl/config.yml → docker → network → dns ' +
          'auf 1.1.1.1 und 8.8.8.8 setzen, Wings neu starten.',
      );
    }
    if (Math.abs(offset) >= 2) {
      console.warn(`⚠️ Die Uhr dieses Servers geht um ${Math.abs(offset)} Sekunden falsch. Bitte Zeitsynchronisation (NTP) auf dem Host einschalten.`);
    }
  } catch (err) {
    console.warn(`⚠️ Test-Verbindung zu Discord fehlgeschlagen: ${err.message}`);
  }
}
