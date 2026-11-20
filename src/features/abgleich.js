// Abgleich: Bringt den Server bei jedem Start auf den neuesten Stand.
//  - Einmalig: alte Chaos-Struktur aufräumen (Witzkanäle löschen, Kanäle umbenennen/verschieben)
//  - Immer: fehlende Kategorien und Kanäle anlegen, Namen, Beschreibungen, Slowmode, Platzlimits
//    und Rechte angleichen, Willys Nachrichten (Regeln, Start, Lotterie, Tickets, Kodex) aktualisieren,
//    Reihenfolge herstellen.
// Gelöscht werden nur Kanäle aus ALTE_WITZKANAELE (einmalig) und Willys eigene, veraltete Nachrichten.
// Rechte: Angepasst werden nur die Einträge, die Willy selbst verwaltet (@everyone, Verifiziert, Team, Willy).
// Alles andere (z. B. Nachsitzen oder Lehrer-Bots) bleibt, wie es ist.
import { ChannelType, EmbedBuilder, OverwriteType, PermissionsBitField } from 'discord.js';
import { ALTE_KATEGORIEN, ALTE_WITZKANAELE, LAYOUT, LAYOUT_VERSION, TEAM_KODEX } from './layout.js';
import { allRulesMessage, startMessage } from './rules.js';
import { lotteryMessage } from './lottery.js';
import { ticketPanelMessage } from './tickets.js';
import { findRole } from './roles.js';
import { guildState, save } from '../storage.js';
import { kurzHash, logError } from '../util.js';

const NO_PINGS = { parse: [] };
const typOf = (ch) => (ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText);

const hatKnopf = (m, prefix) => m.components?.some((row) => row.components?.some((c) => c.customId?.startsWith(prefix)));

function kodexNachrichten() {
  const embeds = TEAM_KODEX.map((s, i) => new EmbedBuilder().setColor(i === 0 ? 0x2c3e50 : 0x7f8c8d).setTitle(s.title).setDescription(s.text));
  const out = [];
  for (let i = 0; i < embeds.length; i += 10) out.push({ embeds: embeds.slice(i, i + 10) });
  return out;
}

/**
 * Willys feste Nachrichten. "erkennen" findet alte Versionen, falls Willy sich die Nachricht
 * noch nicht gemerkt hat (z. B. von vor diesem Update). Nur eigene Nachrichten von Willy.
 */
const INHALTE = {
  start: { nachrichten: () => [startMessage()], erkennen: (m) => hatKnopf(m, 'rules:') },
  realRules: {
    nachrichten: () => [allRulesMessage()],
    erkennen: (m) => m.content?.startsWith('🧦') || m.embeds?.some((e) => e.title?.includes('REGELN')),
  },
  lottery: { nachrichten: () => [lotteryMessage()], erkennen: (m) => hatKnopf(m, 'lotto:') },
  tickets: { nachrichten: () => [ticketPanelMessage()], erkennen: (m) => hatKnopf(m, 'ticket:open') },
  kodex: { nachrichten: kodexNachrichten, erkennen: (m) => m.embeds?.length > 0 && !m.components?.length },
};

/** Begrüßung in neuen Kanälen (nur einmal beim Anlegen). */
async function begruessung(key, channel) {
  if (key !== 'modlog') return;
  await channel.send({ content: '🚨 **Polizeiwache eröffnet.** Hier landen alle Verstöße gegen die Serverordnung. Rechtskräftig. (Nicht.)', allowedMentions: NO_PINGS });
}

async function holen(channel, id) {
  try {
    return await channel.messages.fetch(id);
  } catch {
    return null;
  }
}

/**
 * Bringt Willys feste Nachrichten auf den neuesten Stand:
 * gleich geblieben -> nichts tun, geändert -> bearbeiten (gleiche Stelle), fehlt -> neu posten.
 */
