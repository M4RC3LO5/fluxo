import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.js',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:5173',
    timezoneId: 'America/Sao_Paulo',
    locale: 'pt-BR',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true
  }
})
