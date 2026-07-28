-- CreateEnum
CREATE TYPE "SolvedProblemStatus" AS ENUM ('attempted', 'solved');

-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "pools" TEXT[];

-- CreateTable
CREATE TABLE "SolvedProblem" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "status" "SolvedProblemStatus" NOT NULL,
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolvedProblem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolvedProblem_userId_status_idx" ON "SolvedProblem"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SolvedProblem_userId_problemId_key" ON "SolvedProblem"("userId", "problemId");

-- AddForeignKey
ALTER TABLE "SolvedProblem" ADD CONSTRAINT "SolvedProblem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvedProblem" ADD CONSTRAINT "SolvedProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
