// KI für Willy. Welche benutzt wird, hängt davon ab, welcher Key in der .env steht:
//   GEMINI_API_KEY    -> Google Gemini (kostenloses Kontingent, keine Karte nötig)
//   ANTHROPIC_API_KEY -> Claude (kostet Guthaben)
//   keiner            -> Willy antwortet mit vorgefertigten Sprüchen
// Stehen beide drin, gewinnt Claude.
import Anthropic from '@anthropic-ai/sdk';
import { ApiError, GoogleGenAI } from '@google/genai';
import { config } from './config.js';
import { logError } from './util.js';

let disabled = false; // nach ungültigem Key: bis zum Neustart nur noch Sprüche

export function aiProvider() {
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}

export function aiStatus() {
  const p = aiProvider();
  if (p === 'claude') return `🤖 Willy antwortet mit Claude (${config.claude.model}).`;
  if (p === 'gemini') return `🤖 Willy antwortet mit Google Gemini (${config.gemini.model}, kostenloses Kontingent).`;
  return '🥫 Kein KI-Key in der .env: Willy antwortet nur mit vorgefertigten Sprüchen.';
}

function disable(reason) {
  disabled = true;
  console.warn(`[ki] KI deaktiviert: ${reason}. Willy antwortet bis zum Neustart mit vorgefertigten Sprüchen.`);
}

/**
 * Fragt die KI. history: [{ role: 'user' | 'assistant', content: string }], beginnt mit 'user'.
 * Gibt den Antworttext zurück oder null (keine KI, Fehler, Ablehnung, Limit erreicht).
 */
export async function askAI(system, history) {
  if (disabled) return null;
  const provider = aiProvider();
  if (provider === 'claude') return askClaude(system, history);
  if (provider === 'gemini') return askGemini(system, history);
  return null;
}

// ---------------------------------------------------------------------------
// Google Gemini
// ---------------------------------------------------------------------------
let gemini = null;

async function askGemini(system, history) {
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Gemini will abwechselnde Rollen ("user"/"model") - aufeinanderfolgende zusammenfassen
  const contents = [];
  for (const m of history) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const last = contents.at(-1);
    if (last?.role === role) last.parts.push({ text: m.content });
    else contents.push({ role, parts: [{ text: m.content }] });
  }

  try {
    const res = await gemini.models.generateContent({
      model: config.gemini.model,
      contents,
      config: { systemInstruction: system, maxOutputTokens: 8192 },
    });
    return res.text?.trim() || null; // leer = vom Sicherheitsfilter blockiert
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 403 || (err.status === 400 && /api key/i.test(err.message))) {
        disable('Gemini-Key ungültig');
      } else if (err.status === 429) {
        console.warn('[ki] Gemini-Gratiskontingent gerade aufgebraucht (zu viele Anfragen). Willy nimmt so lange Sprüche.');
      } else if (err.status === 404) {
        console.warn(`[ki] Gemini-Modell "${config.gemini.model}" gibt es nicht (mehr). Trag ein anderes bei GEMINI_MODEL in der .env ein.`);
      } else {
        logError('ki:gemini', err);
      }
    } else {
      logError('ki:gemini', err);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------
let anthropic = null;

// Modelle, die serverseitige Fallbacks bei Ablehnungen unterstützen
const SUPPORTS_FALLBACK = /^claude-(fable-5-[12]|mythos-5-[12]|opus-5(-5)?|sonnet-5-5)$/;
// Ältere Modelle kennen den effort-Parameter nicht
const NO_EFFORT = /claude-(haiku-4|sonnet-4-5|opus-4-[01]|3)/;

async function askClaude(system, history) {
  anthropic ??= new Anthropic();
  const model = config.claude.model;
  const params = { model, max_tokens: 4000, system, messages: history };
  if (!NO_EFFORT.test(model)) params.output_config = { effort: 'low' };
  if (SUPPORTS_FALLBACK.test(model)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }

  try {
    const res = await anthropic.beta.messages.create(params);
    if (res.stop_reason === 'refusal') return null;
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text || null;
  } catch (err) {
    // Fehlende Zugangsdaten sind kein APIError (das SDK wirft dann einen normalen Error)
    if (err instanceof Anthropic.AuthenticationError || !(err instanceof Anthropic.APIError)) {
      disable(`Claude: ${err.message}`);
    } else if (err instanceof Anthropic.RateLimitError) {
      console.warn('[ki] Claude Rate-Limit erreicht.');
    } else {
      logError('ki:claude', err);
    }
    return null;
  }
}
