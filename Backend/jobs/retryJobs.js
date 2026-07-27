import { withPrisma } from "../utils/database.js";
import { fetchQuestionContent } from "../utils/leetcode.js";
import { classifyProblem } from "../services/aiTagger.js";

const MAX_RETRIES = 3;

// Problems only land here when the LLM fallback call itself threw (network/timeout/
// rate-limit/parse error) -- a real answer, including a confident "Other", is stored
// as aiStatus "completed" at ingestion time and never reaches this job. So retrying
// here means "try the same call again because infra failed," not "hope the model
// changes its mind."
export async function retryPendingAITags() {
  await withPrisma(async (prisma) => {
    const pending = await prisma.problem.findMany({
      where: {
        aiStatus: "pending",
        aiRetryCount: { lt: MAX_RETRIES }
      },
      orderBy: {
        lastAiTriedAt: "asc"
      },
      take: 5
    });

    if (pending.length === 0) {
      return;
    }

    console.log(`Retrying AI classification for ${pending.length} problem(s)...`);

    for (const p of pending) {
      try {
        await prisma.problem.update({
          where: { id: p.id },
          data: {
            lastAiTriedAt: new Date(),
            aiRetryCount: { increment: 1 }
          }
        });

        const currentRetryCount = p.aiRetryCount + 1;
        console.log(`Retrying "${p.title}" (attempt ${currentRetryCount}/${MAX_RETRIES})`);

        const description = await fetchQuestionContent(p.leetcodeId);
        const aiTags = await classifyProblem({
          title: p.title,
          description,
          leetcodeTags: p.leetcodeTags
        });

        // Success -- resolved, whether the answer is a real bucket or a confident "Other".
        await prisma.problem.update({
          where: { id: p.id },
          data: {
            aiTags,
            finalTags: aiTags,
            tagSource: "ai",
            aiStatus: "completed"
          }
        });

        console.log(`Resolved "${p.title}" -> ${aiTags.join(", ")}`);
      } catch (e) {
        const exhausted = (p.aiRetryCount + 1) >= MAX_RETRIES;
        if (exhausted) {
          console.log(`Giving up on "${p.title}" after ${MAX_RETRIES} failed attempts: ${e.message}`);
          await prisma.problem.update({
            where: { id: p.id },
            data: { aiStatus: "failed" }
          });
        } else {
          console.log(`Retry failed for "${p.title}": ${e.message}`);
        }
      }
    }
  });
}
