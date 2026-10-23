import { expect } from '@playwright/test'

/** O Dashboard abre na visão Pessoal; com lançamentos de planilha, "Contas a pagar" é o outro lado do controle. */
export async function showBills(page) {
  await page.getByTestId('view-toggle-bills').click()
  await expect(page.getByTestId('kpi-card').first()).toBeVisible()
}

export async function showPersonal(page) {
  await page.getByTestId('view-toggle-personal').click()
  await expect(page.getByTestId('pf-kpi-balance')).toBeVisible()
}
