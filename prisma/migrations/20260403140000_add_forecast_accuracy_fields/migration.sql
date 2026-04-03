-- AlterTable
ALTER TABLE "Forecast" ADD COLUMN "actualValue" DOUBLE PRECISION;
ALTER TABLE "Forecast" ADD COLUMN "wasAccurate" BOOLEAN;
ALTER TABLE "Forecast" ADD COLUMN "verifiedAt" TIMESTAMP(3);
