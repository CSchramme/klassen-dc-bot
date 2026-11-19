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
});
check('Server-Zufall', () => {
  assert.ok(randomServerName().length <= 100);
  assert.ok(randomIconFile().endsWith('.png'));
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

for (const [name, fn] of [
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
