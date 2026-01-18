// src/jobs/aiRetryJob.js
import { withPrisma } from "../utils/database.js";
import { classifyProblem } from "../services/aiTagger.js";

export async function retryPendingAITags() {
  await withPrisma(async (prisma) => {
    const pending = await prisma.problem.findMany({
      where: { aiStatus: "pending" },
      take: 5   // don’t overload HF
    });

    for (const p of pending) {
      try {
        const aiTags = await classifyProblem(p);

        // If AI abstained (returned "Other"), keep as pending for future retry
        if (aiTags.includes("Other")) {
          console.log(`AI abstained for: ${p.title} - keeping as pending`);
          await prisma.problem.update({
            where: { id: p.id },
            data: {
              aiStatus: "pending"
            }
          });
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

        console.log(`AI tagging completed for: ${p.title} - tags: ${aiTags.join(", ")}`);
      } catch (e) {
        console.log(`AI retry failed for ${p.title}: ${e.message}`);
      }
    }
  });
}
