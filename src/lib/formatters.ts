const ARAI_DECIMALS = 18n;
const ARAI_DIVISOR = 10n ** ARAI_DECIMALS;

function safeBigInt(value: string): bigint | null {
  if (!value || value === "0") return 0n;
  try {
    return BigInt(value.trim());
  } catch {
    return null;
  }
}

export function formatTokens(araiString: string): string {
  const big = safeBigInt(araiString);
  if (big === null) return "-- RAI";
  if (big === 0n) return "0 RAI";
  const whole = big / ARAI_DIVISOR;
  const frac = big % ARAI_DIVISOR;
  const wholeStr = whole.toLocaleString("en-US");
  if (frac === 0n) return `${wholeStr} RAI`;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 2);
  return `${wholeStr}.${fracStr} RAI`;
}

export function formatTokensShort(araiString: string): string {
  const big = safeBigInt(araiString);
  if (big === null) return "-- RAI";
  if (big === 0n) return "0 RAI";
  const whole = big / ARAI_DIVISOR;
  const num = Number(whole);
  if (!Number.isFinite(num)) return ">999T RAI";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B RAI`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M RAI`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K RAI`;
  if (num === 0) {
    const frac = big % ARAI_DIVISOR;
    if (frac === 0n) return "0 RAI";
    const fracStr = frac.toString().padStart(18, "0").slice(0, 2);
    return `0.${fracStr} RAI`;
  }
  return `${num.toLocaleString("en-US")} RAI`;
}

export function tokensToNumber(araiString: string): number {
  const big = safeBigInt(araiString);
  if (big === null || big === 0n) return 0;
  const whole = big / ARAI_DIVISOR;
  const frac = big % ARAI_DIVISOR;
  return Number(whole) + Number(frac) / Number(ARAI_DIVISOR);
}

export function formatCommission(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatBlockHeight(height: string): string {
  return Number(height).toLocaleString("en-US");
}

export function formatUptime(uptime: number): string {
  return `${uptime.toFixed(1)}%`;
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null || ratio === undefined) return "--";
  return `${(ratio * 100).toFixed(1)}%`;
}

export function truncateAddress(
  addr: string,
  start: number = 10,
  end: number = 6
): string {
  if (!addr) return "";
  if (addr.length <= start + end + 3) return addr;
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

export function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}
