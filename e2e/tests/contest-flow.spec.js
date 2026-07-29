import { test, expect } from '@playwright/test';

const EMAIL = 'e2e@example.com';
const PASSWORD = 'E2ePass123!';

test('login, create a contest, start it, and see real problems appear', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'LOGIN' }).click();

  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Landing on Home confirms the login round-trip actually worked (real bcrypt
  // password check + real JWT issued + client stored it), not just that the click fired.
  await expect(page).toHaveURL('/');
  await expect(page.getByText('Choose Your Challenge')).toBeVisible();

  // Step 1 (Problem Count) -> 2 (Difficulty) -> 3 (Topics) -> 4 (Duration/Review),
  // deliberately leaving every setting at its default (5 problems, Mixed difficulty, no
  // topic/pool filter) -- the seeded 5 Easy problems satisfy that combination without
  // needing to interact with any pill/selector.
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await page.getByRole('button', { name: 'CREATE CONTEST' }).click();

  // Real navigation to a real contestId minted by the backend, not a stub route.
  await expect(page).toHaveURL(/\/contest\/.+/);
  await expect(page.getByText('Problems will be revealed when the contest starts')).toBeVisible();

  await page.getByRole('button', { name: 'Start Contest' }).click();

  // Confirms the full round trip: Start -> deferred problem selection ran server-side
  // -> broadcast over the real SSE connection -> React re-rendered with the real
  // seeded problem titles, with no manual reload.
  await expect(page.getByText('Test Problem 1')).toBeVisible();
  await expect(page.getByText('Problems will be revealed when the contest starts')).not.toBeVisible();
});
