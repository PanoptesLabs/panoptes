-- CreateIndex
CREATE INDEX "Anomaly_type_entityId_resolved_idx" ON "Anomaly"("type", "entityId", "resolved");

-- CreateIndex
CREATE INDEX "Forecast_entityType_entityId_validUntil_idx" ON "Forecast"("entityType", "entityId", "validUntil");
