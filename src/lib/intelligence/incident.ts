import { prisma } from "@/lib/db";
import { INCIDENT_DEFAULTS } from "@/lib/constants";
import { CHANNELS } from "@/lib/events/event-types";

export interface CorrelationResult {
  created: number;
  linked: number;
  resolved: number;
  duration: number;
}

function computeSeverity(currentValue: number | null, target: number): string {
  const sliRatio = (currentValue ?? 0) / target;
  if (sliRatio < 0.95) return "critical";
  if (sliRatio < 0.98) return "high";
  return "medium";
}

async function findOrCreateIncident(
  workspaceId: string,
  entityType: string,
  entityId: string,
  severity: string,
  title: string,
  description: string,
  linkType: "slo_linked" | "anomaly_linked",
  linkMessage: string,
  counters: { created: number; linked: number },
): Promise<void> {
  const correlationCutoff = new Date(
    Date.now() - INCIDENT_DEFAULTS.CORRELATION_WINDOW_HOURS * 3600_000,
  );

  const existing = await prisma.incident.findFirst({
    where: {
      workspaceId,
      entityType,
      entityId,
      status: { in: ["open", "acknowledged"] },
      detectedAt: { gte: correlationCutoff },
    },
    orderBy: { detectedAt: "desc" },
  });

  if (existing) {
    await prisma.incidentEvent.create({
      data: {
        incidentId: existing.id,
        eventType: linkType,
        message: linkMessage,
      },
    });
    counters.linked++;
    return;
  }

  await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.create({
      data: {
        workspaceId,
        entityType,
        entityId,
        severity,
        title,
        description,
      },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: incident.id,
        eventType: "created",
        message: title,
      },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: incident.id,
        eventType: linkType,
        message: linkMessage,
      },
    });

    await tx.outboxEvent.create({
      data: {
        channel: CHANNELS.INCIDENT,
        type: "incident.created",
        visibility: "workspace",
        workspaceId,
        payload: JSON.stringify({
          incidentId: incident.id,
          entityType,
          entityId,
          severity,
          title,
        }),
      },
    });
  });

  counters.created++;
}

