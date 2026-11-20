// Selbsttest ohne Discord-Verbindung: prüft Layout, Nachrichten-Limits, Befehle,
// spielt das Captcha mit einem simulierten Nutzer durch und testet die Quatsch-Moderation.
// Aufruf: npm run check
import assert from 'node:assert/strict';
import { Collection, PermissionFlagsBits } from 'discord.js';

process.chdir(new URL('..', import.meta.url).pathname);
// Testdaten nicht in die echte data/state.json schreiben
const os = await import('node:os');
const fs = await import('node:fs');
const path = await import('node:path');
process.env.STATE_FILE = path.join(os.tmpdir(), `klassen-bot-check-${process.pid}.json`);
process.on('exit', () => fs.rmSync(process.env.STATE_FILE, { force: true }));

const { LAYOUT, ROLES, LOTTERY_ROLES, RULE_PAGES, TEAM_KODEX, BOT_NICKNAME, SERVER_NAME } = await import('../src/features/layout.js');
const { COMMANDS } = await import('../src/commands.js');
const { startMessage, rulesPage, allRulesMessage } = await import('../src/features/rules.js');
const { startCaptcha, handleCaptcha } = await import('../src/features/captcha.js');
const { lotteryMessage } = await import('../src/features/lottery.js');
const { ticketPanelMessage, handleTicket } = await import('../src/features/tickets.js');
const { handleModeration, ramEmbed, strafregisterEmbed } = await import('../src/features/moderation.js');
const { overwrites } = await import('../src/features/setup.js');
const { randomServerName, randomIconFile } = await import('../src/features/server.js');
const { guildState } = await import('../src/storage.js');
const fun = await import('../src/features/fun.js');
const { SOUNDS, uploadSounds } = await import('../src/features/sounds.js');
const { zeugnisPdf } = await import('../src/features/zeugnis-pdf.js');
const { noteFuer } = await import('../src/features/schule.js');
const { serverAbgleich } = await import('../src/features/setup.js');
const { FAECHER } = await import('../src/features/schule-daten.js');
const { FORMS, handleFormular, handleFormularCommand } = await import('../src/features/formulare.js');
const fsMod = await import('node:fs');
const { localNow, parseTime } = await import('../src/util.js');
const { fuerDiscord } = await import('../src/discord-text.js');

let ok = 0;
const check = (name, fn) => {
  try {
    fn();
    ok++;
  } catch (err) {
    console.error(`❌ ${name}\n   ${err.message}`);
    process.exitCode = 1;
  }
};

/** Payload so serialisieren, wie discord.js es täte (Builder validieren dabei). */
function serialize(payload) {
  const json = (x) => (typeof x?.toJSON === 'function' ? x.toJSON() : x);
  const out = { ...payload, embeds: payload.embeds?.map(json), components: payload.components?.map(json) };
  for (const e of out.embeds ?? []) {
    assert.ok(!e.title || e.title.length <= 256, `Embed-Titel zu lang: ${e.title}`);
    assert.ok(!e.description || e.description.length <= 4096, 'Embed-Beschreibung zu lang');
    for (const f of e.fields ?? []) assert.ok(f.value.length <= 1024, 'Feld zu lang');
  }
  assert.ok((out.embeds?.length ?? 0) <= 10, 'Mehr als 10 Embeds');
  assert.ok((out.components?.length ?? 0) <= 5, 'Mehr als 5 Komponenten-Reihen');
  for (const row of out.components ?? []) {
    assert.ok(row.components.length <= 5, 'Mehr als 5 Knöpfe in einer Reihe');
    for (const c of row.components) {
      if (c.custom_id) assert.ok(c.custom_id.length <= 100, 'custom_id zu lang');
      if (c.label) assert.ok(c.label.length <= 80, `Knopf-Label zu lang: ${c.label}`);
    }
  }
  if (out.content) assert.ok(out.content.length <= 2000, 'Nachricht zu lang');
  return out;
}

// ---------------------------------------------------------------- Layout
check('Layout', () => {
  let total = 0;
  const keys = new Set();
  assert.ok(SERVER_NAME.length <= 100);
  assert.ok([...BOT_NICKNAME].length <= 32, 'Bot-Spitzname > 32 Zeichen');
  for (const r of [...Object.values(ROLES), ...LOTTERY_ROLES]) assert.ok(r.name.length <= 100);
  for (const cat of LAYOUT) {
    assert.ok(cat.name.length <= 100, cat.name);
    assert.ok(['verifiziert', 'unverifiziert', 'team'].includes(cat.sicht), cat.name);
    assert.ok(cat.channels.length <= 50);
    for (const ch of cat.channels) {
      total++;
      assert.ok(ch.name.length >= 1 && ch.name.length <= 100, ch.name);
      if (ch.type === 'text') {
        assert.ok(!/[A-Z\s]/.test(ch.name), `Textkanal-Namen müssen klein und ohne Leerzeichen sein: ${ch.name}`);
        assert.ok(!ch.topic || ch.topic.length <= 1024);
      }
      if (ch.slowmode) assert.ok(ch.slowmode <= 21600);
      if (ch.key) {
        assert.ok(!keys.has(ch.key), `Key doppelt: ${ch.key}`);
        keys.add(ch.key);
      }
    }
  }
  for (const k of ['start', 'realRules', 'lottery', 'tickets', 'modlog', 'kodex', 'system', 'afk', 'announce', 'mathe', 'vertretung', 'pausenhof']) {
    assert.ok(keys.has(k), `Key fehlt: ${k}`);
  }
  assert.ok(LAYOUT.length + total <= 500);
});

