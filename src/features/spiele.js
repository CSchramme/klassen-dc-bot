// Pausenspiele: Wort des Tages (wie Wordle, mit Schul- und Insider-Wörtern) und Duell (Schere, Stein, Papier).
// Wer ein Duell verliert, bekommt für eine Stunde die Rolle "🧽 Tafeldienst".
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { config } from '../config.js';
import { guildState, save } from '../storage.js';
import { chance, localNow, logError, pick, seededRng } from '../util.js';
import { siegerPunkt, zaehle } from '../chronik.js';

const NO_PINGS = { parse: [] };
const ephemeral = { flags: MessageFlags.Ephemeral };
const MIN = 60_000;

// ---------------------------------------------------------------------------
// Wort des Tages
// ---------------------------------------------------------------------------
export const WOERTER = [
  'TAFEL', 'PAUSE', 'SOCKE', 'BESEN', 'ENTEN', 'NOTEN', 'MATHE', 'HEFTE', 'STIFT', 'MAPPE', 'HEINZ', 'WILLY', 'FEUER', 'ALARM',
  'STUHL', 'TISCH', 'SPORT', 'KUNST', 'MUSIK', 'NOTIZ', 'WITZE', 'MEMES', 'REGEL', 'STEIN', 'BLOCK', 'PUNKT', 'KOMMA', 'LESEN',
  'MINUS', 'BRUCH', 'KREIS', 'ACHSE', 'ATLAS', 'KARTE', 'MENSA', 'ESSEN', 'NUDEL', 'PIZZA', 'APFEL', 'KEKSE', 'TASSE', 'KANNE',
  'EIMER', 'RADIO', 'TINTE', 'BRIEF', 'LISTE', 'RUHIG', 'LEISE', 'ZEUGE', 'KLEID', 'BLATT', 'SEITE',
];

const VERSUCHE = 6;
const heute = () => localNow(config.spass.zeitzone).date;

function wortState(guildId) {
  const g = guildState(guildId);
  g.wort ??= {};
  const w = g.wort;
  w.punkte ??= {}; // userId -> { geloest, versuche }
  if (w.datum !== heute()) {
    w.datum = heute();
    w.spiele = {}; // userId -> [Versuche]
    w.geloest = [];
  }
  return w;
}

export function wortDesTages(guildId, datum = heute()) {
  const rng = seededRng(`${guildId}:wort:${datum}`);
  return WOERTER[Math.floor(rng() * WOERTER.length)];
}

const normal = (text) =>
  text
    .trim()
    .toUpperCase()
    .replace(/Ä/g, 'AE')
    .replace(/Ö/g, 'OE')
    .replace(/Ü/g, 'UE')
    .replace(/ß/g, 'SS');

