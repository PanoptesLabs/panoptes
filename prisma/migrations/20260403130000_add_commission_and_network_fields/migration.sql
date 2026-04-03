-- AlterTable: Validator commission fields
ALTER TABLE "Validator" ADD COLUMN "commissionRewards" TEXT NOT NULL DEFAULT '0';
ALTER TABLE "Validator" ADD COLUMN "outstandingRewards" TEXT NOT NULL DEFAULT '0';

-- AlterTable: NetworkStats enrichment
ALTER TABLE "NetworkStats" ADD COLUMN "inflation" DOUBLE PRECISION;
ALTER TABLE "NetworkStats" ADD COLUMN "totalSupply" TEXT;
ALTER TABLE "NetworkStats" ADD COLUMN "bondedTokens" TEXT;
ALTER TABLE "NetworkStats" ADD COLUMN "notBondedTokens" TEXT;
ALTER TABLE "NetworkStats" ADD COLUMN "stakingAPR" DOUBLE PRECISION;
ALTER TABLE "NetworkStats" ADD COLUMN "nakamotoCoefficient" INTEGER;
ALTER TABLE "NetworkStats" ADD COLUMN "networkHealthScore" DOUBLE PRECISION;