// ---------------------------------------------------------------- Nachrichten
check('Startnachricht', () => serialize(startMessage()));
check('Regelseiten', () => RULE_PAGES.forEach((_, i) => serialize(rulesPage(i))));
check('Alle Regeln', () => serialize(allRulesMessage()));
check('Lotterie', () => serialize(lotteryMessage()));
check('Ticket-Panel', () => serialize(ticketPanelMessage()));
check('Team-Kodex', () => TEAM_KODEX.forEach((s) => assert.ok(s.title.length <= 256 && s.text.length <= 4096)));
check('Befehle', () => {
  assert.ok(COMMANDS.length <= 100);
  for (const c of COMMANDS) assert.match(c.name, /^[a-z_-]{1,32}$/);
  const names = COMMANDS.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, 'Befehl doppelt');
});
check('Server-Zufall', () => {
  assert.ok(randomServerName().length <= 100);
  assert.ok(randomIconFile().endsWith('.png'));
  assert.ok(randomIconFile({ animated: true }).endsWith('.gif'));
});

// ---------------------------------------------------------------- Spaß-Generatoren
check('Vertretungsplan & Zeugnis', () => {
  const a = serialize({ embeds: [fun.vertretungsplanEmbed('g1', 'Donnerstag, 19.11.', '2026-11-19')] });
  const b = serialize({ embeds: [fun.vertretungsplanEmbed('g1', 'Donnerstag, 19.11.', '2026-11-19')] });
  assert.deepEqual(a, b, 'Vertretungsplan muss am selben Tag gleich sein');
  const z1 = serialize({ embeds: [fun.zeugnisEmbed({ id: 'u1' }, 'Tim', '2026-11-19')] });
  const z2 = serialize({ embeds: [fun.zeugnisEmbed({ id: 'u1' }, 'Tim', '2026-11-19')] });
  assert.deepEqual(z1, z2, 'Zeugnis muss am selben Tag gleich sein');
  for (let i = 0; i < 200; i++) {
    serialize({ embeds: [fun.vertretungsplanEmbed(`g${i}`, 'Montag, 01.01.', `2027-01-${i}`)] });
    serialize({ embeds: [fun.zeugnisEmbed({ id: `u${i}` }, 'Ein sehr langer Anzeigename hier', `d${i}`)] });
  }
});
check('Ausreden, Hausaufgaben, Durchsagen, Spitznamen', () => {
  for (let i = 0; i < 300; i++) {
    for (const t of [fun.ausrede(), fun.hausaufgabe(), fun.durchsage(), fun.leetDurchsage()]) assert.ok(t.length > 10 && t.length <= 2000);
    assert.ok(fun.spitzname().length <= 32, `Spitzname zu lang: ${fun.spitzname()}`);
  }
  for (const n of fun.SPITZNAMEN) assert.ok(n.length <= 32, `Spitzname zu lang: ${n}`);
});
check('Uhrzeit-Helfer', () => {
  const t = localNow('Europe/Berlin', new Date('2026-11-19T12:37:00Z')); // 13:37 in Berlin (Winterzeit)
  assert.equal(t.minutes, 13 * 60 + 37);
  assert.equal(t.weekday, 4);
  assert.equal(t.date, '2026-11-19');
  assert.equal(parseTime('07:15'), 435);
  assert.equal(parseTime('quatsch', 99), 99);
});

// ---------------------------------------------------------------- Schul-Spiel
check('Schul-Noten & Fragen', () => {
  assert.equal(noteFuer({ anwesend: 0, punkte: 0, mitarbeit: 0, zuspaet: 0 }, 3), null, 'nie da = keine Note');
  assert.equal(noteFuer({ anwesend: 1, punkte: 6, mitarbeit: 3, zuspaet: 0 }, 1).text[0], '1', 'Alles richtig muss eine 1 geben');
  assert.ok(noteFuer({ anwesend: 1, punkte: 0, mitarbeit: 0, zuspaet: 1 }, 1).value >= 5, 'Nur da + zu spät muss schlecht sein');
  assert.ok(noteFuer({ anwesend: 1, punkte: 6, mitarbeit: 3, zuspaet: 0 }, 10).value > 1, 'Oft gefehlt muss die Note verschlechtern');
  for (const [key, f] of Object.entries(FAECHER)) {
    assert.ok(f.fragen.length >= 3, `${key}: zu wenige Fragen`);
    assert.ok(f.lehrer.length + f.name.length + 3 <= 80, `${key}: Webhook-Name zu lang`);
    assert.ok(fsMod.existsSync(`assets/lehrer/${f.avatar}`), `${key}: Avatar fehlt`);
    for (const q of f.fragen) {
      assert.equal(q.wrong.length, 3, `${key}: "${q.q}" braucht 3 falsche Antworten`);
      assert.ok(!q.wrong.includes(q.a), `${key}: "${q.q}" richtige Antwort steht bei den falschen`);
      assert.ok([q.a, ...q.wrong].every((o) => o.length <= 80), `${key}: Antwort zu lang`);
    }
  }
});

// ---------------------------------------------------------------- KI-Text für Discord (kein LaTeX)
check('LaTeX → Discord-Text', () => {
  const faelle = [
    ['$1 + 1$ ist $\\frac{2}{1}$, also $2$', '1 + 1 ist 2/1, also 2'],
    ['$x^2 + y^{2} = r^2$', 'x² + y² = r²'],
    ['$3 \\cdot 4 = 12$ und $10 \\div 2$', '3 · 4 = 12 und 10 ÷ 2'],
    ['$\\sqrt{9} = 3$', '√9 = 3'],
    ['$$\\frac{a+b}{2}$$', '(a+b)/2'],
    ['Der Winkel hat $90^\\circ$', 'Der Winkel hat 90°'],
    ['Das kostet 5$ und 10$.', 'Das kostet 5$ und 10$.'],
    ['$\\pi \\approx 3{,}14$', 'π ≈ 3,14'],
    ['$H_2O$', 'H₂O'],
  ];
  for (const [rein, raus] of faelle) assert.equal(fuerDiscord(rein), raus, `"${rein}"`);
});

