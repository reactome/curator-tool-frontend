import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the curator tool.
 *
 * The suite drives the real Angular app in a real browser but serves every `/api/**` request
 * from the fixtures in `src/testing/api-fixtures.ts` (see `fixtures/api-mock.ts`). That means
 * it needs no backend, no Neo4j, and no credentials, and it gives the same answers on every
 * run -- so a failure is a frontend regression rather than a data difference.
 *
 * Run it with:
 *   cd e2e && npm install && npm run install-browsers   # once
 *   npm test
 *
 * `webServer` starts `ng serve` automatically and reuses an already-running one, so
 * `npm start` in another terminal makes the runs faster while iterating.
 */
export default defineConfig({
  testDir: './tests',
  // Angular's dev-server rebuild plus the app's own bootstrap makes the first navigation of a
  // worker slow; 30s per test is comfortable without hiding a hang.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // A test that only passes when retried is a flaky test, and this suite mocks its backend
  // precisely so there is nothing legitimate to retry. Keep it at zero locally so flake is
  // visible; CI gets one retry to distinguish flake from breakage in the report.
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  fullyParallel: true,
  // Fail the run rather than silently accepting a test that was left focused.
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI']
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The instance view and the event tree are wide; a cramped viewport wraps their headers
    // and pushes content out of view, which reads as a failure that is really a layout
    // artefact of the test window.
    viewport: { width: 1600, height: 1000 }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm start',
    cwd: '..',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    // A cold Angular dev-server build of this app takes a while.
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe'
  }
});
