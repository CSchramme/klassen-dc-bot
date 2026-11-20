// Der Willy-Kurier als echte Zeitungsseite (A4): einmal als Bild für Discord, einmal als PDF zum Ausdrucken.
// Beides wird mit demselben Code gemalt, nur einmal auf ein Bild und einmal in ein PDF.
import path from 'node:path';
import { truncate } from '../util.js';
import { FAECHER } from './schule-daten.js';
import { canvasLaden, ohneEmoji, rundesRechteck, umbrechen } from './leinwand.js';

const A4_B = 595;
const A4_H = 842;
const RAND = 36;
const INNEN = A4_B - 2 * RAND;
const TINTE = '#1d1d1b';
const GRAU = '#55524a';
const PAPIER = '#f6f1e3';

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function datumLang(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${TAGE[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONATE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function linie(ctx, x1, y, x2, dicke = 0.6) {
  ctx.strokeStyle = TINTE;
  ctx.lineWidth = dicke;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

/** Textblock mit Umbruch. Gibt die y-Position nach dem Block zurück. */
function block(ctx, text, x, y, breite, { font = '10px Zeitung', farbe = TINTE, zeilenhoehe = 13, maxZeilen = 99, ausrichtung = 'left' } = {}) {
  ctx.font = font;
  ctx.fillStyle = farbe;
  ctx.textAlign = ausrichtung;
  ctx.textBaseline = 'alphabetic';
  let zeilen = umbrechen(ctx, text, breite);
  if (zeilen.length > maxZeilen) {
    zeilen = zeilen.slice(0, maxZeilen);
    zeilen[maxZeilen - 1] = `${zeilen[maxZeilen - 1].replace(/\s*\S*$/, '')} …`;
  }
  const xText = ausrichtung === 'center' ? x + breite / 2 : x;
  for (const z of zeilen) {
    y += zeilenhoehe;
    ctx.fillText(z, xText, y);
  }
  return y;
}

function rubrik(ctx, titel, x, y, breite) {
  ctx.font = 'bold 9px Klasse';
  ctx.fillStyle = TINTE;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(titel.toUpperCase(), x, y + 9);
  linie(ctx, x, y + 13, x + breite, 1.2);
  return y + 15;
}

/** Bild in Graustufen (wie in einer echten Zeitung). */
async function graustufen(c, datei) {
  try {
    const bild = await c.loadImage(datei);
    const cv = c.createCanvas(bild.width, bild.height);
    const cx = cv.getContext('2d');
    cx.drawImage(bild, 0, 0);
    const daten = cx.getImageData(0, 0, bild.width, bild.height);
    const d = daten.data;
    for (let i = 0; i < d.length; i += 4) {
      const grau = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      const getoent = Math.min(255, grau * 0.92 + 18); // leicht vergilbt
      d[i] = getoent;
      d[i + 1] = getoent * 0.97;
      d[i + 2] = getoent * 0.9;
    }
    cx.putImageData(daten, 0, 0);
    return await c.loadImage(cv.toBuffer('image/png'));
  } catch {
    return null;
  }
}

function stempel(ctx, text, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.22);
  ctx.strokeStyle = 'rgba(192,57,43,0.85)';
  ctx.fillStyle = 'rgba(192,57,43,0.85)';
  ctx.lineWidth = 2;
  ctx.font = 'bold 15px Klasse';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 20;
  rundesRechteck(ctx, -w / 2, -14, w, 28, 4);
  ctx.stroke();
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

/** Malt die Seite auf einen Kontext (Bild oder PDF), Einheiten: Punkt (A4 = 595 × 842). */
function seiteMalen(ctx, d, foto) {
  ctx.fillStyle = PAPIER;
  ctx.fillRect(0, 0, A4_B, A4_H);

  // Kopfzeile
  ctx.font = '7.5px Klasse';
  ctx.fillStyle = GRAU;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('UNABHÄNGIG · ÜBERPARTEILICH · UNGELESEN', RAND, 42);
  ctx.textAlign = 'right';
  ctx.fillText(`AUSGABE NR. ${d.ausgabe}`, A4_B - RAND, 42);

  // Zeitungskopf
  ctx.fillStyle = TINTE;
  ctx.textAlign = 'center';
  ctx.font = 'bold 50px Zeitung';
  ctx.fillText('Willy-Kurier', A4_B / 2, 92, INNEN);
  linie(ctx, RAND, 104, A4_B - RAND, 0.6);
  ctx.font = '8px Klasse';
  ctx.fillStyle = TINTE;
  ctx.fillText(`Die Schülerzeitung der Hausmeisterei · ${datumLang(d.datum)} · Preis: 1 Socke · Auflage: 3 Stück`, A4_B / 2, 115, INNEN);
  linie(ctx, RAND, 121, A4_B - RAND, 2);
  linie(ctx, RAND, 124.5, A4_B - RAND, 0.6);

  // Schlagzeile
  let y = block(ctx, d.titel, RAND, 132, INNEN, { font: 'bold 28px Zeitung', zeilenhoehe: 32, maxZeilen: 3 });
  y = block(ctx, d.unterzeile, RAND, y + 2, INNEN, { font: '12.5px Zeitung', farbe: GRAU, zeilenhoehe: 16, maxZeilen: 2 });
  y += 12;
  linie(ctx, RAND, y, A4_B - RAND, 0.6);
  y += 8;

  // Kommentar (links) und Foto (rechts)
  const fotoB = 170;
  const textB = INNEN - fotoB - 18;
  const startY = y;
  let yt = rubrik(ctx, 'Kommentar der Chefredaktion', RAND, y, textB);
  const kommentar = `${d.kommentar} (Fortsetzung auf Seite 2.)`;
  // Initiale
  ctx.font = 'bold 34px Zeitung';
  ctx.fillStyle = TINTE;
  ctx.textAlign = 'left';
  const initiale = kommentar[0];
  ctx.fillText(initiale, RAND, yt + 30);
  const initB = ctx.measureText(initiale).width + 4;
  // Umbruch: die ersten zwei Zeilen neben der Initiale sind schmaler
  ctx.font = '10.5px Zeitung';
  const zeilen = [];
  let zeile = '';
  for (const wort of kommentar.slice(1).split(/\s+/)) {
    const probe = zeile ? `${zeile} ${wort}` : wort;
    if (ctx.measureText(probe).width <= (zeilen.length < 2 ? textB - initB : textB) || !zeile) zeile = probe;
    else {
      zeilen.push(zeile);
      zeile = wort;
    }
  }
  if (zeile) zeilen.push(zeile);
  const maxK = 11;
  if (zeilen.length > maxK) {
    zeilen.length = maxK;
    zeilen[maxK - 1] = `${zeilen[maxK - 1].replace(/\s*\S*$/, '')} …`;
  }
  let yk = yt;
  zeilen.forEach((z, i) => {
    yk += 14;
    const x = i < 2 ? RAND + initB : RAND;
    ctx.fillText(z, x, yk, i < 2 ? textB - initB : textB);
  });
  if (zeilen.length < 2) yk = yt + 30;
  yk = block(ctx, '– Hausmeister Willy, Chefredakteur', RAND, yk + 2, textB, { font: '9px Zeitung', farbe: GRAU, zeilenhoehe: 13, ausrichtung: 'left' });

  // Foto
  const fx = A4_B - RAND - fotoB;
  if (foto.bild) ctx.drawImage(foto.bild, fx, startY + 2, fotoB, fotoB);
  else {
    ctx.fillStyle = '#d9d2c0';
    ctx.fillRect(fx, startY + 2, fotoB, fotoB);
  }
  ctx.strokeStyle = TINTE;
  ctx.lineWidth = 0.6;
  ctx.strokeRect(fx, startY + 2, fotoB, fotoB);
  const yf = block(ctx, foto.text, fx, startY + fotoB + 2, fotoB, { font: '8px Zeitung', farbe: GRAU, zeilenhoehe: 10.5, maxZeilen: 4 });
  if (d.vorab) stempel(ctx, 'VORABDRUCK', fx + fotoB - 62, startY + 30);

  // Kurz notiert: füllt den Platz neben dem Foto
  if (d.kurz?.length && yk + 45 < yf) {
    yk = rubrik(ctx, 'Kurz notiert', RAND, yk + 12, textB);
    for (const meldung of d.kurz) {
      if (yk + 28 > yf + 6) break;
      yk = block(ctx, `– ${ohneEmoji(meldung)}`, RAND, yk, textB, { font: '9.5px Zeitung', zeilenhoehe: 12.5, maxZeilen: 2 }) + 4;
    }
  }

  y = Math.max(yk, yf) + 12;
  linie(ctx, RAND, y, A4_B - RAND, 0.6);
  y += 8;

  // Drei Spalten
  const spB = (INNEN - 2 * 16) / 3;
  const sx = [RAND, RAND + spB + 16, RAND + 2 * (spB + 16)];
  const unten = A4_H - 150; // Platz für Kleinanzeigen und Fußzeile
  const spalten = [];

  // 1: Zahlen der Woche
  let s1 = rubrik(ctx, 'Zahlen der Woche', sx[0], y, spB);
  if (!d.zahlen.length) s1 = block(ctx, 'Keine. Alle haben geschlafen.', sx[0], s1, spB, { font: '10px Zeitung', zeilenhoehe: 13 });
  for (const z of d.zahlen) {
    if (s1 > unten - 14) break;
    ctx.font = 'bold 15px Zeitung';
    ctx.fillStyle = TINTE;
    ctx.textAlign = 'left';
    const zahl = String(z.zahl);
    ctx.fillText(zahl, sx[0], s1 + 16);
    const zb = ctx.measureText(zahl).width + 5;
    s1 = block(ctx, z.label, sx[0] + zb, s1 + 3, spB - zb, { font: '9.5px Zeitung', zeilenhoehe: 12, maxZeilen: 2 }) + 3;
  }
  spalten.push(s1);

  // 2: Die Besten + Spitznamen
  let s2 = rubrik(ctx, 'Die Besten der Woche', sx[1], y, spB);
  if (d.beste.length) {
    d.beste.forEach((b, i) => {
      s2 = block(ctx, `${i + 1}. ${ohneEmoji(b.name) || '???'} (${b.punkte} Punkte)`, sx[1], s2, spB, { font: i === 0 ? 'bold 10.5px Zeitung' : '10px Zeitung', zeilenhoehe: 14, maxZeilen: 2 });
    });
    s2 = block(ctx, 'Die Redaktion gratuliert. Ein bisschen.', sx[1], s2 + 2, spB, { font: '8.5px Zeitung', farbe: GRAU, zeilenhoehe: 11 });
  } else {
    s2 = block(ctx, 'Diese Woche hat niemand gewonnen. Nicht mal Willy.', sx[1], s2, spB, { font: '10px Zeitung', zeilenhoehe: 13 });
  }
  if (d.spitznamen.length) {
    s2 = rubrik(ctx, 'Spitznamen der Woche', sx[1], s2 + 10, spB);
    s2 = block(ctx, d.spitznamen.map((n) => `„${ohneEmoji(n) || '???'}“`).join(', '), sx[1], s2, spB, { font: '10px Zeitung', zeilenhoehe: 13, maxZeilen: 5 });
  }
  spalten.push(s2);

  // 3: Wetter + Horoskop
  let s3 = rubrik(ctx, 'Wetter', sx[2], y, spB);
  s3 = block(ctx, ohneEmoji(d.wetter), sx[2], s3, spB, { font: '10px Zeitung', zeilenhoehe: 13, maxZeilen: 4 });
  s3 = rubrik(ctx, 'Horoskop', sx[2], s3 + 10, spB);
  s3 = block(ctx, `Für alle Sternzeichen: ${ohneEmoji(d.horoskop)}`, sx[2], s3, spB, { font: '10px Zeitung', zeilenhoehe: 13, maxZeilen: 5 });
  s3 = rubrik(ctx, 'Rätsel', sx[2], s3 + 10, spB);
  s3 = block(ctx, 'Das Wort des Tages hat 5 Buchstaben. Mehr verraten wir nicht. Lösen mit /wort raten.', sx[2], s3, spB, { font: '10px Zeitung', zeilenhoehe: 13, maxZeilen: 4 });
  spalten.push(s3);

  // Spaltenlinien
  const spaltenEnde = Math.min(Math.max(...spalten), unten) + 6;
  for (const x of [sx[1] - 8, sx[2] - 8]) {
    ctx.strokeStyle = TINTE;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, spaltenEnde);
    ctx.stroke();
  }

  // Kleinanzeigen im Kasten
  const ky = Math.max(spaltenEnde + 10, A4_H - 140);
  ctx.strokeStyle = TINTE;
  ctx.lineWidth = 1;
  ctx.strokeRect(RAND, ky, INNEN, 80);
  ctx.font = 'bold 9px Klasse';
  ctx.fillStyle = TINTE;
  ctx.textAlign = 'center';
  ctx.fillText('KLEINANZEIGEN', A4_B / 2, ky + 14);
  const anzeigen = d.anzeigen.slice(0, 4).map(ohneEmoji);
  const ab = (INNEN - 30) / 2;
  anzeigen.forEach((a, i) => {
    block(ctx, a, RAND + 10 + (i % 2) * (ab + 10), ky + 18 + Math.floor(i / 2) * 28, ab, { font: '9px Zeitung', zeilenhoehe: 11.5, maxZeilen: 2 });
  });

  // Fußzeile
  linie(ctx, RAND, A4_H - 48, A4_B - RAND, 0.6);
  ctx.font = '7.5px Klasse';
  ctx.fillStyle = GRAU;
  ctx.textAlign = 'left';
  ctx.fillText(`Berichtszeitraum: seit ${d.seitText} · Druckerei: Willys Kopierer (kaputt) · Alle Angaben ohne Gewähr`, RAND, A4_H - 36, INNEN - 60);
  ctx.textAlign = 'right';
  ctx.fillText('Seite 1 von 1', A4_B - RAND, A4_H - 36);
}

/**
 * Druckt die Ausgabe: { png, pdf } (Buffer) oder null, wenn @napi-rs/canvas fehlt.
 * d: { ausgabe, datum, vorab, titel, unterzeile, kommentar, zahlen: [{zahl, label}], beste: [{name, punkte}],
 *      spitznamen: [], wetter, horoskop, anzeigen: [], seitText, fotoFach (Fach-Key oder null = Willy) }
 */
export async function kurierDruck(d) {
  const c = await canvasLaden();
  if (!c) return null;
  const daten = { ...d, titel: truncate(ohneEmoji(d.titel), 140), unterzeile: ohneEmoji(d.unterzeile), kommentar: ohneEmoji(d.kommentar) || '…' };
  const lehrkraft = d.fotoFach && FAECHER[d.fotoFach];
  const foto = {
    bild: await graustufen(c, lehrkraft ? path.resolve('assets', 'lehrer', lehrkraft.avatar) : path.resolve('assets', 'willy-avatar.png')),
    text: lehrkraft
      ? `Lehrkraft der Woche: ${lehrkraft.lehrer} (${lehrkraft.name}). Wollte nicht fotografiert werden. Wurde trotzdem.`
      : 'Chefredakteur Willy bei der Recherche. (Foto gestellt, Besen echt.)',
  };

  const SKALA = 2;
  const canvas = c.createCanvas(A4_B * SKALA, A4_H * SKALA);
  const ctx = canvas.getContext('2d');
  ctx.scale(SKALA, SKALA);
  seiteMalen(ctx, daten, foto);
  const png = canvas.toBuffer('image/png');

  const doc = new c.PDFDocument({ title: `Willy-Kurier Nr. ${d.ausgabe}`, author: 'Hausmeister Willy', creator: 'Hausmeister Willy', subject: 'Schülerzeitung' });
  seiteMalen(doc.beginPage(A4_B, A4_H), daten, foto);
  doc.endPage();
  const pdf = doc.close();
  return { png, pdf };
}
