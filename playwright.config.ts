import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? '100%' : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'en-US', // Forces consistent translation keys across locales for robust placeholder selectors
    trace: 'on-first-retry',
  },
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
    },
  },
  projects: [
    {
      name: 'e2e',
      testIgnore: '*_visual.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'visual',
      testMatch: '*_visual.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: {width: 1280, height: 720},
      },
    },
  ],
  webServer: {
    command: process.env.CI
      ? 'npx vite preview --port 3000 --strictPort' // CI already builds the app; preview directly with strict port
      : 'npx vite --no-open --port 3000 --strictPort',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
