import { GoogleGenAI } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

let cached: GoogleGenAI | null = null;

export class GeminiNotConfiguredError extends Error {
  code = "GEMINI_NOT_CONFIGURED" as const;
  constructor() {
    super("GEMINI_API_KEY is not configured.");
    this.name = "GeminiNotConfiguredError";
  }
}

/**
 * Lazy singleton. We intentionally read `GEMINI_API_KEY` at call time so tests
 * that mock the SDK don't need the env var, and local routes that never reach
 * the extract pipeline don't boot the SDK.
 */
export function getGeminiClient(): GoogleGenAI {
  if (cached) return cached;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiNotConfiguredError();
  cached = new GoogleGenAI({ apiKey });
  return cached;
}

/** Testing helper. */
export function __resetGeminiClientForTests() {
  cached = null;
}

export function resolveGeminiModelId(): string {
  return process.env.GEMINI_MODEL_ID?.trim() || DEFAULT_GEMINI_MODEL;
}

export function resolvePromptVersion(): number {
  const raw = process.env.GEMINI_PROMPT_VERSION;
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
