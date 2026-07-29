// Seeds the throwaway test DB for the Playwright e2e run -- reuses the exact same
// resetDb/seedProblems helpers the Backend integration tests already rely on, rather
// than re-deriving DB setup logic in the e2e project. Run as a plain node script (not
// through vitest) from e2e/global-setup.js.
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { prisma, resetDb, seedProblems } from './dbHelpers.js';

export const E2E_EMAIL = 'e2e@example.com';
export const E2E_PASSWORD = 'E2ePass123!';

async function main() {
  await resetDb();
  await seedProblems(prisma, 5, { difficulty: 'Easy', finalTags: ['Array'] });
  await prisma.user.create({
    data: {
      id: randomUUID(),
      email: E2E_EMAIL,
      password: await bcrypt.hash(E2E_PASSWORD, 10),
      name: 'E2E Test User',
      emailVerified: true
    }
  });
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('e2e seed failed:', err);
  process.exit(1);
});