export async function inhaltAbgleich(guild, byKey, log) {
  const g = guildState(guild.id);
  g.inhalte ??= {};
  const bearbeitet = [];
  const gepostet = [];
  for (const [key, def] of Object.entries(INHALTE)) {
    const channel = byKey[key];
    if (!channel?.isTextBased?.() || !channel.messages) continue;
    try {
      const soll = def.nachrichten();
      const hash = kurzHash(soll);
      const stand = g.inhalte[key];

      // Bisherige Nachrichten: gemerkte IDs, sonst alte Versionen im Kanal suchen
      let alt = [];
      if (stand?.ids?.length) {
        alt = (await Promise.all(stand.ids.map((id) => holen(channel, id)))).filter(Boolean);
        if (alt.length === stand.ids.length && stand.hash === hash) continue; // alles aktuell
      } else {
        const letzte = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        alt = [...(letzte?.values() ?? [])].filter((m) => m.author?.id === guild.client.user.id && def.erkennen(m));
      }
      alt.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      let ids;
      if (alt.length === soll.length) {
        // gleiche Anzahl: einfach bearbeiten, dann bleibt alles an seinem Platz
        for (let i = 0; i < soll.length; i++) {
          const p = soll[i];
          await alt[i].edit({ content: p.content ?? '', embeds: p.embeds ?? [], components: p.components ?? [], allowedMentions: NO_PINGS });
        }
        ids = alt.map((m) => m.id);
        bearbeitet.push(`#${channel.name}`);
      } else {
        for (const m of alt) await m.delete().catch(() => {});
        ids = [];
        for (const p of soll) ids.push((await channel.send({ allowedMentions: NO_PINGS, ...p })).id);
        gepostet.push(`#${channel.name}`);
      }
      g.inhalte[key] = { hash, ids };
      save();
    } catch (err) {
      logError(`abgleich:inhalt:${key}`, err);
    }
  }
  if (bearbeitet.length) log.push(`📝 Nachrichten aktualisiert: ${bearbeitet.join(', ')}`);
  if (gepostet.length) log.push(`📝 Nachrichten neu gepostet: ${gepostet.join(', ')}`);
}

/**
 * Gleicht die Rechte-Einträge ab, die Willy verwaltet (soll = Ergebnis von overwrites()).
 * Andere Einträge bleiben unberührt. Gibt true zurück, wenn etwas geändert wurde.
 */
export async function rechteAbgleich(channel, soll, reason = 'Abgleich') {
  if (!channel.permissionOverwrites) return false;
  const guild = channel.guild;
  let geaendert = false;
  for (const o of soll) {
    const allow = PermissionsBitField.resolve(o.allow ?? []);
    const deny = PermissionsBitField.resolve(o.deny ?? []);
    const ist = channel.permissionOverwrites.cache.get(o.id);
    if (ist && ist.allow?.bitfield === allow && ist.deny?.bitfield === deny) continue;
    const optionen = {};
    for (const name of new PermissionsBitField(allow).toArray()) optionen[name] = true;
    for (const name of new PermissionsBitField(deny).toArray()) optionen[name] = false;
    const istRolle = o.id === guild.roles.everyone.id || guild.roles.cache.has(o.id);
    try {
      await channel.permissionOverwrites.create(o.id, optionen, { type: istRolle ? OverwriteType.Role : OverwriteType.Member, reason });
      geaendert = true;
    } catch (err) {
      logError('abgleich:rechte', err);
    }
  }
  return geaendert;
}

/** Beschreibung, Slowmode und Platzlimit wie in der Vorlage. Gibt die Anzahl Änderungen zurück. */
async function einstellungenAbgleich(channel, ch) {
  let n = 0;
  const versuch = async (was, fn) => {
    try {
      await fn();
      n++;
    } catch (err) {
      logError(`abgleich:${was}`, err);
    }
  };
  if (ch.type === 'voice') {
    const limit = ch.userLimit ?? 0;
    if ((channel.userLimit ?? 0) !== limit) await versuch('limit', () => channel.setUserLimit(limit, 'Abgleich'));
  } else {
    if (ch.topic !== undefined && (channel.topic ?? '') !== ch.topic) await versuch('thema', () => channel.setTopic(ch.topic, 'Abgleich'));
    const slow = ch.slowmode ?? 0;
    if ((channel.rateLimitPerUser ?? 0) !== slow) await versuch('slowmode', () => channel.setRateLimitPerUser(slow, 'Abgleich'));
  }
  return n;
}

