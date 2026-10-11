import { expect } from '@playwright/test'

/** < md (768px) = celular (cards); >= md = desktop (tabela). Decide pela viewport, não pelo projeto. */
export const isMobileView = page => page.viewportSize().width < 768

// Intl pt-BR usa NBSP entre "R$" e o número; normaliza para comparar com o .feature
export const norm = s => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

export const rows = page => page.getByTestId(isMobileView(page) ? 'lanc-card' : 'lanc-row')

export async function abrirLancamentos(page) {
  await page.getByRole('link', { name: /Lançamentos/ }).first().click()
  await expect(page.getByTestId('lanc-count')).toBeVisible()
}

/** Total previsto filtrado: rodapé da tabela (desktop) ou resumo (celular). */
export async function forecastText(page) {
  if (!isMobileView(page)) return norm(await page.getByTestId('lanc-footer-forecast').innerText())
  const txt = norm(await page.getByTestId('lanc-summary').innerText())
  return txt.match(/Previsto (R\$ [\d.,]+)/)?.[1] ?? txt
}
export const expectForecast = (page, valor) =>
  expect.poll(() => forecastText(page)).toBe(valor)

export async function openFilterSheet(page) {
  await page.getByTestId('filters-button').click()
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()
}
async function applyFilterSheet(page) {
  await page.getByTestId('sheet-apply').click()
  await expect(page.getByTestId('bottom-sheet')).toBeHidden()
}

export async function setStatus(page, label) {
  if (isMobileView(page)) {
    await page.getByTestId('status-chip').filter({ hasText: new RegExp(`^${label}$`) }).click()
  } else {
    await page.getByTestId('filter-status').selectOption({ label })
  }
}

export async function setResponsible(page, nome) {
  if (isMobileView(page)) {
    await openFilterSheet(page)
    await page.getByTestId('sheet-responsible').selectOption({ label: nome })
    await applyFilterSheet(page)
  } else {
    await page.getByTestId('filter-responsible').selectOption({ label: nome })
  }
}

export async function setCenter(page, nome) {
  if (isMobileView(page)) {
    await openFilterSheet(page)
    await page.getByTestId('sheet-center').selectOption({ label: nome })
    await applyFilterSheet(page)
  } else {
    await page.getByTestId('filter-center').selectOption({ label: nome })
  }
}

export const search = (page, termo) => page.getByTestId('filter-search').fill(termo)

export async function clearFilters(page) {
  if (!isMobileView(page)) return page.getByTestId('filter-clear').click()
  await setStatus(page, 'Todos')
  await search(page, '')
  if (/\(\d+\)/.test(await page.getByTestId('filters-button').innerText())) {
    await openFilterSheet(page)
    await page.getByTestId('sheet-clear').click()
    await applyFilterSheet(page)
  }
}

/** Ordena por valor previsto crescente (cabeçalho da coluna no desktop, painel de filtros no celular). */
export async function sortByForecastAsc(page) {
  if (isMobileView(page)) {
    await openFilterSheet(page)
    await page.getByTestId('sheet-sort').selectOption({ label: 'Menor valor' })
    await applyFilterSheet(page)
  } else {
    await page.getByRole('columnheader', { name: 'Previsto', exact: true }).click()
  }
}

export const openDetail = (page, descricao) => rows(page).filter({ hasText: descricao }).click()
export const detailModal = page => page.getByTestId('lanc-modal')
export const detailField = (page, rotulo) =>
  detailModal(page).getByText(rotulo, { exact: true }).locator('xpath=following-sibling::p')
export const closeDetail = page =>
  page.getByTestId(isMobileView(page) ? 'sheet-close' : 'lanc-modal-close').click()
export const clickOutsideDetail = page => page.mouse.click(5, 5) // fundo escuro, fora do painel/cartão
