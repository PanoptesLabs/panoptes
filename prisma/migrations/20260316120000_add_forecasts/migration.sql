-- CreateTable
CREATE TABLE "Forecast" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "prediction" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timeHorizon" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "predictedValue" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION,
    "reasoning" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Forecast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Forecast_entityType_entityId_idx" ON "Forecast"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Forecast_metric_idx" ON "Forecast"("metric");

-- CreateIndex
CREATE INDEX "Forecast_validUntil_idx" ON "Forecast"("validUntil");

-- CreateIndex
CREATE INDEX "Forecast_createdAt_idx" ON "Forecast"("createdAt");
