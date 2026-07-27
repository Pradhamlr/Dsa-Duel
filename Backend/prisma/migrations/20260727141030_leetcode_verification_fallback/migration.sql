-- CreateEnum
CREATE TYPE "VerificationSource" AS ENUM ('manual', 'leetcode');

-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "verifiedVia" "VerificationSource" NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "leetcodeUsername" TEXT;
