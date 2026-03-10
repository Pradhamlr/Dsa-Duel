/*
  Warnings:

  - The values [rule,pending] on the enum `TagSource` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TagSource_new" AS ENUM ('leetcode', 'ai', 'merged');
ALTER TABLE "Problem" ALTER COLUMN "tagSource" TYPE "TagSource_new" USING ("tagSource"::text::"TagSource_new");
ALTER TYPE "TagSource" RENAME TO "TagSource_old";
ALTER TYPE "TagSource_new" RENAME TO "TagSource";
DROP TYPE "TagSource_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
