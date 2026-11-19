// Das Zeugnis als richtiges PDF (A4) zum Ausdrucken. Eindeutig als Quatsch gekennzeichnet.
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const WAPPEN = path.resolve('assets', 'icons', 'kartoffel.png');
const W = 595.28;
const H = 841.89;

const C = {
  papier: '#fbf7ec',
  gruen: '#1f4d3a',
  gold: '#b8902f',
  text: '#222222',
  grau: '#6b6b6b',
  zeile: '#efe7d3',
  rot: '#b3261e',
};

// Standard-PDF-Schriften können keine Emojis: alles außerhalb von Latin-1 (plus deutsche Anführungszeichen) entfernen
const clean = (t) =>
  String(t)
    .replace(/[^\x20-\x7E -ÿ–—„“”‚‘’…·]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Zierlinie mit Wellen (wie auf Urkunden). */
function guilloche(doc, x, y, w, h, color) {
  doc.save().lineWidth(0.4).strokeColor(color).opacity(0.35);
  for (let k = 0; k < 6; k++) {
    doc.moveTo(x, y + h / 2);
    for (let i = 0; i <= w; i += 4) {
      doc.lineTo(x + i, y + h / 2 + Math.sin(i / 9 + k * 0.9) * (h / 2) * Math.cos(i / 47 + k));
    }
    doc.stroke();
  }
  doc.restore();
}

/** Krakelige Unterschrift. */
function unterschrift(doc, x, y, w, seed) {
  doc.save().lineWidth(1.1).strokeColor('#1a2a6c');
  doc.moveTo(x, y);
  let px = x;
  for (let i = 0; i < 7; i++) {
    const nx = px + w / 7;
    const a = Math.sin(seed * 3.1 + i * 1.7) * 14;
    const b = Math.cos(seed * 1.3 + i * 2.3) * 16;
    doc.bezierCurveTo(px + w / 21, y - 18 + a, nx - w / 21, y + 12 + b, nx, y + Math.sin(i + seed) * 4);
    px = nx;
  }
  doc.stroke().restore();
}

/** Roter Stempel der Hausmeisterei. */
function stempel(doc, cx, cy, r) {
  doc.save().rotate(-14, { origin: [cx, cy] }).opacity(0.72);
  doc.lineWidth(2.4).strokeColor(C.rot).circle(cx, cy, r).stroke();
  doc.lineWidth(0.9).circle(cx, cy, r - 6).stroke();
  doc.fillColor(C.rot).font('Helvetica-Bold').fontSize(6.5);
  doc.text('HAUSMEISTEREI', cx - r, cy - 21, { width: 2 * r, align: 'center', characterSpacing: 0.6, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(13).text('GEPRÜFT', cx - r, cy - 8, { width: 2 * r, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(6.5).text('(vermutlich)', cx - r, cy + 9, { width: 2 * r, align: 'center', lineBreak: false });
  doc.restore();
}

/**
 * Baut das Zeugnis-PDF. daten = Ergebnis von zeugnisDaten() (fun.js).
 * Gibt einen Buffer zurück.
 */
export function zeugnisPdf(daten) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      info: { Title: `Zeugnis ${clean(daten.name)}`, Author: 'Hausmeister Willy', Subject: 'Quatsch-Zeugnis (ohne jede Gültigkeit)' },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Papier, Rahmen, Wasserzeichen
    doc.rect(0, 0, W, H).fill(C.papier);
    doc.lineWidth(5).strokeColor(C.gruen).rect(22, 22, W - 44, H - 44).stroke();
    doc.lineWidth(1).strokeColor(C.gold).rect(31, 31, W - 62, H - 62).stroke();
    for (const [x, y] of [
      [31, 31],
      [W - 31, 31],
      [31, H - 31],
      [W - 31, H - 31],
    ]) {
      doc.circle(x, y, 7).fill(C.gold);
      doc.circle(x, y, 3).fill(C.papier);
    }
    doc
      .save()
      .rotate(-35, { origin: [W / 2, H / 2] })
      .opacity(0.05)
      .fillColor(C.gruen)
      .font('Times-Bold')
      .fontSize(120)
      .text('OHNE GEWÄHR', 0, H / 2 - 60, { width: W, align: 'center' })
      .restore();

    // Kopf
    guilloche(doc, 50, 48, W - 100, 26, C.gruen);
    if (fs.existsSync(WAPPEN)) {
      doc.save().circle(92, 128, 38).clip().image(WAPPEN, 54, 90, { width: 76, height: 76 }).restore();
      doc.lineWidth(2).strokeColor(C.gold).circle(92, 128, 38).stroke();
    }
    doc.fillColor(C.gruen).font('Times-Bold').fontSize(11).text('WILLY-GESAMTSCHULE FÜR ANGEWANDTEN UNSINN', 140, 96, { width: W - 190, align: 'center', characterSpacing: 1.2 });
    doc.font('Times-Italic').fontSize(9).fillColor(C.grau).text('Staatlich nicht anerkannt · Gegründet 2009 (geschätzt)', 140, 111, { width: W - 190, align: 'center' });
    doc.font('Times-Bold').fontSize(42).fillColor(C.gruen).text('ZEUGNIS', 140, 128, { width: W - 190, align: 'center', characterSpacing: 6 });
    doc.font('Times-Roman').fontSize(12).fillColor(C.text).text(`${daten.halbjahr} · Schuljahr ${daten.schuljahr}`, 140, 176, { width: W - 190, align: 'center' });
    doc.moveTo(60, 205).lineTo(W - 60, 205).lineWidth(0.8).strokeColor(C.gold).stroke();

    // Personalien
    const feld = (label, wert, x, y, w) => {
      doc.font('Helvetica').fontSize(8).fillColor(C.grau).text(label.toUpperCase(), x, y, { width: w, characterSpacing: 0.8 });
      doc.font('Times-Bold').fontSize(14).fillColor(C.text).text(wert, x, y + 11, { width: w, ellipsis: true, height: 18 });
      doc.moveTo(x, y + 30).lineTo(x + w, y + 30).lineWidth(0.4).strokeColor(C.grau).stroke();
    };
    feld('Name', clean(daten.name) || 'Unbekannt', 60, 218, 250);
    feld('Klasse', '??? (Raum 204 oder 206)', 330, 218, 205);
    feld('Geboren am', 'ja', 60, 258, 250);
    feld('Aktenzeichen', daten.aktenzeichen, 330, 258, 205);

    // Noten
    let y = 312;
    doc.font('Times-Bold').fontSize(13).fillColor(C.gruen).text('Leistungen in den Fächern', 60, y);
    y += 22;
    daten.noten.forEach((n, i) => {
      if (i % 2 === 0) doc.rect(60, y - 4, W - 120, 20).fill(C.zeile);
      doc.font('Times-Roman').fontSize(12).fillColor(C.text).text(clean(n.fach), 70, y, { width: 260 });
      doc.font('Times-Bold').fontSize(12).text(`${n.text}`, 340, y, { width: 40, align: 'center' });
      doc.font('Times-Italic').fontSize(11).fillColor(C.grau).text(`(${n.wort})`, 385, y + 1, { width: 140 });
      y += 20;
    });
    doc.rect(60, y + 2, W - 120, 24).lineWidth(1).strokeColor(C.gruen).stroke();
    doc.font('Times-Bold').fontSize(12).fillColor(C.gruen).text(`Durchschnitt: ${daten.schnitt}`, 70, y + 8, { width: 250 });
    doc.font('Times-Roman').fontSize(10).fillColor(C.grau).text('(gerundet nach Gefühl)', 340, y + 9, { width: 185 });
    y += 42;

    // Verhalten & Fehltage
    doc.font('Times-Bold').fontSize(13).fillColor(C.gruen).text('Verhalten', 60, y);
    doc.text('Fehltage', 330, y);
    y += 20;
    daten.verhalten.forEach(([k, v], i) => {
      doc.font('Times-Roman').fontSize(10.5).fillColor(C.text).text(`${k}: `, 60, y + i * 15, { continued: true }).font('Times-Italic').text(clean(v));
    });
    const f = daten.fehltage;
    [`entschuldigt: ${f.entschuldigt}`, `unentschuldigt: ${f.unentschuldigt}`, `gefühlt: ${f.gefuehlt}`].forEach((t, i) => {
      doc.font('Times-Roman').fontSize(10.5).fillColor(C.text).text(t, 330, y + i * 15);
    });
    y += 58;

    // Bemerkung & Versetzung (fließend untereinander)
    doc.font('Times-Bold').fontSize(13).fillColor(C.gruen).text('Bemerkungen', 60, y);
    y += 19;
    doc.font('Times-Italic').fontSize(11).fillColor(C.text).text(clean(daten.bemerkung), 60, y, { width: 330 });
    doc.moveDown(0.5);
    doc.font('Times-Bold').fontSize(11.5).fillColor(C.text).text('Versetzung: ', 60, doc.y, { continued: true, width: 330 }).font('Times-Roman').text(clean(daten.versetzung));
    doc.moveDown(0.5);
    doc.font('Times-Roman').fontSize(10).fillColor(C.grau).text(`Ausgestellt am ${daten.datum}`, 60, doc.y, { width: 330 });

    // Stempel rechts neben Bemerkung/Versetzung
    stempel(doc, 470, y + 22, 42);

    // Unterschriften (fest unten)
    const sy = 720;
    const sig = (x, label, name, seed) => {
      if (seed) unterschrift(doc, x + 8, sy - 8, 120, seed);
      doc.moveTo(x, sy + 6).lineTo(x + 150, sy + 6).lineWidth(0.6).strokeColor(C.text).stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor(C.grau).text(label, x, sy + 10, { width: 150, align: 'center' });
      doc.font('Times-Italic').fontSize(9).fillColor(C.text).text(name, x, sy + 20, { width: 150, align: 'center' });
    };
    sig(60, 'KLASSENLEITUNG', 'Heinz (Kaktus)', 1.7);
    sig(222, 'SCHULLEITUNG (VERTRETUNGSWEISE)', 'Hausmeister Willy', 4.2);
    sig(384, 'ERZIEHUNGSBERECHTIGTE', '(bitte nicht unterschreiben)', 0);

    // Fußzeile
    guilloche(doc, 50, H - 80, W - 100, 12, C.gold);
    doc
      .font('Helvetica')
      .fontSize(6.8)
      .fillColor(C.grau)
      .text(
        'Dieses Zeugnis wurde von Hausmeister Willy (Discord-Bot) ausgestellt, ist reiner Quatsch und hat keinerlei Gültigkeit. ' +
          'Gegen dieses Zeugnis kann mit Formular W-1 Widerspruch eingelegt werden (wird ignoriert).',
        60,
        H - 62,
        { width: W - 120, align: 'center' },
      );

    doc.end();
  });
}