export async function correlateIncidents(): Promise<CorrelationResult> {
  const start = Date.now();
  const counters = { created: 0, linked: 0, resolved: 0 };

  const recentCutoff = new Date(Date.now() - 15 * 60_000);

  // Step 1: SLO breach → incident
  const breachingSlos = await prisma.slo.findMany({
    where: {
      isActive: true,
      isBreaching: true,
      lastEvaluatedAt: { gte: recentCutoff },
    },
  });

  for (const slo of breachingSlos) {
    const severity = computeSeverity(slo.currentValue, slo.target);
    await findOrCreateIncident(
      slo.workspaceId,
      slo.entityType,
      slo.entityId,
      severity,
      `SLO breach: ${slo.name}`,
      `SLO "${slo.name}" (${slo.indicator}) is breaching — current: ${slo.currentValue?.toFixed(4) ?? "N/A"}, target: ${slo.target}`,
      "slo_linked",
      `SLO "${slo.name}" breach detected (value: ${slo.currentValue?.toFixed(4) ?? "N/A"}, target: ${slo.target})`,
      counters,
    );
  }

  // Step 2: Anomaly → incident (only for entities with workspace SLOs)
  const unresolvedAnomalies = await prisma.anomaly.findMany({
    where: {
      resolved: false,
      detectedAt: { gte: recentCutoff },
      entityId: { not: null },
    },
  });

  // Bulk lookup: all active SLOs for anomaly entities
  const anomalyEntityIds = [...new Set(
    unresolvedAnomalies
      .filter((a) => a.entityId !== null)
      .map((a) => a.entityId as string),
  )];

  const allWorkspaceSlos = anomalyEntityIds.length > 0
    ? await prisma.slo.findMany({
        where: {
          isActive: true,
          entityId: { in: anomalyEntityIds },
        },
        select: { workspaceId: true, entityType: true, entityId: true },
        distinct: ["workspaceId", "entityId"],
      })
    : [];

  const entitySloMap = new Map<string, Array<{ workspaceId: string; entityType: string }>>();
  for (const slo of allWorkspaceSlos) {
    const existing = entitySloMap.get(slo.entityId) ?? [];
    existing.push({ workspaceId: slo.workspaceId, entityType: slo.entityType });
    entitySloMap.set(slo.entityId, existing);
  }

  for (const anomaly of unresolvedAnomalies) {
    if (!anomaly.entityId) continue;

    const workspaceSlos = entitySloMap.get(anomaly.entityId) ?? [];

    for (const slo of workspaceSlos) {
      await findOrCreateIncident(
        slo.workspaceId,
        slo.entityType,
        anomaly.entityId,
        anomaly.severity,
        `Anomaly: ${anomaly.title}`,
        anomaly.description,
        "anomaly_linked",
        `Anomaly "${anomaly.title}" (${anomaly.type}) linked`,
        counters,
      );
    }
  }

  // Step 3: Auto-resolve
  const recoveredSlos = await prisma.slo.findMany({
    where: {
      isActive: true,
      isBreaching: false,
      lastEvaluatedAt: { gte: recentCutoff },
    },
  });

  const entityWorkspaceMap = new Map<string, Set<string>>();
  for (const slo of recoveredSlos) {
    const key = `${slo.workspaceId}:${slo.entityType}:${slo.entityId}`;
    if (!entityWorkspaceMap.has(key)) {
      entityWorkspaceMap.set(key, new Set());
    }
  }

  const entityKeys = [...entityWorkspaceMap.keys()];

  // Parallel: check all entity keys at once
  const entityCheckResults = await Promise.all(
    entityKeys.map(async (key) => {
      const [workspaceId, entityType, entityId] = key.split(":");

      const [stillBreaching, unresolvedEntityAnomalies] = await Promise.all([
        prisma.slo.count({
          where: {
            workspaceId,
            entityType,
            entityId,
            isActive: true,
            isBreaching: true,
          },
        }),
        prisma.anomaly.count({
          where: {
            entityId,
            resolved: false,
          },
        }),
      ]);

      if (stillBreaching > 0 || unresolvedEntityAnomalies > 0) return null;

      const openIncidents = await prisma.incident.findMany({
        where: {
          workspaceId,
          entityType,
          entityId,
          status: { in: ["open", "acknowledged"] },
        },
      });

      return { workspaceId, entityType, entityId, openIncidents };
    }),
  );

  // Batch resolve all incidents in a single transaction
  const incidentsToResolve = entityCheckResults
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .flatMap((r) => r.openIncidents.map((inc) => ({
      incident: inc,
      workspaceId: r.workspaceId,
      entityType: r.entityType,
      entityId: r.entityId,
    })));

  if (incidentsToResolve.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const { incident, workspaceId, entityType, entityId } of incidentsToResolve) {
        await tx.incident.update({
          where: { id: incident.id },
          data: { status: "resolved", resolvedAt: new Date() },
        });

        await tx.incidentEvent.create({
          data: {
            incidentId: incident.id,
            eventType: "resolved",
            message: "All SLOs recovered — incident auto-resolved",
            metadata: JSON.stringify({ autoResolved: true }),
          },
        });

        await tx.outboxEvent.create({
          data: {
            channel: CHANNELS.INCIDENT,
            type: "incident.resolved",
            visibility: "workspace",
            workspaceId,
            payload: JSON.stringify({
              incidentId: incident.id,
              entityType,
              entityId,
              autoResolved: true,
            }),
          },
        });
      }
    });

    counters.resolved += incidentsToResolve.length;
  }

  return {
    created: counters.created,
    linked: counters.linked,
    resolved: counters.resolved,
    duration: Date.now() - start,
  };
}
