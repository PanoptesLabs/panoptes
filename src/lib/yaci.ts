import { YACI_EXPLORER } from "@/lib/constants";
import { logger } from "@/lib/logger";

const TIMEOUT_MS = 12_000;

export type YaciResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "timeout" | "network" | "http" | "parse" };

/**
 * Fetch JSON from the Yaci Explorer API.
 * Returns a discriminated union so callers can distinguish
 * upstream errors from genuinely empty data.
 */
export async function fetchYaci<T>(path: string, options?: { signal?: AbortSignal }): Promise<YaciResult<T>> {
  try {
    const res = await fetch(`${YACI_EXPLORER.baseUrl}${path}`, {
      signal: options?.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn("yaci", `HTTP ${res.status} for ${path}`);
      return { ok: false, error: "http" };
    }
    let data: T;
    try {
      data = (await res.json()) as T;
    } catch {
      logger.warn("yaci", `JSON parse error for ${path}`);
      return { ok: false, error: "parse" };
    }
    return { ok: true, data };
  } catch (err) {
    // AbortSignal.timeout() throws TimeoutError in Node ≥18, AbortError in browsers/older Node
    const isTimeout =
      err instanceof DOMException &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    logger.warn("yaci", `${isTimeout ? "Timeout" : "Network error"} for ${path}`);
    return { ok: false, error: isTimeout ? "timeout" : "network" };
  }
}

/** Map execution_image to a short display name. */
export function parseModelName(image: string): string {
  // "republicai/gpt2-inference:latest" → "GPT-2"
  const base = image.split("/").pop()?.split(":")[0] ?? image;
  const MODEL_MAP: Record<string, string> = {
    "gpt2-inference": "GPT-2",
    "llama2-inference": "LLaMA 2",
    "mistral-inference": "Mistral",
    "stable-diffusion": "Stable Diffusion",
    "whisper-inference": "Whisper",
    "bert-inference": "BERT",
    "republic-llm-inference": "Republic LLM",
  };
  return MODEL_MAP[base] ?? base.replace(/-inference$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
