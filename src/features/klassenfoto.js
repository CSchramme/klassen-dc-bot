// /klassenfoto: Ein "echtes" Klassenfoto als Bild. Hinten die Lehrkräfte, in der Mitte die aktiven Leute vom Server
// (mit ihren Profilbildern), vorne Willy mit Besen, Heinz der Kaktus und eine Ente, die nicht eingeladen war.
// Dazu Partyhut, Sonnenbrille, eine verwackelte Person und der Daumen des Fotografen.
// Braucht das Paket @napi-rs/canvas (optional). Fehlt es, sagt Willy Bescheid.
import fs from 'node:fs';
import path from 'node:path';
import { AttachmentBuilder, MessageFlags } from 'discord.js';
import { config } from '../config.js';
import { guildState } from '../storage.js';
import { localNow, logError, seededRng, shuffleWith, truncate } from '../util.js';
import { FACH_KEYS, FAECHER } from './schule-daten.js';
import { canvasLaden, rundesRechteck } from './leinwand.js';

const ASSETS = path.resolve('assets');
const AKTIV_TAGE = 14;
const MAX_LEUTE = 30;
const PRO_REIHE = 10;
const W = 1600;

/** Namen ohne Emojis (die Schrift kann keine), kurz. */
export const fotoName = (name) =>
  truncate(
    (name ?? '')
      .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim() || '???',
    16,
  );