// ---------------------------------------------------------------- Rechte
check('Rechte-Überschreibungen', () => {
  const guild = { roles: { everyone: { id: 'everyone' } }, client: { user: { id: 'bot' } } };
  const ids = { verified: 'ver', team: 'team' };
  const o = overwrites(guild, ids, 'verifiziert', true);
  const ev = o.find((x) => x.id === 'everyone');
  assert.ok(ev.deny.includes(PermissionFlagsBits.ViewChannel));
  assert.ok(o.find((x) => x.id === 'ver').allow.includes(PermissionFlagsBits.ViewChannel));
  assert.ok(o.find((x) => x.id === 'ver').deny.includes(PermissionFlagsBits.SendMessages));
  assert.ok(!o.find((x) => x.id === 'bot').deny.length);
  const u = overwrites(guild, ids, 'unverifiziert', false);
  assert.ok(u.find((x) => x.id === 'ver').deny.includes(PermissionFlagsBits.ViewChannel));
});

// ---------------------------------------------------------------- Captcha-Simulation
async function simulateCaptcha() {
  const guildId = 'g-test';
  guildState(guildId).ids.role_verified = 'role-ver';
  const roleAdds = [];
  let last = null;
  let modalShown = false;

  const role = { id: 'role-ver', name: ROLES.verified.name };
  const guild = { id: guildId, roles: { cache: new Collection([[role.id, role]]) } };
  const base = {
    user: { id: 'u1' },
    guildId,
    guild,
    member: { guild, roles: { cache: new Collection(), add: async (r) => roleAdds.push(r) } },
    update: async (p) => (last = serialize(p)),
    editReply: async (p) => (last = serialize(p)),
    reply: async (p) => {
      throw new Error(`Unerwartete Antwort: ${p.content}`);
    },
    showModal: async () => (modalShown = true),
    isFromMessage: () => true,
  };
  const title = () => last.embeds?.[0]?.title ?? '';
  const ids = () => last.components.flatMap((r) => r.components.map((c) => c.custom_id));

  await startCaptcha(base);
  assert.match(title(), /Identitätsprüfung/);
  await handleCaptcha(base, 'robot', 'nein');
  assert.match(title(), /Bilderrätsel/);

  // Ampeln anklicken
  const cells = last.components.slice(0, 3).flatMap((r) => r.components.map((c) => c.emoji?.name));
  for (let i = 0; i < 9; i++) if (['🚦', '🚥'].includes(cells[i])) await handleCaptcha(base, 'grid', String(i));
  await handleCaptcha(base, 'grid', 'ok');
  assert.match(title(), /Mathematik/);

  // Mathe: durchprobieren, bis es passt
  for (let tries = 0; tries < 50 && /Mathematik/.test(title()); tries++) {
    await handleCaptcha(base, 'math', String(tries % 4));
  }
  assert.match(title(), /Sprachtest/);

  await handleCaptcha(base, 'rev', null);
  assert.ok(modalShown, 'Modal wurde nicht gezeigt');
  const wrong = { ...base, fields: { getTextInputValue: () => 'falsch' } };
  await handleCaptcha(wrong, 'revmodal', null);
  assert.match(title(), /Sprachtest/);
  const right = { ...base, fields: { getTextInputValue: () => 'RETOBOR NIEK NIB HCI' } };
  await handleCaptcha(right, 'revmodal', null);
  assert.match(title(), /Persönlichkeitstest/);

  await handleCaptcha({ ...base, values: ['1'] }, 'prime', null);
  assert.match(title(), /Persönlichkeitstest/);
  await handleCaptcha({ ...base, values: ['9'] }, 'prime', null);
  assert.match(title(), /Persönlichkeitstest/);
  await handleCaptcha({ ...base, values: ['13'] }, 'prime', null);
  assert.match(title(), /Überprüfung/);

  // Ladebalken abwarten
  for (let i = 0; i < 40 && !ids().includes('cap:load:done'); i++) await new Promise((r) => setTimeout(r, 500));
  assert.ok(ids().includes('cap:load:done'), 'Ladebalken wurde nie fertig');
  await handleCaptcha(base, 'load', 'done');
  await handleCaptcha(base, 'confirm', '0');
  await handleCaptcha(base, 'confirm', '1');
  await handleCaptcha(base, 'confirm', '2g');
  if (ids().includes('cap:appeal')) await handleCaptcha(base, 'appeal', null);
  assert.match(title(), /Verifiziert/);
  assert.equal(roleAdds.length, 1, 'Rolle wurde nicht vergeben');
}

