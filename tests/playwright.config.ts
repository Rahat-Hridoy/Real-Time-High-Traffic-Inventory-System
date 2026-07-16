import { defineConfig } from '@playwright/test';

export default defineConfig({
  // All tests are in the root tests/ directory
  testDir: '.',

  // No browsers — pure API testing only
  projects: [
    {
      name: 'api',
      use: {}
    }
  ],

  // Base URL for the backend API
  use: {
    baseURL: 'http://localhost:5000',
    // Extra HTTP timeout for the recovery test (waits 65s)
    extraHTTPHeaders: {
      'Content-Type': 'application/json'
    }
  },

  // Global timeout: 120 seconds (the recovery test needs ~65 s to elapse)
  timeout: 120_000,

  // Run tests serially so recovery test follows concurrency test correctly
  workers: 1,

  // Rich reporter output
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
});
