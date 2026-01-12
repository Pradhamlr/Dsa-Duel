-- CreateEnum
CREATE TYPE "TagSource" AS ENUM ('leetcode', 'ai', 'merged');

-- CreateEnum
CREATE TYPE "AIStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "leetcodeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "leetcodeUrl" TEXT NOT NULL,
    "leetcodeTags" TEXT[],
    "aiTags" TEXT[],
    "finalTags" TEXT[],
    "tagSource" "TagSource" NOT NULL,
    "aiStatus" "AIStatus" NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Problem_leetcodeId_key" ON "Problem"("leetcodeId");

-- CreateIndex
CREATE INDEX "Problem_difficulty_idx" ON "Problem"("difficulty");

-- CreateIndex
CREATE INDEX "Problem_finalTags_idx" ON "Problem"("finalTags");