// ---------------------------------------------------------------- Moderation
async function simulateModeration() {
  const guildId = 'g-mod';
  const g = guildState(guildId);
  g.ids.ch_mathe = 'mathe';
  const events = [];
  const mk = (content, channelId = 'allg') => ({
    content,
    author: { id: 'u2' },
    member: { moderatable: true, timeout: async (ms) => events.push(['timeout', ms]) },
    guild: { id: guildId, channels: { cache: new Collection() } },
    channel: { id: channelId, parentId: null, send: async (p) => (events.push(['send', p.content]), { delete: async () => {} }) },
    delete: async () => events.push(['delete', content]),
    reply: async (p) => events.push(['reply', p.content]),
    react: async (e) => events.push(['react', e]),
  });

  await handleModeration(mk('Ich mag Gänse'));
  assert.ok(events.some((e) => e[0] === 'delete'), 'Gans wurde nicht gelöscht');
  assert.ok(events.some((e) => e[0] === 'timeout'), 'Kein Timeout für Gans');

  events.length = 0;
  await handleModeration(mk('Erster!'));
  assert.ok(events.some((e) => e[0] === 'reply' && /Zweiter/.test(e[1])));

  events.length = 0;
  await handleModeration(mk('mein pc hat zu wenig RAM'));
  assert.ok(events.some((e) => e[0] === 'react' && e[1] === '💾'), 'RAM Altman hat nicht reagiert');
  events.length = 0;
  await handleModeration(mk('ChatGPT hat meine Hausaufgaben gemacht', 'anderer-kanal'));
  assert.ok(events.some((e) => e[0] === 'react' && e[1] === '💾'), 'ChatGPT-Trigger fehlt');
  const { findInsider } = await import('../src/insider.js');
  assert.equal(findInsider('Das Programm ist ein Gramm schwer'), null, 'RAM-Trigger zu empfindlich');

  events.length = 0;
  await handleModeration(mk('abc 12', 'mathe'));
  assert.ok(events.some((e) => e[0] === 'delete'), 'Buchstaben im Mathe-Kanal nicht gelöscht');

  serialize({ embeds: [strafregisterEmbed({ id: guildId }, { id: 'u2', username: 'test' })] });
  serialize({ embeds: [ramEmbed({ id: guildId }, { id: 'u2', username: 'test' })] });
}

// ---------------------------------------------------------------- Animierte Logos
check('Animierte Logos', () => {
  const dir = 'assets/icons-animated';
  const gifs = fsMod.readdirSync(dir).filter((f) => f.endsWith('.gif'));
  assert.ok(gifs.length >= 3, 'zu wenige animierte Logos');
  for (const f of gifs) {
    const buf = fsMod.readFileSync(`${dir}/${f}`);
    assert.ok(buf.length <= 10 * 1024 * 1024, `${f} ist zu groß`);
    assert.equal(buf.subarray(0, 6).toString(), 'GIF89a', `${f} ist kein GIF`);
  }
});

// ---------------------------------------------------------------- Sounds
check('Sound-Dateien', () => {
  for (const snd of SOUNDS) {
    const size = fsMod.statSync(`assets/sounds/${snd.file}`).size;
    assert.ok(size > 1000 && size <= 512 * 1024, `${snd.file}: ${size} Bytes`);
    assert.ok(snd.name.length >= 2 && snd.name.length <= 32, snd.name);
    assert.ok(snd.volume > 0 && snd.volume <= 1);
  }
});

async function simulateSoundUpload() {
  let nid = 0;
  const log = [];
  const store = new Collection();
  const mk = (name) => { const sd = { soundId: 'sd' + nid++, name, async delete() { store.delete(sd.soundId); log.push(`-${name}`); } }; store.set(sd.soundId, sd); return sd; };
  for (const n of ['a', 'b', 'c', 'd', 'Schulgong']) mk(n); // 4 fremde Sounds + ein "Schulgong" unbekannter Version
  const created = [];
  const guild = { id: 'g-sounds', premiumTier: 0, soundboardSounds: { fetch: async () => store, create: async (o) => { created.push(o); log.push(`+${o.name}`); return mk(o.name); } } };

  const lines = await uploadSounds(guild);
  assert.deepEqual(log.filter((l) => l.startsWith('-')), ['-Schulgong'], 'nur der alte Schulgong darf ersetzt werden');
  assert.deepEqual(created.map((o) => o.name), ['Feueralarm', 'Schulgong', 'Trommelwirbel', 'Ladebalken 99%'], 'wichtigste zuerst, 4 freie Plätze');
  assert.ok(created.every((o) => o.contentType === 'audio/mpeg' && o.file.length > 1000));
  assert.ok(lines.some((l) => l.includes('Neue Version') && l.includes('Schulgong')));
  assert.ok(lines.some((l) => l.includes('Kein Platz')));
  for (const n of ['a', 'b', 'c', 'd']) assert.ok(store.some((x) => x.name === n), `fremder Sound ${n} weg`);

  // Neustart ohne Änderungen: nichts passiert
  log.length = 0;
  const lines2 = await uploadSounds(guild);
  assert.deepEqual(log, [], 'zweiter Lauf hat etwas geändert: ' + log.join(' '));
  assert.ok(lines2.some((l) => l.includes('Schon da')));

  // Ein Sound wurde geändert (neue Datei): nur der wird ersetzt
  guildState('g-sounds').soundStand['schulgong.mp3'].hash = 'alt';
  log.length = 0;
  await uploadSounds(guild);
  assert.deepEqual(log, ['-Schulgong', '+Schulgong']);

  // ersetzen: alle von Willy neu, fremde bleiben
  log.length = 0;
  await uploadSounds(guild, { replace: true });
  assert.equal(log.filter((l) => l.startsWith('-')).length, 4);
  assert.equal(log.filter((l) => l.startsWith('+')).length, 4);
  assert.equal(store.size, 8);
}

// ---------------------------------------------------------------- Nervige Formulare
function checkModal(m) {
  assert.ok(m.title.length <= 45, `Formular-Titel zu lang: ${m.title}`);
  assert.ok(m.components.length >= 1 && m.components.length <= 5, 'Formular braucht 1–5 Felder');
  for (const label of m.components) {
    assert.equal(label.type, 18, 'Feld ohne Label');
    assert.ok(label.label.length <= 45, `Label zu lang: ${label.label}`);
    assert.ok(!label.description || label.description.length <= 100, `Beschreibung zu lang: ${label.description}`);
    const c = label.component;
    if (c.type === 3) assert.ok(c.options.length >= 1 && c.options.length <= 25 && c.options.every((o) => o.label.length <= 100));
    if (c.type === 4) assert.ok(!c.min_length || c.min_length <= c.max_length, `${c.custom_id}: min > max`);
  }
}

