-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "pool" TEXT,
ADD COLUMN     "selectedTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "problems" DROP NOT NULL;
