import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function num(value, fallback) {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
}

export const config = {
  token: process.env.DISCORD_TOKEN,

  claude: {
    model: process.env.CLAUDE_MODEL || 'claude-opus-5-5',
    maxRepliesPerTicket: num(process.env.TICKET_MAX_REPLIES, 25),
  },

  chaos: {
    minMinutes: num(process.env.CHAOS_MIN_MINUTES, 10),
    maxMinutes: num(process.env.CHAOS_MAX_MINUTES, 45),
    joinChance: num(process.env.CHAOS_JOIN_CHANCE, 0.25),
    minSounds: num(process.env.CHAOS_MIN_SOUNDS, 1),
    maxSounds: num(process.env.CHAOS_MAX_SOUNDS, 4),
    useDefaultSounds: process.env.CHAOS_DEFAULT_SOUNDS !== 'false',
  },

  moderation: {
    timeoutSeconds: num(process.env.MOD_TIMEOUT_SECONDS, 30),
  },
};