const GOOD = {
  nachname: 'MUSTERMANN', vorname: 'ylliW', klasse: '10b, 204, beige', ampeln: '7', uhrzeit: '10:15:00,000', dauer: '3,5',
  bestaetigung: 'Ja, ich bestätige hiermit ausdrücklich', unterschrift: '~~~~~ Tim', ortdatum: 'Hier, morgen', nichts: '',
  sekunden: '30', winkel: '45', seiten: '3', kopien: '3', zeuge: 'Heinz', schliessen: 'Willy', sicher: 'ganz sicher', feedback: '',
};

async function fillForm(formKey, answers, { fromPublicMessage = false } = {}) {
  let modal = null;
  const log = [];
  const sent = [];
  const base = {
    user: { id: `form-${formKey}` },
    member: { displayName: 'Tim' },
    options: { getString: () => formKey },
    showModal: async (m) => {
      modal = m.toJSON();
      checkModal(modal);
    },
    reply: async (p) => log.push(['reply', serialize(p)]),
    update: async (p) => log.push(['update', serialize(p)]),
    channel: { send: async (p) => sent.push(serialize(p)) },
  };
  const fieldsFor = (m) => {
    const values = {};
    for (const { component: c } of m.components) {
      values[c.custom_id] = c.type === 3 ? c.options[0].value : c.value ?? answers[c.custom_id] ?? 'x'.repeat(Math.max(c.min_length ?? 3, 3));
    }
    return { getTextInputValue: (id) => values[id], getStringSelectValues: (id) => [values[id]] };
  };
  if (fromPublicMessage) await handleFormular(base, 'widerspruch', '2026/123');
  else await handleFormularCommand(base);
  const pages = FORMS[formKey === 'formular' && fromPublicMessage ? 'widerspruch' : fromPublicMessage ? 'widerspruch' : formKey].pages.length;
  for (let page = 0; page < pages; page++) {
    const fromMsg = page > 0 || fromPublicMessage;
    await handleFormular({ ...base, fields: fieldsFor(modal), isFromMessage: () => fromMsg }, 'submit', String(page));
    if (page < pages - 1) await handleFormular(base, 'next');
  }
  return { log, sent, modal };
}

async function simulateFormulare() {
  for (const key of Object.keys(FORMS).filter((k) => !FORMS[k].hidden)) {
    // korrekt ausgefüllt -> Bescheid
    const ok = await fillForm(key, GOOD);
    assert.equal(ok.sent.length, 1, `${key}: kein Bescheid gepostet`);
    assert.ok(ok.sent[0].embeds[0].title.startsWith('📨 Bescheid'), `${key}: Bescheid fehlt`);
    assert.equal(ok.log[0][0], 'reply', `${key}: erste Seite muss eine neue private Nachricht sein`);
    assert.ok(ok.log.slice(1).every(([t]) => t === 'update'), `${key}: Folgeseiten sollen die private Nachricht aktualisieren`);
    // falsch ausgefüllt -> Fehlerliste, kein Bescheid
    const bad = await fillForm(key, { ...GOOD, nachname: 'klein', nichts: 'doch', bestaetigung: 'jo' });
    assert.equal(bad.sent.length, 0, `${key}: trotz Fehlern Bescheid`);
    const last = bad.log.at(-1)[1].content;
    assert.ok(last.includes('ungültig') && last.includes('GROSSBUCHSTABEN') && last.includes('NICHTS'), `${key}: Fehlerliste unvollständig`);
  }
  // Widerspruch vom öffentlichen Bescheid aus: darf den Bescheid NICHT überschreiben
  const w = await fillForm('widerspruch', GOOD, { fromPublicMessage: true });
  assert.equal(w.log[0][0], 'reply', 'Widerspruch hat den öffentlichen Bescheid überschrieben');
  assert.equal(w.sent.length, 1);
}


