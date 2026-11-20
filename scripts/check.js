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
  for (const k of ['start', 'fakeRules', 'realRules', 'lottery', 'tickets', 'modlog', 'kodex', 'system', 'afk', 'announce', 'mathe', 'nichtEnten']) {
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
  const created = [];
  const existing = new Collection(['a', 'b', 'c', 'd', 'Schulgong'].map((n, i) => [`s${i}`, { name: n }]));
  const guild = {
    premiumTier: 0, // 8 Plätze, 5 belegt (einer davon ist schon "Schulgong")
    soundboardSounds: { fetch: async () => existing, create: async (o) => created.push(o) },
  };
  const lines = await uploadSounds(guild);
  assert.equal(created.length, 3, 'Es hätten genau 3 Sounds hochgeladen werden müssen');
  assert.equal(created[0].name, 'Feueralarm', 'Feueralarm muss zuerst kommen');
  assert.ok(created.every((o) => o.contentType === 'audio/mpeg' && o.file.length > 1000));
  assert.ok(lines.some((l) => l.includes('Schon da') && l.includes('Schulgong')));
  assert.ok(lines.some((l) => l.includes('Kein Platz')));

  // ersetzen: vorhandener "Schulgong" wird gelöscht und neu hochgeladen
  const deleted = [];
  const store = new Collection([['x', { name: 'Schulgong', delete: async () => { deleted.push('Schulgong'); store.delete('x'); } }]]);
  const created2 = [];
  await uploadSounds({ premiumTier: 0, soundboardSounds: { fetch: async () => store, create: async (o) => created2.push(o.name) } }, { replace: true });
  assert.deepEqual(deleted, ['Schulgong']);
  assert.ok(created2.includes('Schulgong') && created2.length === 8, `ersetzen hat ${created2.length} hochgeladen`);
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