/** Einmaliger Umstieg von der alten Chaos-Struktur. */
async function alteStrukturAufraeumen(guild, log) {
  const g = guildState(guild.id);
  // Diese Aufgaben gibt es nicht mehr bzw. sie gehören jetzt zu anderen Kanälen
  for (const k of ['ch_system', 'ch_fakeRules', 'ch_nichtEnten', 'ch_nichtOeffnen']) delete g.ids[k];
  const geschuetzt = new Set(Object.values(g.ids)); // Kanäle mit bekannter Aufgabe nie löschen
  let geloescht = 0;
  for (const ch of [...guild.channels.cache.values()]) {
    if (ch.type === ChannelType.GuildCategory || geschuetzt.has(ch.id)) continue;
    if (!ALTE_WITZKANAELE.includes(ch.name)) continue;
    try {
      await ch.delete('Aufräumen: alter Witzkanal');
      geloescht++;
    } catch (err) {
      logError('abgleich:loeschen', err);
    }
  }
  if (geloescht) log.push(`🧹 ${geloescht} alte Witzkanäle gelöscht`);
  return geloescht;
}

async function leereAlteKategorienLoeschen(guild) {
  let n = 0;
  for (const cat of [...guild.channels.cache.values()]) {
    if (cat.type !== ChannelType.GuildCategory || !ALTE_KATEGORIEN.includes(cat.name)) continue;
    const kinder = guild.channels.cache.filter((c) => c.parentId === cat.id);
    if (kinder.size) continue; // da hat jemand was Eigenes reingelegt
    await cat.delete('Aufräumen: leere alte Kategorie').catch((err) => logError('abgleich:kategorie', err));
    n++;
  }
  return n;
}

/**
 * Stellt die Struktur aus LAYOUT her. Gibt { byKey, neu } zurück.
 * overwrites(guild, ids, sicht, nurLesen) kommt aus setup.js (Rechte je nach Sichtbarkeit).
 */