// ---------------------------------------------------------------- Abgleich: alter Chaos-Server -> neue Struktur
async function simulateAbgleich() {
  const { ChannelType, PermissionsBitField } = await import('discord.js');
  const T = ChannelType;
  let nid = 1000; const events = [];
  const channels = new Collection();
  const roles = new Collection();
  const webhooks = new Collection();
  const sounds = new Collection();
  const bits = (list) => ({ bitfield: PermissionsBitField.resolve(list ?? []) });
  const mkMsg = (ch, payload, authorId = 'bot') => {
    const m = { id: 'm' + nid++, author: { id: authorId }, createdTimestamp: nid, content: payload.content ?? '',
      embeds: (payload.embeds ?? []).map((e) => e.toJSON?.() ?? e),
      components: (payload.components ?? []).map((r) => { const j = r.toJSON?.() ?? r; return { components: (j.components ?? []).map((x) => ({ customId: x.custom_id ?? x.customId })) }; }),
      async edit(p) { events.push(`NACHRICHT BEARBEITEN #${ch.name}`); Object.assign(m, mkMsg(ch, p, authorId), { id: m.id, edit: m.edit, delete: m.delete }); return m; },
      async delete() { events.push(`NACHRICHT LÖSCHEN #${ch.name}`); ch._msgs.delete(m.id); } };
    return m;
  };
  const mkCh = (name, type, parentId = null, extra = {}) => {
    const id = String(nid++);
    const po = new Collection();
    const ch = { id, name, type, parentId, topic: null, rateLimitPerUser: 0, userLimit: 0, _msgs: new Collection(),
      position: channels.filter((c) => (c.type === T.GuildCategory) === (type === T.GuildCategory)).size,
      permissionOverwrites: { cache: po,
        edit: async (r) => { po.set(r.id ?? r, { allow: bits(), deny: bits() }); },
        create: async (oid, opts) => { events.push(`RECHTE #${ch.name}`);
          po.set(oid, { allow: bits(Object.keys(opts).filter((k) => opts[k] === true)), deny: bits(Object.keys(opts).filter((k) => opts[k] === false)) }); } },
      isThread: () => false, isTextBased: () => type !== T.GuildCategory,
      get guild() { return guild; },
      messages: { fetch: async (q) => { if (typeof q === 'string') { const m = ch._msgs.get(q); if (!m) throw new Error('Unknown Message'); return m; } return ch._msgs; } },
      async delete() { channels.delete(id); events.push(`LÖSCHEN ${type === T.GuildCategory ? '[Kategorie] ' : ''}${name}`); },
      async setParent(p) { events.push(`VERSCHIEBEN ${ch.name} -> ${channels.get(p)?.name}`); ch.parentId = p; },
      async setName(n) { events.push(`UMBENENNEN ${ch.name} -> ${n}`); ch.name = n; },
      async setTopic(t) { events.push(`THEMA #${ch.name}`); ch.topic = t; },
      async setRateLimitPerUser(n) { events.push(`SLOWMODE #${ch.name} ${n}`); ch.rateLimitPerUser = n; },
      async setUserLimit(n) { events.push(`LIMIT ${ch.name} ${n}`); ch.userLimit = n; },
      async send(p) { const m = mkMsg(ch, p); ch._msgs.set(m.id, m); events.push(`NACHRICHT #${ch.name}`); return m; },
      async createWebhook(o) { const w = { id: 'w' + nid++, token: 't', channelId: id, name: o.name,
        async edit() { events.push(`WEBHOOK BEARBEITEN ${o.name}`); }, async delete() { webhooks.delete(w.id); } };
        webhooks.set(w.id, w); events.push(`WEBHOOK ${o.name}`); return w; },
      ...extra };
    channels.set(id, ch); return ch;
  };
  // --- alter Server (Chaos-Struktur v1) ---
  const cat = (n) => mkCh(n, T.GuildCategory);
  const old = [
    ['🔽 GANZ UNTEN (eigentlich oben)', [['⬇️-scroll-runter']]],
    ['🚪 Hintereingang', [['start-hier-vielleicht', 'start'], ['nicht-hier-starten']]],
    ['📌 WICHTIG (unwichtig)', [['regeln-sind-woanders', 'fakeRules'], ['ankündigungen-alt', 'announce'], ['ankündigungen-neu-aber-alt'], ['ankündigungen-für-ankündigungen']]],
    ['🍝 Sonstiges 2', [['allgemein'], ['allgemein-2'], ['allgemein-final'], ['𝗮𝗹𝗹𝗴𝗲𝗺𝗲𝗶𝗻-final-final-v3'], ['nicht-allgemein', 'system'], ['schnell-chat'], ['langsam-chat']]],
    ['📚 Schule (glaube ich)', [['hausaufgaben'], ['mathe-nur-mit-zahlen', 'mathe'], ['deutsch-auf-englisch'], ['englisch-auf-deutsch'], ['bio-und-pizza'], ['stundenplan-verwirrung'], ['lehrkraft-zitate']]],
    ['🔊 Sprachkanäle', [['🔊-sprachkanal-1'], ['🔊-sprachkanal-2']]],
    ['💬 Textkanäle', [['💬 Chat', null, T.GuildVoice], ['📝 Schreiben', null, T.GuildVoice], ['🏫 Klassenzimmer', null, T.GuildVoice], ['🧑‍🏫 Lehrerzimmer (VERBOTEN)', null, T.GuildVoice], ['🚽 Klo (1 Person)', null, T.GuildVoice], ['👥 Gruppenarbeit (max. 2)', null, T.GuildVoice], ['🏃 Pausenhof', null, T.GuildVoice], ['🤫 Bibliothek (LEISE!)', null, T.GuildVoice], ['🏀 Hinter der Turnhalle', null, T.GuildVoice], ['🚌 Schulbus (99 Plätze)', null, T.GuildVoice]]],
    ['🦆 Enten-Bereich', [['enten'], ['nicht-enten', 'nichtEnten'], ['ente-oder-gans-debatte']]],
    ['🎰 Glücksspiel (legal)', [['rollen-lotterie', 'lottery']]],
    ['🎫 Beschwerdestelle (geschlossen)', [['tickets-bitte-nicht-benutzen', 'tickets'], ['ticket-0001-wlan-kaputt']]],
    ['🗑️ Archiv (aktiv)', [['memes-ernst'], ['ernst-memes'], ['🚨-polizeiwache', 'modlog']]],
    ['⚠️ NICHT ÖFFNEN', [['ok-du-hast-es-geöffnet', 'nichtOeffnen'], ['jetzt-ist-es-zu-spät']]],
    ['Kategorie', [['kanal'], ['Sprachkanal', null, T.GuildVoice]]],
    ['🧦 Socken', [['wer-hat-meine-socke-gesehen', 'realRules'], ['socken-tausch']]],
    ['🛡️ Team-Bereich (streng geheim)', [['📜-team-kodex', 'kodex'], ['team-besprechung'], ['🛡️ Team-Sitzung (Kaffee mitbringen)', null, T.GuildVoice]]],
    ['💤 Ruheraum', [['💤 Mathe-Unterricht', 'afk', T.GuildVoice]]],
    ['🔼 GANZ OBEN (eigentlich unten)', [['⬆️-scroll-hoch']]],
  ];
  const g = guildState('gx-abgleich'); g.setupDone = true; g.ids = {};
  for (const [cname, chs] of old) {
    const c = cat(cname);
    for (const [n, key, type] of chs) { const ch = mkCh(n, type ?? T.GuildText, c.id); if (key) g.ids[`ch_${key}`] = ch.id; }
  }
  const byName = (n) => channels.find((c) => c.name === n);
  // alte Willy-Nachrichten (sollen bearbeitet werden, nicht doppelt gepostet) und eine fremde Nachricht
  const alteStart = mkMsg(byName('start-hier-vielleicht'), { content: 'alt', components: [{ components: [{ custom_id: 'rules:open' }] }] });
  byName('start-hier-vielleicht')._msgs.set(alteStart.id, alteStart);
  const fremd = mkMsg(byName('wer-hat-meine-socke-gesehen'), { content: '🧦 hat jemand meine Socke?' }, 'user1');
  byName('wer-hat-meine-socke-gesehen')._msgs.set(fremd.id, fremd);
  // Sprachkanal, der gerade wegen "allein" umbenannt ist (voicenames.js)
  const klassenzimmer = byName('🏫 Klassenzimmer');
  klassenzimmer.name = '🎤 Tim redet mit sich selbst';
  g.vcNamen = { [klassenzimmer.id]: '🏫 Klassenzimmer' };
  // alte Schule (6 Fächer, ohne Lehrerzimmer)
  const sc = cat('🏫 Unterricht (Anwesenheitspflicht)');
  g.schule = { ids: { category: sc.id, raeume: {}, webhooks: {} } };
  for (const [k, r] of [['mathe', 'raum-101-mathe'], ['deutsch', 'raum-102-deutsch'], ['englisch', 'raum-103-englisch'], ['bio', 'raum-104-bio'], ['geschichte', 'raum-105-geschichte'], ['sport', 'raum-106-sport']]) {
    g.schule.ids.raeume[k] = mkCh(r, T.GuildText, sc.id).id; g.schule.ids.webhooks[k] = { id: 'x', token: 'y' };
  }
  g.schule.ids.klassenbuch = mkCh('📕-klassenbuch', T.GuildText, sc.id).id;
  g.schule.ids.nachsitzen = mkCh('⛓️-nachsitzen', T.GuildText, sc.id).id;
  const anzahlVorher = channels.size;
  // --- Guild-Mock ---
  const me = { permissions: { has: () => true }, roles: { highest: { position: 99, name: 'Hausmeister Willy' }, add: async () => {} }, setNickname: async () => {} };
  const guild = {
    id: 'gx-abgleich', name: 'Test', ownerId: 'owner', premiumTier: 0, systemChannelId: null, afkChannelId: null,
    client: { user: { id: 'bot' } },
    roles: { everyone: { id: 'everyone' }, cache: roles, fetch: async () => roles, setPositions: async () => {},
      create: async (o) => { const r = { id: 'r' + nid++, name: o.name, position: 1, managed: false, editable: true, hoist: Boolean(o.hoist),
        colors: { primaryColor: o.colors?.primaryColor ?? 0 }, permissions: bits(o.permissions),
        async edit(c) { events.push(`ROLLE ${r.name}`); Object.assign(r, c.colors ? { colors: c.colors } : {}, 'hoist' in c ? { hoist: c.hoist } : {}, c.name ? { name: c.name } : {}); } };
        roles.set(r.id, r); return r; } },
    members: { me, fetch: async () => ({ displayName: 'Tim', roles: { cache: new Collection(), add: async () => {} } }) },
    channels: { cache: channels, create: async (o) => { const ch = mkCh(o.name, o.type, o.parent ?? null);
      Object.assign(ch, { topic: o.topic ?? null, rateLimitPerUser: o.rateLimitPerUser ?? 0, userLimit: o.userLimit ?? 0 });
      for (const ow of o.permissionOverwrites ?? []) ch.permissionOverwrites.cache.set(ow.id, { allow: bits(ow.allow), deny: bits(ow.deny) });
      events.push(`ANLEGEN ${o.type === T.GuildCategory ? '[Kategorie] ' : ''}${o.name}`); return ch; },
      setPositions: async (arr) => { events.push(`SORTIEREN (${arr.length} Kategorien)`); for (const { channel, position } of arr) channels.get(channel).position = position; } },
    setSystemChannel: async (c) => { guild.systemChannelId = c.id; events.push(`SYSTEMKANAL -> ${c.name}`); },
    setAFKChannel: async (c) => { guild.afkChannelId = c.id; events.push(`AFK -> ${c.name}`); },
    soundboardSounds: { fetch: async () => sounds, create: async (o) => { const sd = { soundId: 'sd' + nid++, name: o.name,
      async delete() { sounds.delete(sd.soundId); events.push(`SOUND LÖSCHEN ${o.name}`); } }; sounds.set(sd.soundId, sd); events.push(`SOUND ${o.name}`); return sd; } },
    fetchWebhooks: async () => webhooks,
  };
  // alter Sound mit gleichem Namen (unbekannte Version) -> wird ersetzt
  const alterGong = { soundId: 'alt-gong', name: 'Schulgong', async delete() { sounds.delete('alt-gong'); events.push('SOUND LÖSCHEN Schulgong (alt)'); } };
  sounds.set('alt-gong', alterGong);
  const log1 = await serverAbgleich(guild);
  assert.ok(log1.some((l) => l.includes('28 alte Witzkanäle')), 'Witzkanäle nicht (alle) gelöscht: ' + log1.join(' | '));
  const namen = [...channels.values()].map((c) => c.name);
  for (const n of ['regeln', 'ankündigungen', 'allgemein', 'memes', 'enten', 'raum-107-chemie', '☕-lehrerzimmer', 'ticket-0001-wlan-kaputt']) assert.ok(namen.includes(n), `fehlt: ${n}`);
  for (const n of ['allgemein-2', 'kanal', 'nicht-allgemein', 'wer-hat-meine-socke-gesehen']) assert.ok(!namen.includes(n), `noch da: ${n}`);
  assert.equal(namen.filter((n) => n === 'allgemein').length, 1, '#allgemein doppelt');
  assert.ok(![...channels.values()].some((c) => c.type !== ChannelType.GuildCategory && !c.parentId), 'Kanal ohne Kategorie');
  // Willys Nachrichten: alte Startnachricht bearbeitet statt doppelt, fremde Nachricht unberührt
  assert.equal(byName('start-hier-vielleicht')._msgs.size, 1, 'Startnachricht doppelt');
  assert.ok(byName('start-hier-vielleicht')._msgs.has(alteStart.id), 'alte Startnachricht hätte bearbeitet werden sollen');
  assert.ok(byName('regeln')._msgs.has(fremd.id), 'fremde Nachricht in #regeln wurde gelöscht');
  for (const n of ['regeln', 'rollen-lotterie', 'tickets-bitte-nicht-benutzen', '📜-team-kodex']) assert.ok([...byName(n)._msgs.values()].some((m) => m.author.id === 'bot'), `#${n} ohne Willy-Nachricht`);
  // Einstellungen und Rechte
  assert.equal(byName('schnell-chat').rateLimitPerUser, 21600, 'Slowmode fehlt');
  assert.equal(byName('🚽 Klo (1 Person)').userLimit, 1, 'Platzlimit fehlt');
  assert.equal(byName('regeln').topic, 'Die Regeln. Diesmal wirklich hier.', 'Beschreibung fehlt');
  assert.ok(byName('regeln').permissionOverwrites.cache.has('everyone'), 'Rechte fehlen');
  // umbenannter Sprachkanal: zurückbenannt statt doppelt angelegt
  assert.equal(klassenzimmer.name, '🏫 Klassenzimmer');
  assert.equal([...channels.values()].filter((c) => c.name.includes('Klassenzimmer')).length, 1, 'Klassenzimmer doppelt');
  // Sounds: alter Schulgong ersetzt, alle da; Lehrer-Webhooks für alle 9 Räume + Lehrerzimmer
  assert.ok(!sounds.has('alt-gong') && sounds.size === 8, `Sounds: ${sounds.size}`);
  assert.equal(webhooks.size, 18, `Webhooks: ${webhooks.size}`);
  events.length = 0;
  await serverAbgleich(guild);
  assert.deepEqual(events, [], 'Zweiter Abgleich darf nichts mehr ändern: ' + events.join(' | '));
  // Ändert sich etwas an der Vorlage, wird nur das angepasst
  byName('regeln').topic = 'von Hand geändert';
  byName('enten').rateLimitPerUser = 30; // z. B. Neustart mitten im Putz-Rundgang
  [...byName('rollen-lotterie')._msgs.values()][0].content = 'veraltet';
  g.inhalte.lottery.hash = 'alt';
  events.length = 0;
  await serverAbgleich(guild);
  assert.deepEqual(events.sort(), ['NACHRICHT BEARBEITEN #rollen-lotterie', 'SLOWMODE #enten 0', 'THEMA #regeln'], 'Dritter Abgleich: ' + events.join(' | '));
}

