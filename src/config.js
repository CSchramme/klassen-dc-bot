import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function num(value, fallback) {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
}

export const config = {
  token: process.env.DISCORD_TOKEN,

  gemini: {
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  },

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

  spass: {
    zeitzone: process.env.ZEITZONE || 'Europe/Berlin',
    vertretungsplanUhrzeit: process.env.VERTRETUNGSPLAN_UHRZEIT || '07:15',
    namensrouletteUhrzeit: process.env.NAMENSROULETTE_UHRZEIT || '07:00',
    durchsageStunden: [num(process.env.DURCHSAGE_STUNDEN_MIN, 3), num(process.env.DURCHSAGE_STUNDEN_MAX, 8)],
    putzenStunden: [num(process.env.PUTZEN_STUNDEN_MIN, 4), num(process.env.PUTZEN_STUNDEN_MAX, 10)],
    feueralarmTage: [num(process.env.FEUERALARM_TAGE_MIN, 2), num(process.env.FEUERALARM_TAGE_MAX, 7)],
    // Zufällige Aktionen nur zwischen diesen Uhrzeiten (nachts ist Ruhe)
    aktivVon: num(process.env.AKTIV_VON, 8),
    aktivBis: num(process.env.AKTIV_BIS, 21),
  },

  moderation: {
    timeoutSeconds: num(process.env.MOD_TIMEOUT_SECONDS, 30),
  },
};
