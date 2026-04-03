import { logger } from "@/lib/logger";

interface PaginateOptions {
  maxPages?: number;
  timeoutMs?: number;
  label?: string;
}

const DEFAULT_MAX_PAGES = 50;
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 2_000;
const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("connect timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("the operation was aborted") ||
    err.name === "AbortError"
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchPaginated<T>(
  buildUrl: (nextKey: string | null) => string,
  extractItems: (data: Record<string, unknown>) => T[],
  options?: PaginateOptions,
): Promise<T[]> {
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const label = options?.label ?? "paginate";

  const all: T[] = [];
  let nextKey: string | null = null;
  let prevKey: string | null = null;
  let page = 0;

  do {
    if (page >= maxPages) {
      logger.warn(label, `Reached max page limit (${maxPages}), stopping pagination`);
      break;
    }

    const url = buildUrl(nextKey);
    let success = false;

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

        if (TRANSIENT_STATUS.has(res.status)) {
          if (attempt < RETRY_ATTEMPTS) {
            const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
            logger.warn(label, `Attempt ${attempt}/${RETRY_ATTEMPTS}: HTTP ${res.status}, retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }
          logger.error(label, `Fetch failed after ${RETRY_ATTEMPTS} attempts: ${res.status} ${res.statusText}`);
          break;
        }

        if (!res.ok) {
          logger.error(label, `Fetch failed: ${res.status} ${res.statusText}`);
          break;
        }

        const data = (await res.json()) as Record<string, unknown>;
        all.push(...extractItems(data));
        const pagination = data.pagination as { next_key?: string } | undefined;
        nextKey = pagination?.next_key ?? null;
        success = true;
        break;
      } catch (error) {
        if (attempt < RETRY_ATTEMPTS && isTransientError(error)) {
          const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
          logger.warn(label, `Attempt ${attempt}/${RETRY_ATTEMPTS} failed, retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        logger.error(label, error);
        break;
      }
    }

    if (!success) break;

    // Guard against stuck cursor
    if (nextKey && nextKey === prevKey) {
      logger.warn(label, `Pagination cursor stuck at "${nextKey}", stopping`);
      break;
    }
    prevKey = nextKey;
    page++;
  } while (nextKey);

  return all;
}
