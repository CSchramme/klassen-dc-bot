// Gemeinsames Laden von @napi-rs/canvas (optional) und der mitgelieferten Schriften.
//  - "Klasse": DejaVu Sans (normal und fett)
//  - "Kreide": Caveat (Handschrift, SIL Open Font License)
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
