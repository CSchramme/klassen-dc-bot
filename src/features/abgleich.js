// Abgleich: Bringt den Server bei jedem Start auf den neuesten Stand.
//  - Einmalig: alte Chaos-Struktur aufräumen (Witzkanäle löschen, Kanäle umbenennen/verschieben)
//  - Immer: fehlende Kategorien, Kanäle und Inhalte ergänzen, Reihenfolge herstellen
// Gelöscht wird nur beim einmaligen Umstieg und nur Kanäle aus ALTE_WITZKANAELE.
import { ChannelType, EmbedBuilder } from 'discord.js';
import { ALTE_KATEGORIEN, ALTE_WITZKANAELE, LAYOUT, LAYOUT_VERSION, TEAM_KODEX } from './layout.js';
import { allRulesMessage, startMessage } from './rules.js';
import { lotteryMessage } from './lottery.js';
import { ticketPanelMessage } from './tickets.js';
import { findRole } from './roles.js';
import { guildState, save } from '../storage.js';
import { logError } from '../util.js';

const NO_PINGS = { parse: [] };
const typOf = (ch) => (ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText);

/** Inhalte für besondere Kanäle (nur beim Anlegen gepostet). */
async function inhaltPosten(key, channel) {
  const send = (payload) => channel.send({ allowedMentions: NO_PINGS, ...payload });
  switch (key) {
    case 'start':
      return send(startMessage());
    case 'realRules':
      return send(allRulesMessage());
    case 'lottery':
      return send(lotteryMessage());
    case 'tickets':
      return send(ticketPanelMessage());
    case 'modlog':
      return send({ content: '🚨 **Polizeiwache eröffnet.** Hier landen alle Verstöße gegen die Serverordnung. Rechtskräftig. (Nicht.)' });
    case 'kodex': {
      const embeds = TEAM_KODEX.map((s, i) => new EmbedBuilder().setColor(i === 0 ? 0x2c3e50 : 0x7f8c8d).setTitle(s.title).setDescription(s.text));
      for (let i = 0; i < embeds.length; i += 10) await send({ embeds: embeds.slice(i, i + 10) });
      return null;
    }
    default:
      return null;
  }
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
    } else if (category.name !== cat.name) {
      await category.setName(cat.name, 'Abgleich').catch((err) => logError('abgleich:kat-name', err));
      umbenannt++;
    }
    g.ids[`ch_${cat.key}`] = category.id;
    byKey[cat.key] = category;
    reihenfolge.push(category);

    for (const ch of cat.channels) {
      const namenCh = [ch.name, ...(ch.alteNamen ?? [])];
      let channel =
        (ch.key && guild.channels.cache.get(g.ids[`ch_${ch.key}`])) ||
        guild.channels.cache.find((c) => c.type === typOf(ch) && namenCh.includes(c.name)) ||
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
        if (ch.key) await inhaltPosten(ch.key, channel).catch((err) => logError(`abgleich:inhalt:${ch.key}`, err));
      } else {
        if (channel.parentId !== category.id) {
          await channel.setParent(category.id, { lockPermissions: false, reason: 'Abgleich' }).catch((err) => logError('abgleich:verschieben', err));
          verschoben++;
        }
        if (channel.name !== ch.name) {
          await channel.setName(ch.name, 'Abgleich').catch((err) => logError('abgleich:name', err));
          umbenannt++;
        }
      }
      if (ch.key) g.ids[`ch_${ch.key}`] = channel.id;
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
  return { byKey, angelegt };
}