/** Farben für einen Versuch: 'g' = richtig, 'y' = kommt vor, '-' = nicht drin (doppelte Buchstaben richtig gezählt). */
export function bewerten(versuch, loesung) {
  const out = Array(5).fill('-');
  const rest = {};
  for (let i = 0; i < 5; i++) {
    if (versuch[i] === loesung[i]) out[i] = 'g';
    else rest[loesung[i]] = (rest[loesung[i]] ?? 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (out[i] === 'g') continue;
    if (rest[versuch[i]] > 0) {
      out[i] = 'y';
      rest[versuch[i]]--;
    }
  }
  return out.join('');
}

const FARBE = { g: '🟩', y: '🟨', '-': '⬛' };
const kaestchen = (muster) => [...muster].map((c) => FARBE[c]).join('');
const buchstaben = (wort) => [...wort].map((c) => `\`${c}\``).join(' ');

function raster(versuche, loesung, mitBuchstaben) {
  return versuche.map((v) => `${kaestchen(bewerten(v, loesung))}${mitBuchstaben ? `  ${buchstaben(v)}` : ''}`).join('\n');
}

function tastatur(versuche, loesung) {
  const stand = {};
  for (const v of versuche) {
    const m = bewerten(v, loesung);
    [...v].forEach((c, i) => {
      const neu = m[i];
      if (stand[c] === 'g' || (stand[c] === 'y' && neu === '-')) return;
      stand[c] = neu;
    });
  }
  const zeile = (art) => Object.keys(stand).filter((c) => stand[c] === art).sort().join(' ') || '–';
  return `🟩 ${zeile('g')}\n🟨 ${zeile('y')}\n⬛ ${zeile('-')}`;
}

const SPRUECHE_FALSCH = ['Nein.', 'Knapp daneben ist auch vorbei.', 'Interessant. Falsch, aber interessant.', 'Willy hätte das auch nicht gewusst.', 'Fast. Also nicht wirklich.'];

async function wortRaten(interaction) {
  const w = wortState(interaction.guildId);
  const loesung = wortDesTages(interaction.guildId);
  const uid = interaction.user.id;
  const versuche = (w.spiele[uid] ??= []);
  if (w.geloest.includes(uid)) return interaction.reply({ content: `✅ Du hast es heute schon gelöst:\n${raster(versuche, loesung, true)}\nMorgen gibt es ein neues Wort.`, ...ephemeral });
  if (versuche.length >= VERSUCHE) return interaction.reply({ content: `❌ Keine Versuche mehr für heute. Das Wort war **${loesung}**. Morgen gibt es ein neues.`, ...ephemeral });

  const versuch = normal(interaction.options.getString('wort', true));
  if (!/^[A-Z]{5}$/.test(versuch)) {
    return interaction.reply({ content: '📏 Genau 5 Buchstaben bitte (ä = ae, ö = oe, ü = ue, ß = ss). Keine Zahlen, keine Leerzeichen, keine Gänse.', ...ephemeral });
  }
  if (versuche.includes(versuch)) return interaction.reply({ content: 'Das hast du heute schon probiert. Es ist immer noch falsch.', ...ephemeral });

  versuche.push(versuch);
  const p = (w.punkte[uid] ??= { geloest: 0, versuche: 0 });
  p.versuche++;
  const geschafft = versuch === loesung;
  if (geschafft) {
    w.geloest.push(uid);
    p.geloest++;
    zaehle(interaction.guildId, 'woerter');
    siegerPunkt(interaction.guildId, uid, Math.max(1, VERSUCHE + 1 - versuche.length));
  }
  save();

  const kopf = `**Wort des Tages** · Versuch ${versuche.length}/${VERSUCHE}`;
  if (geschafft) {
    await interaction.reply({ content: `${kopf}\n${raster(versuche, loesung, true)}\n\n🎉 **Richtig!** Willy ist beeindruckt. Ein bisschen.`, ...ephemeral });
    // Öffentlich, aber ohne Buchstaben
    await interaction.channel
      ?.send({
        content: `🟩 **${interaction.member?.displayName ?? interaction.user.username}** hat das Wort des Tages in **${versuche.length}/${VERSUCHE}** geschafft!\n${raster(versuche, loesung, false)}\n_Selber raten: \`/wort raten\`_`,
        allowedMentions: NO_PINGS,
      })
      .catch(() => {});
    return null;
  }
  const ende = versuche.length >= VERSUCHE ? `\n\n❌ Vorbei. Das Wort war **${loesung}**.` : `\n\n${pick(SPRUECHE_FALSCH)}\n${tastatur(versuche, loesung)}`;
  return interaction.reply({ content: `${kopf}\n${raster(versuche, loesung, true)}${ende}`, ...ephemeral });
}

async function wortBestenliste(interaction) {
  const w = wortState(interaction.guildId);
  const top = Object.entries(w.punkte)
    .filter(([, p]) => p.geloest > 0)
    .sort((a, b) => b[1].geloest - a[1].geloest || a[1].versuche / a[1].geloest - b[1].versuche / b[1].geloest)
    .slice(0, 10)
    .map(([id, p], i) => `${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`} <@${id}> – ${p.geloest}× gelöst (Ø ${(p.versuche / p.geloest).toFixed(1)} Versuche)`);
  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x6aaa64)
        .setTitle('🟩 Wort des Tages – Bestenliste')
        .setDescription(`${top.join('\n') || '_Noch niemand. Das Wort ist zu schwer. Oder alle zu faul._'}\n\nHeute gelöst: **${w.geloest.length}**`),
    ],
    allowedMentions: NO_PINGS,
  });
}

// ---------------------------------------------------------------------------
// Duell
// ---------------------------------------------------------------------------
const WAFFEN = {
  schere: { emoji: '✂️', name: 'Schere', schlaegt: 'papier' },
  stein: { emoji: '🪨', name: 'Stein', schlaegt: 'schere' },
  papier: { emoji: '📄', name: 'Papier', schlaegt: 'stein' },
};
const TAFELDIENST = { name: '🧽 Tafeldienst', color: 0x95a5a6 };
const duelle = new Map(); // id -> { herausforderer, gegner, wahl: {}, status, nachricht }
let naechsteId = 1;

const knopf = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

function duellEmbed(d, text) {
  return new EmbedBuilder()
    .setColor(0xc0392b)
    .setTitle('⚔️ Duell!')
    .setDescription(`<@${d.herausforderer}> gegen <@${d.gegner}>\n\n${text}`)
    .setFooter({ text: 'Wer verliert, hat eine Stunde Tafeldienst. 🧽' });
}

const waffenReihe = (id) =>
  new ActionRowBuilder().addComponents(Object.entries(WAFFEN).map(([k, w]) => knopf(`duell:wahl:${id}:${k}`, `${w.emoji} ${w.name}`, ButtonStyle.Primary)));

async function tafeldienstRolle(guild) {
  const g = guildState(guild.id);
  let rolle = guild.roles.cache.get(g.ids.role_tafeldienst) ?? guild.roles.cache.find((r) => r.name === TAFELDIENST.name);
  if (!rolle) rolle = await guild.roles.create({ name: TAFELDIENST.name, colors: { primaryColor: TAFELDIENST.color }, permissions: [], reason: 'Duell verloren' });
  g.ids.role_tafeldienst = rolle.id;
  save();
  return rolle;
}

async function tafeldienstGeben(guild, userId) {
  try {
    const rolle = await tafeldienstRolle(guild);
    const member = await guild.members.fetch(userId);
    await member.roles.add(rolle, 'Duell verloren');
    const g = guildState(guild.id);
    g.tafeldienst ??= [];
    g.tafeldienst = g.tafeldienst.filter((t) => t.userId !== userId);
    g.tafeldienst.push({ userId, bis: Date.now() + 60 * MIN });
    save();
    return true;
  } catch (err) {
    logError('duell:tafeldienst', err);
    return false;
  }
}

/** Abgelaufenen Tafeldienst beenden (jede Minute, auch nach Neustart). */
export async function spieleTick(guild, now = Date.now()) {
  const g = guildState(guild.id);
  const faellig = (g.tafeldienst ?? []).filter((t) => t.bis <= now);
  if (!faellig.length) return;
  g.tafeldienst = g.tafeldienst.filter((t) => t.bis > now);
  save();
  const rolle = guild.roles.cache.get(g.ids.role_tafeldienst);
  if (!rolle) return;
  for (const t of faellig) {
    const member = await guild.members.fetch(t.userId).catch(() => null);
    await member?.roles.remove(rolle, 'Tafeldienst vorbei').catch((err) => logError('duell:tafeldienst-ende', err));
  }
}

export function initSpiele(client) {
  const tick = async () => {
    for (const guild of client.guilds.cache.values()) await spieleTick(guild).catch((err) => logError('spiele', err));
  };
  setInterval(tick, MIN);
  tick();
}

/** Wer gewinnt? 1 = a, -1 = b, 0 = unentschieden */
export function sieger(a, b) {
  if (a === b) return 0;
  return WAFFEN[a].schlaegt === b ? 1 : -1;
}

async function duellAuswerten(interaction, d) {
  d.status = 'fertig';
  duelle.delete(d.id);
  zaehle(interaction.guildId, 'duelle');
  const a = d.wahl[d.herausforderer];
  const b = d.wahl[d.gegner];
  const zeile = `<@${d.herausforderer}>: ${WAFFEN[a].emoji} ${WAFFEN[a].name}\n<@${d.gegner}>: ${WAFFEN[b].emoji} ${WAFFEN[b].name}`;

  if (chance(0.05)) {
    // Willy kommt dazwischen
    return interaction.update({
      embeds: [duellEmbed(d, `${zeile}\n\n🧹 **Willy kommt mit dem Besen dazwischen.** Besen schlägt alles. Willy gewinnt. Ihr habt beide verloren, aber Tafeldienst macht Willy heute selbst.`)],
      components: [],
      allowedMentions: NO_PINGS,
    });
  }
  const s = sieger(a, b);
  if (s === 0) {
    return interaction.update({ embeds: [duellEmbed(d, `${zeile}\n\n🤝 **Unentschieden.** Langweilig. Niemand muss Tafel wischen.`)], components: [], allowedMentions: NO_PINGS });
  }
  const gewinner = s > 0 ? d.herausforderer : d.gegner;
  const verlierer = s > 0 ? d.gegner : d.herausforderer;
  siegerPunkt(interaction.guildId, gewinner);
  const willyVerliert = verlierer === interaction.client.user.id;
  const rolle = willyVerliert ? false : await tafeldienstGeben(interaction.guild, verlierer);
  const strafe = willyVerliert
    ? 'Willy hat verloren und wischt jetzt die Tafel. Mit dem Besen. Das ist falsch, aber er macht es trotzdem.'
    : rolle
      ? `<@${verlierer}> hat jetzt **eine Stunde Tafeldienst** 🧽.`
      : `<@${verlierer}> müsste eigentlich Tafeldienst machen, aber Willy darf die Rolle nicht vergeben. Glück gehabt.`;
  return interaction.update({
    embeds: [duellEmbed(d, `${zeile}\n\n🏆 **<@${gewinner}> gewinnt!**\n${strafe}`)],
    components: [],
    allowedMentions: NO_PINGS,
  });
}

async function duellStarten(interaction) {
  const gegner = interaction.options.getUser('gegner', true);
  const ich = interaction.user;
  if (gegner.id === ich.id) return interaction.reply({ content: '🪞 Du forderst dich selbst heraus. Du verlierst. Und gewinnst. Unentschieden. Glückwunsch?', ...ephemeral });
  const gegenWilly = gegner.id === interaction.client.user.id;
  if (gegner.bot && !gegenWilly) return interaction.reply({ content: 'Bots duellieren sich nicht. Nur Willy. Willy duelliert sich immer.', ...ephemeral });

  const d = { id: String(naechsteId++), herausforderer: ich.id, gegner: gegner.id, wahl: {}, status: 'offen' };
  duelle.set(d.id, d);
  setTimeout(() => {
    if (duelle.get(d.id) === d) {
      duelle.delete(d.id);
      interaction.editReply({ embeds: [duellEmbed(d, '⌛ **Duell verfallen.** Alle sind nach Hause gegangen.')], components: [] }).catch(() => {});
    }
  }, 3 * MIN);

  if (gegenWilly) {
    // Willy nimmt immer an und wählt (meistens) zufällig
    d.status = 'kampf';
    d.wahl[gegner.id] = pick(Object.keys(WAFFEN));
    return interaction.reply({
      embeds: [duellEmbed(d, '🧹 Willy nimmt an. Er hat schon gewählt. (Er hat nicht geschummelt. Wahrscheinlich.)\n\nWähle deine Waffe:')],
      components: [waffenReihe(d.id)],
      allowedMentions: NO_PINGS,
    });
  }
  return interaction.reply({
    content: `<@${gegner.id}>`,
    embeds: [duellEmbed(d, `<@${ich.id}> fordert <@${gegner.id}> zum Duell heraus! Schere, Stein, Papier.\nNimmst du an?`)],
    components: [
      new ActionRowBuilder().addComponents(
        knopf(`duell:annehmen:${d.id}`, '⚔️ Annehmen', ButtonStyle.Success),
        knopf(`duell:ablehnen:${d.id}`, '🏃 Weglaufen', ButtonStyle.Danger),
      ),
    ],
    allowedMentions: { users: [gegner.id] },
  });
}

/** Knöpfe: duell:annehmen|ablehnen|wahl:<id>[:waffe] */
export async function handleDuell(interaction, action, id, waffe) {
  const d = duelle.get(id);
  if (!d) return interaction.reply({ content: '⌛ Dieses Duell ist vorbei (oder Willy hat neu gestartet).', ...ephemeral });
  const uid = interaction.user.id;
  const dabei = uid === d.herausforderer || uid === d.gegner;

  if (action === 'annehmen' || action === 'ablehnen') {
    if (uid !== d.gegner) return interaction.reply({ content: uid === d.herausforderer ? 'Du musst warten, bis die andere Person annimmt.' : 'Das ist nicht dein Duell. Zuschauen ist erlaubt.', ...ephemeral });
    if (action === 'ablehnen') {
      duelle.delete(id);
      return interaction.update({ embeds: [duellEmbed(d, `🏃 <@${d.gegner}> ist weggelaufen. Feige, aber klug.`)], components: [], allowedMentions: NO_PINGS });
    }
    d.status = 'kampf';
    return interaction.update({ content: '', embeds: [duellEmbed(d, 'Das Duell beginnt! Beide wählen jetzt geheim ihre Waffe:')], components: [waffenReihe(id)], allowedMentions: NO_PINGS });
  }

  if (action === 'wahl') {
    if (d.status !== 'kampf') return interaction.reply({ content: 'Erst annehmen, dann kämpfen.', ...ephemeral });
    if (!dabei) return interaction.reply({ content: 'Das ist nicht dein Duell. Zuschauen ist erlaubt.', ...ephemeral });
    if (!WAFFEN[waffe]) return interaction.reply({ content: 'Diese Waffe ist im Schulgebäude verboten.', ...ephemeral });
    if (d.wahl[uid]) return interaction.reply({ content: `Du hast schon ${WAFFEN[d.wahl[uid]].emoji} gewählt. Umentscheiden ist feige.`, ...ephemeral });
    d.wahl[uid] = waffe;
    if (d.wahl[d.herausforderer] && d.wahl[d.gegner]) return duellAuswerten(interaction, d);
    const andere = uid === d.herausforderer ? d.gegner : d.herausforderer;
    await interaction.reply({ content: `${WAFFEN[waffe].emoji} Geheim gewählt. Warte auf die andere Person …`, ...ephemeral });
    return interaction.message
      ?.edit({ embeds: [duellEmbed(d, `✅ <@${uid}> hat gewählt. Warte auf <@${andere}> …`)], allowedMentions: NO_PINGS })
      .catch(() => {});
  }
  return interaction.reply({ content: 'Hä?', ...ephemeral });
}

// ---------------------------------------------------------------------------
export const SPIELE_COMMANDS = ['wort', 'duell'];

export async function handleSpieleCommand(interaction) {
  if (interaction.commandName === 'duell') return duellStarten(interaction);
  const sub = interaction.options.getSubcommand();
  if (sub === 'raten') return wortRaten(interaction);
  if (sub === 'bestenliste') return wortBestenliste(interaction);
  // status
  const w = wortState(interaction.guildId);
  const versuche = w.spiele[interaction.user.id] ?? [];
  const loesung = wortDesTages(interaction.guildId);
  return interaction.reply({
    content:
      `🟩 **Wort des Tages** (5 Buchstaben, Schule & Insider) · ${versuche.length}/${VERSUCHE} Versuche · heute ${w.geloest.length}× gelöst\n` +
      (versuche.length ? `${raster(versuche, loesung, true)}\n${tastatur(versuche, loesung)}` : 'Noch nicht geraten. Los: `/wort raten`'),
    ...ephemeral,
  });
}

export const _duelle = duelle;
