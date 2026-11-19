// KI für Willy. Welche benutzt wird, hängt davon ab, welcher Key in der .env steht:
//   GEMINI_API_KEY    -> Google Gemini (kostenloses Kontingent, keine Karte nötig)
//   ANTHROPIC_API_KEY -> Claude (kostet Guthaben)
//   keiner            -> Willy antwortet mit vorgefertigten Sprüchen
// Stehen beide drin, gewinnt Claude.
import Anthropic from '@anthropic-ai/sdk';
import { ApiError, GoogleGenAI } from '@google/genai';
import { config } from './config.js';
import { logError, truncate } from './util.js';

let disabled = false; // nach ungültigem Key: bis zum Neustart nur noch Sprüche

export function aiProvider() {
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}

export function aiStatus() {
  const p = aiProvider();
  if (p === 'claude') return `🤖 Willy antwortet mit Claude (${config.claude.model}).`;
  if (p === 'gemini') return `🤖 Willy antwortet mit Google Gemini (kostenloses Kontingent, bevorzugt ${config.gemini.model}).`;
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

// Welche Modelle es gibt, fragt Willy bei Google nach (alle 6 Stunden neu)
const MISSING = new Set(); // Modelle, die mit "gibt es nicht" geantwortet haben
let discovered = null;
let discoveredAt = 0;
const SKIP_MODELS = /image|tts|audio|live|embed|vision|robotics|computer|native|learnlm|aqa|imagen|veo|gemma|exp-/i;

function rankModel(name) {
  const version = Number(/gemini-(\d+(?:\.\d+)?)/.exec(name)?.[1] ?? 0);
  return version * 10 + (/latest$/.test(name) ? 2 : 0) - (/preview/.test(name) ? 3 : 0) - (/lite/.test(name) ? 1 : 0);
}

/** Holt die Liste der Text-Modelle ("flash"), die dieser Key benutzen darf. Neueste zuerst. */
export async function discoverGeminiModels({ force = false } = {}) {
  if (!force && discovered && Date.now() - discoveredAt < 6 * 60 * 60 * 1000) return discovered;
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const pager = await gemini.models.list({ config: { pageSize: 100, queryBase: true, httpOptions: { timeout: 10_000 } } });
    const names = [];
    for await (const m of pager) {
      const name = m.name?.replace(/^models\//, '');
      if (!name || !m.supportedActions?.includes('generateContent')) continue;
      if (!/flash/i.test(name) || SKIP_MODELS.test(name)) continue;
      names.push(name);
    }
    discovered = names.sort((a, b) => rankModel(b) - rankModel(a));
  } catch (err) {
    console.warn(`[ki] Konnte die Gemini-Modellliste nicht laden (${truncate(String(err.message), 120)}).`);
    discovered ??= [];
  }
  discoveredAt = Date.now();
  return discovered;
}

/** Reihenfolge: eingestelltes Modell, eingestellte Ersatzmodelle (falls es sie gibt), dann was Google anbietet. Max. 4. */
export async function geminiModels() {
  const found = await discoverGeminiModels();
  // Hat Google eine Liste geliefert, nur eingestellte Modelle nehmen, die es auch wirklich gibt
  const configured = [config.gemini.model, ...config.gemini.fallbackModels].filter((m) => m && (!found.length || found.includes(m)));
  return [...new Set([...configured, ...found])].filter((m) => !MISSING.has(m)).slice(0, 4);
}

/**
 * Fragt Gemini. trace (optional) sammelt, was bei jedem Versuch passiert ist (für /ki test).
 * Pro Modell: ein Versuch, max. 15 Sekunden. Danach das nächste Modell.
 */
async function askGemini(system, history, trace = []) {
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Gemini will abwechselnde Rollen ("user"/"model") - aufeinanderfolgende zusammenfassen
  const contents = [];
  for (const m of history) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const last = contents.at(-1);
    if (last?.role === role) last.parts.push({ text: m.content });
    else contents.push({ role, parts: [{ text: m.content }] });
  }

  const models = await geminiModels();
  for (const [i, model] of models.entries()) {
    const next = models[i + 1];
    const weiter = next ? `Probiere ${next}.` : 'Willy nimmt so lange Sprüche.';
    const started = Date.now();
    try {
      const res = await gemini.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: system,
          maxOutputTokens: 8192,
          httpOptions: { timeout: 15_000, retryOptions: { attempts: 1 } },
        },
      });
      const text = res.text?.trim() || null;
      const reason = res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason ?? 'unbekannt';
      trace.push({ model, ms: Date.now() - started, ok: Boolean(text), info: text ? 'Antwort erhalten' : `leere Antwort (Grund: ${reason})` });
      if (text) return text;
      console.warn(`[ki] Gemini (${model}) hat leer geantwortet (Grund: ${reason}). ${weiter}`);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      const ms = Date.now() - started;
      trace.push({ model, ms, ok: false, info: `Fehler ${status ?? ''} ${truncate(String(err.message), 160)}`.trim() });
      if (status === 401 || status === 403 || (status === 400 && /api key/i.test(err.message))) {
        disable('Gemini-Key ungültig');
        return null;
      } else if (status === 503 || status === 500) {
        console.warn(`[ki] Gemini (${model}) ist gerade überlastet. ${weiter}`);
      } else if (status === 429) {
        console.warn(`[ki] Gratis-Kontingent für ${model} gerade aufgebraucht. ${weiter}`);
      } else if (status === 404) {
        MISSING.add(model); // nicht nochmal probieren
        console.warn(`[ki] Gemini-Modell "${model}" gibt es nicht (mehr), ich lasse es ab jetzt weg. ${weiter}`);
      } else if (/abort|timeout|timed out/i.test(String(err.message)) || ms >= 14_000) {
        console.warn(`[ki] Gemini (${model}) hat nach ${Math.round(ms / 1000)} s nicht geantwortet. ${weiter}`);
      } else {
        logError('ki:gemini', err);
        return null;
      }
    }
  }
  return null;
}

/** Für /ki test: eine Testfrage stellen und genau berichten, was passiert. */
export async function testAI() {
  const provider = aiProvider();
  const lines = [aiStatus()];
  if (!provider) return lines;
  if (disabled) {
    lines.push('⛔ Die KI ist seit dem letzten Fehler abgeschaltet (z. B. ungültiger Key). Key prüfen und Bot neu starten.');
    return lines;
  }
  const history = [{ role: 'user', content: 'Test: Mein Stuhl wackelt.' }];
  const system = 'Du bist Willy, ein genervter Hausmeister. Antworte mit einem kurzen Satz auf Deutsch.';
  if (provider === 'gemini') {
    const found = await discoverGeminiModels({ force: true });
    lines.push(found.length ? `📋 Für deinen Key verfügbar: ${found.slice(0, 8).map((m) => `\`${m}\``).join(', ')}` : '📋 Modellliste von Google nicht abrufbar.');
    const trace = [];
    const text = await askGemini(system, history, trace);
    for (const t of trace) lines.push(`${t.ok ? '✅' : '❌'} \`${t.model}\` · ${(t.ms / 1000).toFixed(1)} s · ${t.info}`);
    lines.push(text ? `💬 Willy sagt: „${truncate(text, 300)}“` : '🥫 Keine KI-Antwort, Willy würde jetzt einen Standardspruch nehmen.');
    return lines;
  }
  const text = await askClaude(system, history);
  lines.push(text ? `💬 Willy sagt: „${truncate(text, 300)}“` : '🥫 Keine KI-Antwort (Details im Log).');
  return lines;
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
