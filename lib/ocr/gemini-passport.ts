import {
  getGeminiClient,
  resolveGeminiModelId,
  resolvePromptVersion,
} from "@/lib/gemini/client";

import {
  listMissingOcrFields,
  OCR_RAW_STRING_MAX,
  OCR_SCHEMA_VERSION,
  ocrResultSchema,
  type OcrResult,
  type RequiredOcrField,
} from "./schema";

export const PASSPORT_PROMPT = `
You are an OCR service for passport bio pages. Return a single JSON object only,
no prose, no markdown, no comments.

Fields (strings or null; dates must be YYYY-MM-DD):
- fullName          (string or null)
- dateOfBirth       (YYYY-MM-DD or null)
- placeOfBirth      (string or null)
- nationality       (string or null)
- passportNumber    (string or null)
- passportExpiryDate(YYYY-MM-DD or null)
- profession        (string or null)   // usually null — not on passport bio page
- address           (string or null)   // usually null — not on passport bio page

Rules:
- Read the machine-readable zone (MRZ) + visual zone; prefer MRZ for passport
  number and dates when they agree.
- If a field is unreadable or absent, return null for that field.
- Never hallucinate values. Never include any keys other than those listed.
- Output MUST be valid JSON, no trailing comma, no leading key name.
`.trim();

export type OcrAttemptOutcome = {
  attempt: 1 | 2;
  status: "succeeded" | "failed";
  result: OcrResult | null;
  rawText: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  missingFields: RequiredOcrField[];
  latencyMs: number;
  usage: unknown;
};

export type ExtractPassportResult = {
  status: "succeeded" | "needs_manual" | "failed";
  attempts: OcrAttemptOutcome[];
  finalResult: OcrResult | null;
  missingFields: RequiredOcrField[];
  provider: "gemini";
  model: string;
  promptVersion: number;
};

export type ExtractPassportInput = {
  imageBytes: Buffer;
  contentType: string;
  /** Total budget for all attempts. Spec §6.3: 25s. */
  overallTimeoutMs?: number;
  /** Override for dependency-injection in tests. */
  callModel?: CallModelFn;
};

export type CallModelFn = (args: {
  modelId: string;
  prompt: string;
  imageBytes: Buffer;
  contentType: string;
  signal: AbortSignal;
}) => Promise<{ text: string; usage?: unknown }>;

function tryParseOcrJson(raw: string): {
  ok: true;
  result: OcrResult;
} | {
  ok: false;
  errorCode: string;
  errorMessage: string;
} {
  if (raw.length > OCR_RAW_STRING_MAX) {
    return {
      ok: false,
      errorCode: "OCR_OUTPUT_TOO_LARGE",
      errorMessage: "Model output exceeded size cap.",
    };
  }

  // Gemini sometimes wraps JSON in ```json fences. Strip safely.
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      ok: false,
      errorCode: "OCR_JSON_PARSE_ERROR",
      errorMessage: err instanceof Error ? err.message : "JSON parse error",
    };
  }
  const zresult = ocrResultSchema.safeParse(parsed);
  if (!zresult.success) {
    return {
      ok: false,
      errorCode: "OCR_SCHEMA_INVALID",
      errorMessage: zresult.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    };
  }
  return {
    ok: true,
    result: { ...zresult.data, schemaVersion: OCR_SCHEMA_VERSION },
  };
}

/** Default runtime impl using the Gemini SDK. Tests inject `callModel` instead. */
const defaultCallModel: CallModelFn = async ({
  modelId,
  prompt,
  imageBytes,
  contentType,
  signal,
}) => {
  const ai = getGeminiClient();
  const res = await ai.models.generateContent({
    model: modelId,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: contentType,
              data: imageBytes.toString("base64"),
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      abortSignal: signal,
    },
  });
  const text = res.text ?? "";
  return { text, usage: res.usageMetadata };
};

