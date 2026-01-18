-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "aiRetryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAiTriedAt" TIMESTAMP(3);
