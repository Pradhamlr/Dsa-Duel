-- CreateEnum
CREATE TYPE "SubmissionLanguage" AS ENUM ('java', 'cpp');

-- CreateEnum
CREATE TYPE "SubmissionVerdict" AS ENUM ('accepted', 'wrong_answer', 'compile_error', 'runtime_error', 'time_limit_exceeded', 'pending');

-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "codeSnippets" JSONB,
ADD COLUMN     "functionSignature" JSONB,
ADD COLUMN     "judgeSupported" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testCases" JSONB;

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemIndex" INTEGER NOT NULL,
    "language" "SubmissionLanguage" NOT NULL,
    "code" TEXT NOT NULL,
    "verdict" "SubmissionVerdict" NOT NULL DEFAULT 'pending',
    "testResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Submission_contestId_userId_problemIndex_idx" ON "Submission"("contestId", "userId", "problemIndex");

-- CreateIndex
CREATE INDEX "Problem_judgeSupported_idx" ON "Problem"("judgeSupported");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