async function bildLaden(c, quelle) {
  if (!quelle) return null;
  try {
    if (typeof quelle === 'string' && quelle.startsWith('http')) {
      const res = await fetch(quelle, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      return await c.loadImage(Buffer.from(await res.arrayBuffer()));
    }
    return await c.loadImage(fs.readFileSync(quelle));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------
function koerper(ctx, x, y, r, farbe) {
  ctx.fillStyle = farbe;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 1.75, r * 1.25, r * 1.05, 0, Math.PI, 0);
  ctx.lineTo(x + r * 1.25, y + r * 2.6);
  ctx.lineTo(x - r * 1.25, y + r * 2.6);
  ctx.closePath();
  ctx.fill();
}

function kopf(ctx, bild, x, y, r, name, buchstabe, rng, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  if (bild) ctx.drawImage(bild, x - r, y - r, r * 2, r * 2);
  else {
    ctx.fillStyle = `hsl(${Math.floor(rng() * 360)}, 55%, 60%)`;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(r * 0.9)}px Klasse`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(buchstabe, x, y + 2);
  }
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();
  if (name) namensschild(ctx, x, y + r + 16, name);
}

function namensschild(ctx, x, y, text, groesse = 17, maxBreite = 150) {
  ctx.font = `bold ${groesse}px Klasse`;
  const w = Math.min(ctx.measureText(text).width + 16, maxBreite);
  rundesRechteck(ctx, x - w / 2, y - groesse / 2 - 5, w, groesse + 10, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.fillStyle = '#2c3e50';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1, w - 10);
}

function partyhut(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x + r * 0.2, y - r * 0.85);
  ctx.rotate(0.25);
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, 0);
  ctx.lineTo(r * 0.45, 0);
  ctx.lineTo(0, -r * 1.1);
  ctx.closePath();
  ctx.fillStyle = '#e74c3c';
  ctx.fill();
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 5;
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.45 * (1 - i / 3), -r * 1.1 * (i / 3));
    ctx.lineTo(r * 0.45 * (1 - i / 3), -r * 1.1 * (i / 3));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, -r * 1.1, r * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = '#f1c40f';
  ctx.fill();
  ctx.restore();
}

function sonnenbrille(ctx, x, y, r) {
  ctx.fillStyle = '#111111';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * r * 0.38, y - r * 0.12, r * 0.32, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(x - r * 0.1, y - r * 0.18, r * 0.2, r * 0.07);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.48, y - r * 0.2, r * 0.08, r * 0.05, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function besen(ctx, x, y) {
  ctx.strokeStyle = '#8d5a2b';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - 150);
  ctx.lineTo(x + 20, y + 70);
  ctx.stroke();
  ctx.fillStyle = '#d4a017';
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 60);
  ctx.lineTo(x + 45, y + 60);
  ctx.lineTo(x + 65, y + 120);
  ctx.lineTo(x - 25, y + 120);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#a67c00';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 6, y + 64);
    ctx.lineTo(x - 22 + i * 12, y + 118);
    ctx.stroke();
  }
}

function kaktus(ctx, x, y) {
  // Topf
  ctx.fillStyle = '#c0632b';
  ctx.beginPath();
  ctx.moveTo(x - 45, y + 30);
  ctx.lineTo(x + 45, y + 30);
  ctx.lineTo(x + 34, y + 100);
  ctx.lineTo(x - 34, y + 100);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a0522d';
  ctx.fillRect(x - 50, y + 22, 100, 16);
  // Kaktus
  ctx.fillStyle = '#2e8b57';
  rundesRechteck(ctx, x - 24, y - 110, 48, 140, 24);
  ctx.fill();
  rundesRechteck(ctx, x - 62, y - 60, 22, 60, 11);
  ctx.fill();
  ctx.fillRect(x - 50, y - 12, 30, 16);
  rundesRechteck(ctx, x + 40, y - 85, 22, 55, 11);
  ctx.fill();
  ctx.fillRect(x + 20, y - 42, 30, 16);
  // Stacheln
  ctx.strokeStyle = '#f5f5dc';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const sy = y - 95 + i * 10;
    ctx.beginPath();
    ctx.moveTo(x + (i % 2 ? 18 : -18), sy);
    ctx.lineTo(x + (i % 2 ? 26 : -26), sy - 4);
    ctx.stroke();
  }
  // Gesicht (leicht genervt)
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x - 9, y - 70, 4, 0, Math.PI * 2);
  ctx.arc(x + 9, y - 70, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 8, y - 55, 16, 3);
  namensschild(ctx, x, y + 125, 'Heinz (Kaktus)', 17, 300);
}

function ente(ctx, x, y) {
  ctx.fillStyle = '#f7d038';
  ctx.beginPath();
  ctx.ellipse(x, y, 52, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 40, y - 38, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f39c12';
  ctx.beginPath();
  ctx.moveTo(x + 62, y - 42);
  ctx.lineTo(x + 92, y - 34);
  ctx.lineTo(x + 62, y - 28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x + 46, y - 44, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e1b12c';
  ctx.beginPath();
  ctx.ellipse(x - 8, y - 2, 26, 16, -0.3, 0, Math.PI * 2);
  ctx.fill();
  namensschild(ctx, x + 10, y + 56, 'Ente (nicht eingeladen)', 15, 300);
}

function daumen(ctx, h) {
  const g = ctx.createRadialGradient(40, h - 30, 20, 40, h - 30, 230);
  g.addColorStop(0, 'rgba(232,170,150,0.97)');
  g.addColorStop(0.8, 'rgba(214,140,120,0.95)');
  g.addColorStop(1, 'rgba(190,120,100,0.0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(30, h + 10, 210, 170, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
/** Wer kommt aufs Foto? Aktive Leute der letzten 14 Tage, sonst alle Menschen aus dem Cache. */
async function leute(guild) {
  const gesehen = guildState(guild.id).namensroulette?.gesehen ?? {};
  const grenze = Date.now() - AKTIV_TAGE * 86_400_000;
  const ids = Object.entries(gesehen)
    .filter(([, t]) => t > grenze)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, MAX_LEUTE);
  const out = [];
  for (const id of ids) {
    const m = guild.members.cache.get(id) ?? (await guild.members.fetch(id).catch(() => null));
    if (m && !m.user?.bot) out.push(m);
  }
  if (out.length < 3) {
    for (const m of guild.members.cache.values()) {
      if (out.length >= MAX_LEUTE) break;
      if (!m.user?.bot && !out.includes(m)) out.push(m);
    }
  }
  return out;
}

/**
 * Malt das Klassenfoto. personen: [{ name, avatar (URL/Pfad/null) }]. Gibt einen PNG-Buffer zurück
 * oder null, wenn @napi-rs/canvas fehlt.
 */
export async function klassenfotoBild({ servername, personen, datum, seed = datum }) {
  const c = await canvasLaden();
  if (!c) return null;
  const rng = seededRng(`foto:${seed}`);
  personen = personen.slice(0, MAX_LEUTE).map((p) => ({ ...p, name: fotoName(p.name) }));
  const reihen = Math.max(1, Math.ceil(personen.length / PRO_REIHE));
  const proReihe = Math.max(1, Math.ceil(personen.length / reihen)); // gleichmäßig verteilen
  const [jahr, monat] = datum.split('-').map(Number);
  const schuljahr = monat >= 8 ? `${jahr}/${String(jahr + 1).slice(2)}` : `${jahr - 1}/${String(jahr).slice(2)}`;
  const lehrerY = 330;
  const ersteReihe = 480;
  const abstand = 150;
  const vorneY = ersteReihe + reihen * abstand + 20;
  const fotoH = vorneY + 190;
  const H = fotoH + 110;
  const RAND = 30;

  const canvas = c.createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Fotopapier
  ctx.fillStyle = '#fbfaf5';
  ctx.fillRect(0, 0, W, H);

  // Wand und Boden
  ctx.save();
  rundesRechteck(ctx, RAND, RAND, W - 2 * RAND, fotoH - RAND, 6);
  ctx.clip();
  const wand = ctx.createLinearGradient(0, RAND, 0, fotoH);
  wand.addColorStop(0, '#e9dcc0');
  wand.addColorStop(1, '#d8c7a3');
  ctx.fillStyle = wand;
  ctx.fillRect(0, 0, W, fotoH);
  ctx.fillStyle = '#9b6b43';
  ctx.fillRect(0, vorneY - 40, W, fotoH);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, vorneY - 40);
    ctx.lineTo(x - 60, fotoH);
    ctx.stroke();
  }

  // Tafel
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(W / 2 - 430, 55, 860, 190);
  ctx.fillStyle = '#2f4f3a';
  ctx.fillRect(W / 2 - 415, 70, 830, 160);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 58px Klasse';
  ctx.fillText('KLASSENFOTO', W / 2, 140, 780);
  ctx.font = '26px Klasse';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`${truncate(servername.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').trim(), 40)} · Schuljahr ${schuljahr}`, W / 2, 204, 790);
  // Kreide-Gekritzel
  ctx.font = '18px Klasse';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'right';
  ctx.fillText('1 + 1 = 2 (ohne Taschenrechner)', W / 2 + 400, 88);
  ctx.textAlign = 'left';
  ctx.fillText('Keine Gänse!', W / 2 - 400, 88);
  ctx.textAlign = 'center';

  // Lehrkräfte (hintere Reihe)
  const lehrkraefte = shuffleWith(rng, FACH_KEYS);
  const lehrerBilder = await Promise.all(lehrkraefte.map((f) => bildLaden(c, path.join(ASSETS, 'lehrer', FAECHER[f].avatar))));
  const lAbstand = (W - 200) / lehrkraefte.length;
  lehrkraefte.forEach((f, i) => koerper(ctx, 100 + lAbstand * (i + 0.5), lehrerY, 44, ['#5d4037', '#455a64', '#6d4c41', '#37474f'][i % 4]));
  lehrkraefte.forEach((f, i) => {
    const x = 100 + lAbstand * (i + 0.5);
    kopf(ctx, lehrerBilder[i], x, lehrerY, 44, null, FAECHER[f].lehrer[0], rng);
    namensschild(ctx, x, lehrerY + 62, fotoName(FAECHER[f].lehrer.replace(/^(Frau|Herr|Mr\.|Coach)\s+(Dr\.\s+)?/, '')), 15);
  });

  // Schüler:innen
  const bilder = await Promise.all(personen.map((p) => bildLaden(c, p.avatar)));
  const gags = shuffleWith(rng, personen.map((_, i) => i));
  const hut = gags[0];
  const brille = personen.length > 1 ? gags[1] : -1;
  const wackel = personen.length > 2 ? gags[2] : -1;
  const plaetze = [];
  const schritt = Math.min((W - 220) / proReihe, 170);
  for (let r = 0; r < reihen; r++) {
    const inReihe = personen.slice(r * proReihe, (r + 1) * proReihe);
    const start = W / 2 - (inReihe.length * schritt) / 2;
    const versatz = r % 2 ? schritt * 0.25 : 0; // Reihen leicht versetzt, damit man alle sieht
    inReihe.forEach((p, i) => plaetze.push({ idx: r * proReihe + i, reihe: r, x: start + schritt * (i + 0.5) + versatz, y: ersteReihe + r * abstand }));
  }
  const farben = ['#3498db', '#e67e22', '#9b59b6', '#1abc9c', '#e74c3c', '#f1c40f', '#2ecc71', '#34495e', '#ff6b81', '#16a085'];
  for (let r = 0; r < reihen; r++) {
    const reihe = plaetze.filter((p) => p.reihe === r);
    for (const p of reihe) koerper(ctx, p.x, p.y, 48, farben[Math.floor(rng() * farben.length)]);
    for (const p of reihe) {
      const person = personen[p.idx];
      if (p.idx === wackel) kopf(ctx, bilder[p.idx], p.x + 9, p.y - 4, 48, null, person.name[0] ?? '?', rng, 0.45);
      kopf(ctx, bilder[p.idx], p.x, p.y, 48, person.name, (person.name[0] ?? '?').toUpperCase(), rng, p.idx === wackel ? 0.75 : 1);
      if (p.idx === hut) partyhut(ctx, p.x, p.y, 48);
      if (p.idx === brille) sonnenbrille(ctx, p.x, p.y, 48);
    }
  }

  // Vorne: Willy mit Besen, Heinz, Ente
  const willyX = W / 2 - 120;
  koerper(ctx, willyX, vorneY, 60, '#2c6e49');
  kopf(ctx, await bildLaden(c, path.join(ASSETS, 'willy-avatar.png')), willyX, vorneY, 60, null, 'W', rng);
  besen(ctx, willyX + 85, vorneY);
  namensschild(ctx, willyX, vorneY + 82, 'Hausmeister Willy (Fotograf)', 17, 300);
  kaktus(ctx, W / 2 + 180, vorneY + 10);
  ente(ctx, W - 260 - Math.floor(rng() * 200), vorneY + 70);

  daumen(ctx, fotoH);
  ctx.restore();

  // Bildunterschrift
  ctx.fillStyle = '#2c3e50';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 28px Klasse';
  ctx.fillText(`Klassenfoto · ${datum.split('-').reverse().join('.')} · Fotograf: Hausmeister Willy`, W / 2, fotoH + 38, W - 100);
  ctx.font = '20px Klasse';
  ctx.fillStyle = '#7f8c8d';
  ctx.fillText(
    `${personen.length} Schüler:innen · ${lehrkraefte.length} Lehrkräfte · 1 Kaktus · 1 Ente · Wer fehlt, war krank (oder auf dem Klo).`,
    W / 2,
    fotoH + 74,
    W - 100,
  );
  return canvas.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
const cooldown = new Map(); // guildId -> Zeitstempel

export async function handleKlassenfoto(interaction) {
  const guild = interaction.guild;
  const warten = (cooldown.get(guild.id) ?? 0) + 5 * 60_000 - Date.now();
  if (warten > 0) {
    return interaction.reply({ content: `📸 Der Fotograf wechselt noch den Film. Noch ${Math.ceil(warten / 60_000)} Minuten.`, flags: MessageFlags.Ephemeral });
  }
  cooldown.set(guild.id, Date.now());
  await interaction.deferReply();
  try {
    const personen = (await leute(guild)).map((m) => ({ name: fotoName(m.displayName), avatar: m.displayAvatarURL({ extension: 'png', size: 128 }) }));
    const datum = localNow(config.spass.zeitzone).date;
    const png = await klassenfotoBild({ servername: guild.name, personen, datum, seed: `${guild.id}:${Date.now()}` });
    if (!png) return interaction.editReply('📷 Die Kamera fehlt (Paket `@napi-rs/canvas` ist nicht installiert). Einmal `npm install` und neu starten.');
    return interaction.editReply({
      content: '📸 **Alle mal lächeln!** … … Und nochmal, jemand hatte die Augen zu. … Egal, wird so genommen.',
      files: [new AttachmentBuilder(png, { name: 'klassenfoto.png' })],
      allowedMentions: { parse: [] },
    });
  } catch (err) {
    logError('klassenfoto', err);
    return interaction.editReply('📷 Die Kamera ist runtergefallen. Versuch es später nochmal.');
  }
}
