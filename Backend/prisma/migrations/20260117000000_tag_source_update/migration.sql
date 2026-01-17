-- Align TagSource enum with new rule/pending/ai semantics
CREATE TYPE "TagSource_new" AS ENUM ('rule', 'ai', 'pending');

ALTER TABLE "Problem"
ALTER COLUMN "tagSource" TYPE "TagSource_new"
USING (
  CASE "tagSource"
    WHEN 'leetcode' THEN 'rule'
    WHEN 'ai' THEN 'ai'
    WHEN 'merged' THEN 'ai'
    ELSE 'pending'
  END
)::"TagSource_new";

DROP TYPE "TagSource";
ALTER TYPE "TagSource_new" RENAME TO "TagSource";
