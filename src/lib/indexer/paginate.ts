import { logger } from "@/lib/logger";

interface PaginateOptions {
  maxPages?: number;
  timeoutMs?: number;
  label?: string;
}

const DEFAULT_MAX_PAGES = 50;

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
  let page = 0;

  do {
    if (page >= maxPages) {
      logger.warn(label, `Reached max page limit (${maxPages}), stopping pagination`);
      break;
    }

    const url = buildUrl(nextKey);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        logger.error(label, `Fetch failed: ${res.status} ${res.statusText}`);
        break;
      }
      const data = (await res.json()) as Record<string, unknown>;
      all.push(...extractItems(data));
      const pagination = data.pagination as { next_key?: string } | undefined;
      nextKey = pagination?.next_key ?? null;
    } catch (error) {
      logger.error(label, error);
      break;
    }

    page++;
  } while (nextKey);

  return all;
}
