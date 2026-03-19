-- AlterTable: make adminTokenHash optional and drop unique constraint
ALTER TABLE "Workspace" ALTER COLUMN "adminTokenHash" DROP NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "Workspace_adminTokenHash_key";
