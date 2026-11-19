import { ROLES } from './layout.js';
import { guildState } from '../storage.js';

/** Rolle über die beim Setup gespeicherte ID finden, sonst über den Namen. */
export function findRole(guild, key) {
  const id = guildState(guild.id).ids[`role_${key}`];
  return (id && guild.roles.cache.get(id)) || guild.roles.cache.find((r) => r.name === ROLES[key].name) || null;
}

export function isVerified(member) {
  if (!member?.guild || !member.roles?.cache) return false;
  const role = findRole(member.guild, 'verified');
  return Boolean(role && member.roles.cache.has(role.id));
}

/** Kanal über den Setup-Key finden (z. B. 'modlog', 'tickets'). */
export function findChannel(guild, key) {
  const id = guildState(guild.id).ids[`ch_${key}`];
  return (id && guild.channels.cache.get(id)) || null;
}
