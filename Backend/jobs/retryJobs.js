// src/jobs/aiRetryJob.js
import { withPrisma } from "../utils/database.js";
import { classifyProblem } from "../services/aiTagger.js";

export async function retryPendingAITags() {
  await withPrisma(async (prisma) => {
    const pending = await prisma.problem.findMany({
      where: {
        aiStatus: "pending",
        aiRetryCount: { lt: 2 }  // max 2 attempts
      },
      orderBy: {
        lastAiTriedAt: "asc"     // oldest tried first (null first)
      },
      take: 5   // small batch
    });

    if (pending.length === 0) {
      console.log("No pending problems to retry (all exhausted or completed)");
      return;
    }

    console.log(`Retrying ${pending.length} pending problems...`);

    for (const p of pending) {
      try {
        // Mark attempt BEFORE calling AI
        await prisma.problem.update({
          where: { id: p.id },
          data: {
            lastAiTriedAt: new Date(),
            aiRetryCount: { increment: 1 }
          }
        });

        const currentRetryCount = p.aiRetryCount + 1;
        console.log(`Attempting AI classification for "${p.title}" (attempt ${currentRetryCount}/2)`);

        const aiTags = await classifyProblem(p);

        // If AI abstained (returned "Other"), check if we should give up
        if (aiTags.includes("Other")) {
          if (currentRetryCount >= 2) {
            // Give up after 2 attempts - mark as failed
            console.log(`AI failed to classify "${p.title}" after 2 attempts - marking as failed`);
            await prisma.problem.update({
              where: { id: p.id },
              data: {
                aiStatus: "failed"
              }
            });
          } else {
            console.log(`AI abstained for "${p.title}" - keeping as pending (${currentRetryCount}/2 attempts)`);
          }
          continue;
        }

        // AI succeeded with confident prediction
        await prisma.problem.update({
          where: { id: p.id },
          data: {
            aiTags,
            finalTags: aiTags,
            tagSource: "ai",
            aiStatus: "completed"
          }
        });

        console.log(`AI tagging completed for "${p.title}" - tags: ${aiTags.join(", ")}`);
      } catch (e) {
        console.log(`AI retry failed for "${p.title}": ${e.message}`);
      }
    }
  });
}
