import { expect } from '@playwright/test'

export const FIXTURE = 'tests/fixtures/fluxo_exemplo.xlsx'
export const FIXED_NOW = new Date('2026-10-10T12:00:00-03:00')

/** Congela o relógio (antes do goto) e importa a fixture de 15 lançamentos pela tela de Importações. */
export async function importFixture(page, { versionName = 'teste-e2e' } = {}) {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto('/importacoes')
  await page.getByText('Planilha Excel', { exact: true }).first().click()
  await page.locator('input[type=file]').setInputFiles(FIXTURE)
  await page.getByText('Nome da versão').locator('xpath=following-sibling::input').fill(versionName)
  await page.getByRole('button', { name: /Importar/ }).click()
  await expect(page.getByText('15 registros importados')).toBeVisible()
}
