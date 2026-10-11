import { test, expect } from '@playwright/test'
import { importFixture } from './helpers/importFixture.js'
import {
  abrirLancamentos, setStatus, norm, openFilterSheet, openDetail, detailModal, detailField, clickOutsideDetail,
} from './helpers/lancamentos.js'

const cards = page => page.getByTestId('lanc-cards').getByTestId('lanc-card')
const summary = page => page.getByTestId('lanc-summary')
const expectSummary = async (page, ...trechos) => {
  for (const t of trechos) await expect.poll(async () => norm(await summary(page).innerText())).toContain(t)
}

test.describe('Lançamentos no celular', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!isMobile, 'cenário de celular')
    await importFixture(page)
    await abrirLancamentos(page)
  })

  test('Lançamentos aparecem em cards, sem tabela', async ({ page }) => {
    await expect(cards(page)).toHaveCount(15)
    await expect(page.locator('table')).toBeHidden()
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    expect(sw).toBeLessThanOrEqual(iw)
  })

  test('Card exibe as informações principais', async ({ page }) => {
    const card = cards(page).filter({ hasText: 'Recebimento cliente A' })
    const txt = norm(await card.innerText())
    for (const t of ['R$ 5.000,00', '28/10/2026', 'Ana', 'Pago']) expect(txt).toContain(t)
  })

  test('Cards agrupados por mês de vencimento', async ({ page }) => {
    const grupo = nome => page.getByTestId('lanc-group')
      .filter({ has: page.getByTestId('lanc-group-header').filter({ hasText: nome }) })
    await expect(grupo('Outubro 2026').getByTestId('lanc-card')).toHaveCount(6)
    await expect(grupo('Novembro 2026').getByTestId('lanc-card')).toHaveCount(9)
  })

  test('Resumo exibe quantidade e total previsto', async ({ page }) => {
    await expectSummary(page, '15 lançamentos', 'R$ 46.030,00')
  })

  for (const [status, qtd, previsto] of [
    ['Pago', 4, 'R$ 17.590,00'], ['Pendente', 10, 'R$ 25.640,00'], ['Vencido', 1, 'R$ 2.800,00'], ['Todos', 15, 'R$ 46.030,00'],
  ]) {
    test(`Chips de status filtram com um toque: ${status}`, async ({ page }) => {
      await setStatus(page, status === 'Todos' ? 'Pago' : 'Todos') // parte de um estado diferente do alvo
      await page.getByTestId('status-chip').filter({ hasText: new RegExp(`^${status}$`) }).tap()
      await expect(cards(page)).toHaveCount(qtd)
      await expectSummary(page, previsto)
    })
  }

  test('Painel de filtros aplica responsável e mostra contagem', async ({ page }) => {
    await page.getByTestId('filters-button').tap()
    await page.getByTestId('sheet-responsible').selectOption({ label: 'Marcelo' })
    await page.getByRole('button', { name: 'Aplicar' }).tap()
    await expect(cards(page)).toHaveCount(7)
    await expect(page.getByTestId('filters-button')).toHaveText('Filtros (1)')
  })

  test('Ordenar por menor valor remove agrupamento', async ({ page }) => {
    await expect(page.getByTestId('lanc-group-header').first()).toBeVisible()
    await page.getByTestId('filters-button').tap()
    await page.getByTestId('sheet-sort').selectOption({ label: 'Menor valor' })
    await page.getByRole('button', { name: 'Aplicar' }).tap()
    await expect(cards(page).first()).toContainText('Material escritório')
    await expect(page.getByTestId('lanc-group-header')).toHaveCount(0)
    await expect(page.getByTestId('filters-button')).toHaveText('Filtros (1)')
  })

  test('Contador soma responsável e ordenação', async ({ page }) => {
    const botao = page.getByTestId('filters-button')
    await botao.tap()
    await page.getByTestId('sheet-responsible').selectOption({ label: 'Marcelo' })
    await page.getByTestId('sheet-sort').selectOption({ label: 'Maior valor' })
    await page.getByRole('button', { name: 'Aplicar' }).tap()
    await expect(botao).toHaveText('Filtros (2)')
    await botao.tap()
    await page.getByRole('button', { name: 'Limpar' }).tap()
    await page.getByRole('button', { name: 'Aplicar' }).tap()
    await expect(botao).toHaveText('Filtros')
    await expect(cards(page)).toHaveCount(15)
  })

  test('Detalhe abre como painel inferior', async ({ page }) => {
    await openDetail(page, 'Recebimento cliente A')
    await expect(page.getByTestId('bottom-sheet')).toBeVisible()
    await expect(detailField(page, 'Pagador')).toHaveText('Empresa Alpha')
    await expect(detailField(page, 'Observações')).toHaveText('NF 1042')
    await clickOutsideDetail(page)
    await expect(detailModal(page)).toBeHidden()
  })
})

test('Computador mantém a tabela', async ({ page, isMobile }) => {
  test.skip(isMobile, 'cenário de computador')
  await importFixture(page)
  await abrirLancamentos(page)
  await expect(page.getByTestId('lanc-row')).toHaveCount(15)
  await expect(page.getByTestId('lanc-card').first()).toBeHidden() // existem no DOM, mas ocultos (md:hidden)
  await expect(page.getByTestId('lanc-cards')).toBeHidden()
})
