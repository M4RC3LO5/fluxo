import { expect } from '@playwright/test'

export const FIXTURE = 'tests/fixtures/fluxo_exemplo.xlsx'
export const FIXED_NOW = new Date('2026-10-10T12:00:00-03:00')

/** Congela o relógio (antes do goto) e importa a fixture de 15 lançamentos: escolher o arquivo no card já importa. */
export async function importFixture(page) {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto('/importacoes')
  await page.locator('[data-testid="source-input-xlsx"]').setInputFiles(FIXTURE)
  await expect(page.getByText('15 lançamentos importados')).toBeVisible()
}
