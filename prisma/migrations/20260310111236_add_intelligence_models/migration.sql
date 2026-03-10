-- CreateTable
CREATE TABLE "EndpointScore" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "uptime" DOUBLE PRECISION NOT NULL,
    "latency" DOUBLE PRECISION NOT NULL,
    "freshness" DOUBLE PRECISION NOT NULL,
    "errorRate" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EndpointScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidatorScore" (
    "id" TEXT NOT NULL,
    "validatorId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "missedBlockRate" DOUBLE PRECISION NOT NULL,
    "jailPenalty" DOUBLE PRECISION NOT NULL,
    "stakeStability" DOUBLE PRECISION NOT NULL,
    "commissionScore" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidatorScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anomaly" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EndpointScore_endpointId_timestamp_idx" ON "EndpointScore"("endpointId", "timestamp");

-- CreateIndex
CREATE INDEX "EndpointScore_timestamp_idx" ON "EndpointScore"("timestamp");

-- CreateIndex
CREATE INDEX "ValidatorScore_validatorId_timestamp_idx" ON "ValidatorScore"("validatorId", "timestamp");

-- CreateIndex
CREATE INDEX "ValidatorScore_timestamp_idx" ON "ValidatorScore"("timestamp");

-- CreateIndex
CREATE INDEX "Anomaly_type_idx" ON "Anomaly"("type");

-- CreateIndex
CREATE INDEX "Anomaly_severity_idx" ON "Anomaly"("severity");

-- CreateIndex
CREATE INDEX "Anomaly_detectedAt_idx" ON "Anomaly"("detectedAt");

-- CreateIndex
CREATE INDEX "Anomaly_resolved_idx" ON "Anomaly"("resolved");

-- AddForeignKey
ALTER TABLE "EndpointScore" ADD CONSTRAINT "EndpointScore_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidatorScore" ADD CONSTRAINT "ValidatorScore_validatorId_fkey" FOREIGN KEY ("validatorId") REFERENCES "Validator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
