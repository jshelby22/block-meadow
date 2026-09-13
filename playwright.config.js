import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  // Hosted Linux runners render WebGL on the CPU. Keep all checks, but allow
  // shader compilation, real simulation progress, screenshots, and reloads.
  timeout: process.env.CI ? 120_000 : 30_000,
  expect: { timeout: process.env.CI ? 30_000 : 5_000 },
  reporter: process.env.CI ? 'line' : 'list',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
