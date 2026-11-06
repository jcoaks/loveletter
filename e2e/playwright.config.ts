import { defineConfig, devices } from '@playwright/test';

// Needs the Worker and Vite running (`pnpm dev`); started automatically if not.
export default defineConfig({
  testDir: '.',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 960 },
    trace: 'retain-on-failure',
    actionTimeout: 4_000,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 } },
    },
  ],
  // Against a deployment (BASE_URL set) there is nothing to start locally.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        cwd: '..',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
