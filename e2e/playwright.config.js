import { defineConfig, devices } from '@playwright/test';

const CLIENT_PORT = 5173;
const BACKEND_PORT = 5000;

// Drives the real Client dev server against the real Backend, both pointed at a
// throwaway Postgres+Redis (never the real Supabase/Upstash instances) -- this is the
// one layer of the CI pyramid that exercises actual rendered UI, not just HTTP
// responses (that's what the Backend integration tests already cover). Seeding/cleanup
// is delegated to Backend/tests/e2eSeed.js via global-setup.js rather than duplicated
// here, reusing the same dbHelpers.js the integration tests already rely on.
export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: { timeout: 10 * 1000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  globalSetup: './global-setup.js',
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: [
    {
      command: 'node server.js',
      cwd: '../Backend',
      url: `http://localhost:${BACKEND_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
      // DISABLE_BACKGROUND_JOBS: without this, server.js's boot-time catalog sync finds
      // this fresh/empty throwaway DB "missing" the whole real LeetCode catalog and
      // re-fetches all ~2,458 problems from LeetCode's live API on every single e2e
      // run -- real, unnecessary third-party API traffic the test doesn't need (it only
      // needs the handful of fake problems e2eSeed.js already seeded).
      env: { ...process.env, PORT: String(BACKEND_PORT), DISABLE_BACKGROUND_JOBS: 'true' }
    },
    {
      command: `npm run dev -- --port ${CLIENT_PORT} --strictPort`,
      cwd: '../Client',
      url: `http://localhost:${CLIENT_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
      env: { ...process.env, VITE_API_BASE: `http://localhost:${BACKEND_PORT}` }
    }
  ]
});
