import { prisma } from "@/lib/db";
import { IndexerError } from "@/lib/errors";
import { HEALTH_THRESHOLDS } from "@/lib/constants";

interface HealthCheckResult {
  endpointId: string;
  latencyMs: number;
  statusCode: number;
  isHealthy: boolean;
  blockHeight: bigint | null;
  error: string | null;
}

interface EndpointCheckConfig {
  buildRequest: (url: string) => { url: string; init?: RequestInit };
  parseBlockHeight: (data: unknown) => bigint | null;
}

const ENDPOINT_CONFIGS: Record<string, EndpointCheckConfig> = {
  rpc: {
    buildRequest: (url) => ({
      url,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "status", params: [], id: 1 }),
      },
    }),
    parseBlockHeight: (data) => {
      const height = (data as { result?: { sync_info?: { latest_block_height?: string } } })
        ?.result?.sync_info?.latest_block_height;
      return height ? BigInt(height) : null;
    },
  },
  rest: {
    buildRequest: (url) => ({
      url: `${url}/cosmos/base/tendermint/v1beta1/blocks/latest`,
    }),
    parseBlockHeight: (data) => {
      const height = (data as { block?: { header?: { height?: string } } })
        ?.block?.header?.height;
      return height ? BigInt(height) : null;
    },
  },
  "evm-rpc": {
    buildRequest: (url) => ({
      url,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      },
    }),
    parseBlockHeight: (data) => {
      const result = (data as { result?: string })?.result;
      return result ? BigInt(result) : null;
    },
  },
};

async function checkEndpointHealth(
  url: string,
  config: EndpointCheckConfig,
): Promise<Omit<HealthCheckResult, "endpointId">> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      HEALTH_THRESHOLDS.ENDPOINT_TIMEOUT_MS,
    );

    const req = config.buildRequest(url);
    const res = await fetch(req.url, { ...req.init, signal: controller.signal });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;
    let blockHeight: bigint | null = null;

    if (res.ok) {
      try {
        blockHeight = config.parseBlockHeight(await res.json());
      } catch {
        // JSON parse failed, still count as reachable
      }
    }

    return {
      latencyMs,
      statusCode: res.status,
      isHealthy: res.ok && latencyMs < HEALTH_THRESHOLDS.LATENCY_HEALTHY_MS,
      blockHeight,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      latencyMs: Date.now() - start,
      statusCode: 0,
      isHealthy: false,
      blockHeight: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getChecker(
  type: string,
): (url: string) => Promise<Omit<HealthCheckResult, "endpointId">> {
  const config = ENDPOINT_CONFIGS[type] ?? ENDPOINT_CONFIGS.rpc;
  return (url) => checkEndpointHealth(url, config);
}

export async function checkEndpoints(): Promise<{
  checked: number;
  healthy: number;
  unhealthy: number;
  duration: number;
}> {
  const start = Date.now();

  try {
    const endpoints = await prisma.endpoint.findMany({
      where: { isActive: true },
    });

    const results = await Promise.allSettled(
      endpoints.map(async (ep) => {
        const checker = getChecker(ep.type);
        const result = await checker(ep.url);
        return { endpointId: ep.id, ...result };
      }),
    );

    const healthRecords: HealthCheckResult[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        healthRecords.push(result.value);
      }
    }

    if (healthRecords.length > 0) {
      await prisma.endpointHealth.createMany({
        data: healthRecords.map((r) => ({
          endpointId: r.endpointId,
          latencyMs: r.latencyMs,
          statusCode: r.statusCode,
          isHealthy: r.isHealthy,
          blockHeight: r.blockHeight,
          error: r.error,
        })),
      });
    }

    const healthy = healthRecords.filter((r) => r.isHealthy).length;

    return {
      checked: endpoints.length,
      healthy,
      unhealthy: endpoints.length - healthy,
      duration: Date.now() - start,
    };
  } catch (error) {
    throw new IndexerError(
      `Failed to check endpoints: ${error instanceof Error ? error.message : String(error)}`,
      "endpoints",
    );
  }
}
