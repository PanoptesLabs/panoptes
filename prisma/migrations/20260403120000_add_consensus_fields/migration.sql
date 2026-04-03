-- AlterTable
ALTER TABLE "Validator" ADD COLUMN "consensusPubkey" TEXT;
ALTER TABLE "Validator" ADD COLUMN "consensusAddress" TEXT;

-- CreateIndex
CREATE INDEX "Validator_consensusAddress_idx" ON "Validator"("consensusAddress");
