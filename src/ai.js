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

  // Erst das normale Modell, bei Überlastung ein kleineres Ersatzmodell
  const models = [...new Set([config.gemini.model, config.gemini.fallbackModel].filter(Boolean))];
  for (const [i, model] of models.entries()) {
    const next = models[i + 1];
    try {
      const res = await gemini.models.generateContent({
        model,
        contents,
        config: { systemInstruction: system, maxOutputTokens: 8192 },
      });
      return res.text?.trim() || null; // leer = vom Sicherheitsfilter blockiert
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      const weiter = next ? `Probiere ${next}.` : 'Willy nimmt so lange Sprüche.';
      if (status === 401 || status === 403 || (status === 400 && /api key/i.test(err.message))) {
        disable('Gemini-Key ungültig');
        return null;
      } else if (status === 503 || status === 500) {
        console.warn(`[ki] Gemini (${model}) ist gerade überlastet. ${weiter}`);
      } else if (status === 429) {
        console.warn(`[ki] Gratis-Kontingent für ${model} gerade aufgebraucht. ${weiter}`);
      } else if (status === 404) {
        console.warn(`[ki] Gemini-Modell "${model}" gibt es nicht (mehr). Trag ein anderes in der .env ein. ${weiter}`);
      } else {
        logError('ki:gemini', err);
        return null;
      }
    }
  }
  return null;
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