export async function layoutAbgleich(guild, log, overwrites) {
  const g = guildState(guild.id);
  const verified = findRole(guild, 'verified');
  const team = findRole(guild, 'team');
  const ids = { verified: verified?.id, team: team?.id };
  const byKey = {};
  let angelegt = 0;
  let verschoben = 0;
  let umbenannt = 0;
  let angepasst = 0; // Beschreibung, Slowmode, Limit
  let rechte = 0;
  const vcNamen = g.vcNamen ?? {}; // gerade umbenannte Sprachkanäle (voicenames.js): Kanal-ID -> echter Name

  // Umstieg von der alten Struktur (nur einmal)
  const umstieg = (g.layoutVersion ?? 1) < LAYOUT_VERSION && g.setupDone;
  let entfernt = 0;
  if (umstieg) {
    await alteStrukturAufraeumen(guild, log);
    entfernt += await leereAlteKategorienLoeschen(guild); // z. B. die alte "🔊 Sprachkanäle" mit Text-Kanälen
  }

  const reihenfolge = [];
  for (const cat of LAYOUT) {
    const namen = [cat.name, ...(cat.alteNamen ?? [])];
    let category =
      guild.channels.cache.get(g.ids[`ch_${cat.key}`]) ??
      guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && namen.includes(c.name));
    if (!category) {
      category = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites(guild, ids, cat.sicht, false), reason: 'Abgleich' });
      angelegt++;
    } else {
      if (category.name !== cat.name) {
        await category.setName(cat.name, 'Abgleich').catch((err) => logError('abgleich:kat-name', err));
        umbenannt++;
      }
      if (await rechteAbgleich(category, overwrites(guild, ids, cat.sicht, false))) rechte++;
    }
    g.ids[`ch_${cat.key}`] = category.id;
    byKey[cat.key] = category;
    reihenfolge.push(category);

    for (const ch of cat.channels) {
      const namenCh = [ch.name, ...(ch.alteNamen ?? [])];
      // Kanäle ohne eigene Aufgabe merkt sich Willy über ihren Namen (chn_<name>)
      const idKey = ch.key ? `ch_${ch.key}` : `chn_${ch.name}`;
      const gemerkt = [g.ids[idKey], ...namenCh.map((n) => g.ids[`chn_${n}`])].map((id) => id && guild.channels.cache.get(id)).find(Boolean);
      let channel =
        gemerkt ||
        guild.channels.cache.find((c) => c.type === typOf(ch) && (namenCh.includes(c.name) || namenCh.includes(vcNamen[c.id]))) ||
        null;
      if (!channel) {
        channel = await guild.channels.create({
          name: ch.name,
          type: typOf(ch),
          parent: category.id,
          topic: ch.type === 'text' ? ch.topic : undefined,
          rateLimitPerUser: ch.slowmode,
          userLimit: ch.userLimit,
          permissionOverwrites: overwrites(guild, ids, cat.sicht, ch.nurLesen),
          reason: 'Abgleich',
        });
        angelegt++;
        if (ch.key) await begruessung(ch.key, channel).catch((err) => logError(`abgleich:begruessung:${ch.key}`, err));
      } else {
        if (channel.parentId !== category.id) {
          await channel.setParent(category.id, { lockPermissions: false, reason: 'Abgleich' }).catch((err) => logError('abgleich:verschieben', err));
          verschoben++;
        }
        if (channel.name !== ch.name) {
          await channel.setName(ch.name, 'Abgleich').catch((err) => logError('abgleich:name', err));
          if (vcNamen[channel.id]) delete vcNamen[channel.id]; // war nur vorübergehend umbenannt
          umbenannt++;
        }
        angepasst += await einstellungenAbgleich(channel, ch);
        if (await rechteAbgleich(channel, overwrites(guild, ids, cat.sicht, ch.nurLesen))) rechte++;
      }
      g.ids[idKey] = channel.id;
      byKey[ch.key ?? ch.name] = channel;
    }
  }
  save();

  if (umstieg) {
    entfernt += await leereAlteKategorienLoeschen(guild);
    if (entfernt) log.push(`🗂️ ${entfernt} leere alte Kategorien entfernt`);
  }

  // Kanäle innerhalb jeder Kategorie in der Reihenfolge der Vorlage (eigene/zusätzliche Kanäle dahinter)
  for (const cat of LAYOUT) {
    const category = byKey[cat.key];
    const soll = cat.channels.map((ch) => byKey[ch.key ?? ch.name]).filter(Boolean);
    const rest = guild.channels.cache.filter((c) => c.parentId === category.id && !soll.includes(c)).sort((a, b) => a.position - b.position);
    const gewuenscht = [...soll, ...rest.values()];
    const istJetzt = [...guild.channels.cache.filter((c) => c.parentId === category.id).values()].sort((a, b) => a.position - b.position);
    // Text- und Sprachkanäle werden von Discord getrennt sortiert, deshalb pro Typ vergleichen
    const nachTyp = (list, voice) => list.filter((c) => (c.type === ChannelType.GuildVoice) === voice).map((c) => c.id).join();
    if (nachTyp(gewuenscht, false) !== nachTyp(istJetzt, false) || nachTyp(gewuenscht, true) !== nachTyp(istJetzt, true)) {
      await guild.channels
        .setPositions(gewuenscht.map((c, i) => ({ channel: c.id, position: i, parent: category.id })))
        .catch((err) => logError('abgleich:kanal-reihenfolge', err));
    }
  }

  // Kategorien in der richtigen Reihenfolge (die Schul-Kategorie hängt sich hinter "📚 Schule")
  const unterricht = guild.channels.cache.get(g.schule?.ids?.category);
  if (unterricht) reihenfolge.splice(reihenfolge.findIndex((c) => c.id === byKey.catSchule?.id) + 1, 0, unterricht);
  const sortiert = [...guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).values()].sort((a, b) => a.position - b.position);
  const passt = reihenfolge.every((c, i) => sortiert[i]?.id === c.id);
  if (!passt) {
    await guild.channels
      .setPositions(reihenfolge.map((c, i) => ({ channel: c.id, position: i })))
      .catch((err) => logError('abgleich:reihenfolge', err));
  }

  if (umstieg) {
    g.layoutVersion = LAYOUT_VERSION;
    save();
    log.push('✨ Server aufgeräumt (neue Struktur)');
  }
  if (angelegt) log.push(`➕ ${angelegt} fehlende Kanäle/Kategorien angelegt`);
  if (verschoben) log.push(`📦 ${verschoben} Kanäle in die richtige Kategorie verschoben`);
  if (umbenannt) log.push(`✏️ ${umbenannt} Kanäle umbenannt`);
  if (angepasst) log.push(`⚙️ ${angepasst} Kanal-Einstellungen angepasst (Beschreibung, Slowmode, Plätze)`);
  if (rechte) log.push(`🔐 Rechte in ${rechte} Kanälen/Kategorien angepasst`);
  save();

  await inhaltAbgleich(guild, byKey, log);
  return { byKey, angelegt };
}