// ---------------------------------------------------------------- Ticket-Knöpfe und Formular
async function simulateTicketButtons() {
  const guildId = 'g-ticket';
  let modal = null;
  const replies = [];
  const base = {
    guildId,
    user: { id: 'u3' },
    reply: async (p) => replies.push(serialize(p)),
    update: async (p) => replies.push(serialize(p)),
    showModal: async (m) => (modal = m.toJSON()),
  };
  await handleTicket(base, 'open');
  await handleTicket(base, 'nah');
  await handleTicket(base, 'really');
  assert.ok(modal, 'Ticket-Formular wurde nicht gezeigt');
  assert.ok(modal.title.length <= 45, 'Formular-Titel > 45 Zeichen');
  for (const row of modal.components) for (const c of row.components) assert.ok(c.label.length <= 45, `Formular-Label > 45 Zeichen: ${c.label}`);
  await handleTicket(base, 'boss'); // kein Ticket-Kanal -> Hinweis
  assert.equal(replies.length, 3);
}

async function checkZeugnisPdf() {
  for (const name of ['Tim', '🥔 Kartoffel des Tages', 'Ein sehr, sehr langer Name mit Umlauten ÄÖÜß und 日本語', '']) {
    const pdf = await zeugnisPdf(fun.zeugnisDaten('u1', name, '2026-11-19'));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-', 'kein PDF');
    assert.ok(pdf.length > 10_000 && pdf.length < 8 * 1024 * 1024, `PDF-Größe komisch: ${pdf.length}`);
    assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length, 1, 'Zeugnis muss genau 1 Seite haben');
  }
}

for (const [name, fn] of [
  ['Abgleich alter Server', simulateAbgleich],
  ['Zeugnis-PDF', checkZeugnisPdf],
  ['Formulare', simulateFormulare],
  ['Sound-Upload', simulateSoundUpload],
  ['Ticket-Knöpfe', simulateTicketButtons],
  ['Captcha-Simulation', simulateCaptcha],
  ['Moderation', simulateModeration],
]) {
  try {
    await fn();
    ok++;
  } catch (err) {
    console.error(`❌ ${name}\n   ${err.stack}`);
    process.exitCode = 1;
  }
}

console.log(process.exitCode ? `\n${ok} Checks ok, aber es gab Fehler.` : `✅ Alle ${ok} Checks bestanden.`);
process.exit();
