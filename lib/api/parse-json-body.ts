import type { z } from "zod";
import { jsonError } from "./response";

export type ParseJsonBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

/**
 * Read JSON and validate with Zod. Malformed JSON vs schema failures use distinct messages.
 */
export async function parseJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>,
  requestId: string | null,
): Promise<ParseJsonBodyResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: jsonError("VALIDATION_ERROR", "Malformed JSON body", {
        status: 400,
        requestId,
      }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      response: jsonError("VALIDATION_ERROR", "Request body failed validation", {
        status: 400,
        requestId,
        details: {
          fieldErrors: flat.fieldErrors,
          formErrors: flat.formErrors,
        },
      }),
    };
  }

  return { ok: true, data: parsed.data };
}
