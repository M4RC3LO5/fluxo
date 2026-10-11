import { test, expect } from '@playwright/test'
import { importFixture, FIXED_NOW } from './helpers/importFixture.js'

const rows = page => page.getByTestId('lanc-row')
const footerForecast = page => page.getByTestId('lanc-footer-forecast')
// Intl pt-BR usa NBSP entre "R$" e o número; normaliza para comparar com o .feature
const norm = s => s.replace(/ /g, ' ').trim()
const expectForecast = async (page, valor) =>
  await expect.poll(async () => norm(await footerForecast(page).innerText())).toBe(valor)

async function abrirLancamentos(page) {
  await page.getByRole('link', { name: /Lançamentos/ }).first().click()
  await expect(page.getByTestId('lanc-count')).toBeVisible()
}

test.describe('Lista de lançamentos', () => {
  test.beforeEach(async ({ page }) => {
    await importFixture(page)
    await abrirLancamentos(page)
  })

  test('Lista exibe todos os lançamentos importados', async ({ page }) => {
    await expect(page.getByText('15 de 15 registros')).toBeVisible()
    await expect(rows(page)).toHaveCount(15)
    await expectForecast(page, 'R$ 46.030,00')
  })

  test('Ordenação padrão por vencimento crescente', async ({ page }) => {
    const first = rows(page).first()
    await expect(first).toContainText('Recebimento cliente D - Atraso')
    await expect(first).toContainText('05/10/2026')
  })

  for (const [status, linhas, previsto] of [
    ['Pago', 4, 'R$ 17.590,00'],
    ['Pendente', 10, 'R$ 25.640,00'],
    ['Vencido', 1, 'R$ 2.800,00'],
  ]) {
    test(`Filtro por status: ${status}`, async ({ page }) => {
      await page.getByTestId('filter-status').selectOption({ label: status })
      await expect(rows(page)).toHaveCount(linhas)
      await expectForecast(page, previsto)
    })
  }

  test('Filtro por responsável', async ({ page }) => {
    await page.getByTestId('filter-responsible').selectOption({ label: 'Marcelo' })
    await expect(rows(page)).toHaveCount(7)
    await expectForecast(page, 'R$ 25.350,00')
  })

  test('Filtro por centro de custo', async ({ page }) => {
    await page.getByTestId('filter-center').selectOption({ label: 'Comercial' })
    await expect(rows(page)).toHaveCount(4)
    await expectForecast(page, 'R$ 18.500,00')
  })

  test('Busca por descrição', async ({ page }) => {
    await page.getByTestId('filter-search').fill('aluguel')
    await expect(rows(page)).toHaveCount(2)
  })

  test('Busca por pagador', async ({ page }) => {
    await page.getByTestId('filter-search').fill('Empresa')
    await expect(rows(page)).toHaveCount(4)
  })

  test('Filtros combinados', async ({ page }) => {
    await page.getByTestId('filter-status').selectOption({ label: 'Pendente' })
    await page.getByTestId('filter-responsible').selectOption({ label: 'Carlos' })
    await expect(rows(page)).toHaveCount(3)
  })

  test('Limpar filtros restaura a lista', async ({ page }) => {
    await page.getByTestId('filter-status').selectOption({ label: 'Pago' })
    await expect(rows(page)).toHaveCount(4)
    await page.getByTestId('filter-clear').click()
    await expect(rows(page)).toHaveCount(15)
  })

  test('Ordenar por valor previsto crescente', async ({ page }) => {
    await page.getByRole('columnheader', { name: 'Previsto', exact: true }).click()
    await expect(rows(page).first()).toContainText('Material escritório')
  })

  test('Modal de detalhe exibe todos os campos', async ({ page }) => {
    await rows(page).filter({ hasText: 'Recebimento cliente A' }).click()
    const modal = page.getByTestId('lanc-modal')
    await expect(modal).toBeVisible()
    const campo = rotulo => modal.getByText(rotulo, { exact: true }).locator('xpath=following-sibling::p')
    await expect(campo('Pagador')).toHaveText('Empresa Alpha')
    await expect(campo('Tipo')).toHaveText('Receita')
    await expect(campo('Observações')).toHaveText('NF 1042')
    await page.getByTestId('lanc-modal-close').click()
    await expect(modal).toBeHidden()
  })

  for (const [termo, linhas] of [
    ['Carlos', 4], ['Tecnologia', 2], ['NF 1042', 1], ['manutencao', 1],
    ['8.200', 2], ['15/11/2026', 1], ['vencido', 1], ['receita', 4],
  ]) {
    test(`Busca encontra qualquer informação: "${termo}"`, async ({ page }) => {
      await page.getByTestId('filter-search').fill(termo)
      await expect(rows(page)).toHaveCount(linhas)
    })
  }

  test('Fechar modal clicando fora', async ({ page }) => {
    await rows(page).filter({ hasText: 'Recebimento cliente A' }).click()
    const modal = page.getByTestId('lanc-modal')
    await expect(modal).toBeVisible()
    await page.mouse.click(5, 5) // fundo escuro, fora do cartão
    await expect(modal).toBeHidden()
  })

  test('Fechar modal com Esc', async ({ page }) => {
    await rows(page).filter({ hasText: 'Recebimento cliente A' }).click()
    const modal = page.getByTestId('lanc-modal')
    await expect(modal).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
  })
})

test('Estado vazio sem importação', async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto('/')
  await abrirLancamentos(page)
  await expect(page.getByText('Nenhum dado importado')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ir para Importações' })).toBeVisible()
})
