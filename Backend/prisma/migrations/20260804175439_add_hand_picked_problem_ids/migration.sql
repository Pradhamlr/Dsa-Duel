-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "handPickedProblemIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