/**
 * Run up to 2 OCR attempts for the passport bio-page image. Succeeds as soon
 * as required fields are present; otherwise falls through to attempt 2 or
 * ends in `needs_manual` / `failed` per spec §6.2.
 */
export async function extractPassport(
  input: ExtractPassportInput,
): Promise<ExtractPassportResult> {
  const modelId = resolveGeminiModelId();
  const promptVersion = resolvePromptVersion();
  const call = input.callModel ?? defaultCallModel;
  const budgetMs = input.overallTimeoutMs ?? 25_000;
  const deadline = Date.now() + budgetMs;
  const attempts: OcrAttemptOutcome[] = [];

  for (const attempt of [1, 2] as const) {
    const remaining = deadline - Date.now();
    if (remaining <= 500) {
      attempts.push({
        attempt,
        status: "failed",
        result: null,
        rawText: null,
        errorCode: "OCR_TIMEOUT_BUDGET",
        errorMessage: "Overall OCR budget exhausted.",
        missingFields: [...listMissingOcrFields(null)],
        latencyMs: 0,
        usage: null,
      });
      break;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(500, remaining));
    const startedAt = Date.now();
    let rawText = "";
    let usage: unknown = null;
    try {
      const out = await call({
        modelId,
        prompt: PASSPORT_PROMPT,
        imageBytes: input.imageBytes,
        contentType: input.contentType,
        signal: controller.signal,
      });
      rawText = out.text ?? "";
      usage = out.usage ?? null;
    } catch (err) {
      attempts.push({
        attempt,
        status: "failed",
        result: null,
        rawText: rawText || null,
        errorCode:
          (err as { name?: string } | null)?.name === "AbortError"
            ? "OCR_ATTEMPT_TIMEOUT"
            : "OCR_PROVIDER_ERROR",
        errorMessage: err instanceof Error ? err.message : "Unknown provider error",
        missingFields: [...listMissingOcrFields(null)],
        latencyMs: Date.now() - startedAt,
        usage: null,
      });
      clearTimeout(timer);
      continue;
    }
    clearTimeout(timer);

    const parsed = tryParseOcrJson(rawText);
    const latencyMs = Date.now() - startedAt;
    if (!parsed.ok) {
      attempts.push({
        attempt,
        status: "failed",
        result: null,
        rawText,
        errorCode: parsed.errorCode,
        errorMessage: parsed.errorMessage,
        missingFields: [...listMissingOcrFields(null)],
        latencyMs,
        usage,
      });
      continue;
    }
    const missingFields = listMissingOcrFields(parsed.result);
    if (missingFields.length === 0) {
      attempts.push({
        attempt,
        status: "succeeded",
        result: parsed.result,
        rawText,
        errorCode: null,
        errorMessage: null,
        missingFields: [],
        latencyMs,
        usage,
      });
      return {
        status: "succeeded",
        attempts,
        finalResult: parsed.result,
        missingFields: [],
        provider: "gemini",
        model: modelId,
        promptVersion,
      };
    }
    // Parseable JSON but missing required fields: record as failed attempt
    // (forces a retry on attempt 1). Spec §6.2.
    attempts.push({
      attempt,
      status: "failed",
      result: parsed.result,
      rawText,
      errorCode: "OCR_MISSING_REQUIRED_FIELDS",
      errorMessage: `Missing: ${missingFields.join(",")}`,
      missingFields,
      latencyMs,
      usage,
    });
  }

  const lastValid = [...attempts].reverse().find((a) => a.result !== null);
  const finalResult = lastValid?.result ?? null;
  const missingFields = listMissingOcrFields(finalResult);

  const anySchemaValid = attempts.some((a) => a.result !== null);
  const status: ExtractPassportResult["status"] =
    missingFields.length === 0 && finalResult
      ? "succeeded"
      : anySchemaValid
        ? "needs_manual"
        : "failed";

  return {
    status,
    attempts,
    finalResult,
    missingFields,
    provider: "gemini",
    model: modelId,
    promptVersion,
  };
}
