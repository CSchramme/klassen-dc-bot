// Gemeinsames Laden von @napi-rs/canvas (optional) und der mitgelieferten Schriften.
//  - "Klasse": DejaVu Sans (normal und fett)
//  - "Kreide": Caveat (Handschrift, SIL Open Font License)
//  - "Zeitung": DejaVu Serif (normal und fett)
import path from 'node:path';
import { logError } from '../util.js';

const FONTS = path.resolve('assets', 'fonts');
let modul;

/** Gibt das Canvas-Modul zurück oder null, wenn das Paket fehlt. */
export async function canvasLaden() {
  if (modul !== undefined) return modul;
  try {
    modul = await import('@napi-rs/canvas');
    modul.GlobalFonts.registerFromPath(path.join(FONTS, 'DejaVuSans.ttf'), 'Klasse');
    modul.GlobalFonts.registerFromPath(path.join(FONTS, 'DejaVuSans-Bold.ttf'), 'Klasse');
    modul.GlobalFonts.registerFromPath(path.join(FONTS, 'Caveat.ttf'), 'Kreide');
    modul.GlobalFonts.registerFromPath(path.join(FONTS, 'DejaVuSerif.ttf'), 'Zeitung');
    modul.GlobalFonts.registerFromPath(path.join(FONTS, 'DejaVuSerif-Bold.ttf'), 'Zeitung');
  } catch (err) {
    logError('canvas', err);
    modul = null;
  }
  return modul;
}

/** Abgerundetes Rechteck als Pfad. */
export function rundesRechteck(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Emojis entfernen (die mitgelieferten Schriften haben keine bunten Emojis). */
export const ohneEmoji = (text) =>
  (text ?? '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

/** Zeilen umbrechen, sodass alles in die Breite passt (mit der aktuellen Schrift). Sehr lange Wörter werden zerteilt. */
export function umbrechen(ctx, text, breite) {
  const zeilen = [];
  for (const absatz of text.split('\n')) {
    let zeile = '';
    for (let wort of absatz.split(' ')) {
      while (ctx.measureText(wort).width > breite) {
        let n = wort.length - 1;
        while (n > 1 && ctx.measureText(wort.slice(0, n)).width > breite) n--;
        if (zeile) zeilen.push(zeile);
        zeilen.push(wort.slice(0, n));
        zeile = '';
        wort = wort.slice(n);
      }
      const probe = zeile ? `${zeile} ${wort}` : wort;
      if (ctx.measureText(probe).width <= breite) zeile = probe;
      else {
        zeilen.push(zeile);
        zeile = wort;
      }
    }
    zeilen.push(zeile);
  }
  return zeilen;
}
