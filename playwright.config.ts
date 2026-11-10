import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts', // keeps Vitest (*.test/*.spec) and Playwright apart
  // Software WebGL (SwiftShader) blocks the main thread for up to ~2.5 s while
  // compiling shaders for newly mounted meshes (measured); give DOM assertions
  // headroom and cap parallelism so workers don't starve each other.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    // App renders the 3D scene on demand under reduced motion → no 3 fps
    // software-GL render loop starving the main thread on CI.
    reducedMotion: 'reduce',
    launchOptions: {
      // Software WebGL so the R3F canvas mounts on GPU-less CI runners.
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // Production build + preview: no dev-server cold transforms during the first test.
    command: `npx vite build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
