import { test, expect } from '@playwright/test'
import { importFixture, FIXED_NOW } from './helpers/importFixture.js'
import {
  rows, abrirLancamentos, expectForecast, setStatus, setResponsible, setCenter, search,
  clearFilters, sortByForecastAsc, openDetail, detailModal, detailField, closeDetail, clickOutsideDetail,
} from './helpers/lancamentos.js'

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
      await setStatus(page, status)
      await expect(rows(page)).toHaveCount(linhas)
      await expectForecast(page, previsto)
    })
  }

  test('Filtro por responsável', async ({ page }) => {
    await setResponsible(page, 'Marcelo')
    await expect(rows(page)).toHaveCount(7)
    await expectForecast(page, 'R$ 25.350,00')
  })

  test('Filtro por centro de custo', async ({ page }) => {
    await setCenter(page, 'Comercial')
    await expect(rows(page)).toHaveCount(4)
    await expectForecast(page, 'R$ 18.500,00')
  })

  test('Busca por descrição', async ({ page }) => {
    await search(page, 'aluguel')
    await expect(rows(page)).toHaveCount(2)
  })

  test('Busca por pagador', async ({ page }) => {
    await search(page, 'Empresa')
    await expect(rows(page)).toHaveCount(4)
  })

  test('Filtros combinados', async ({ page }) => {
    await setStatus(page, 'Pendente')
    await setResponsible(page, 'Carlos')
    await expect(rows(page)).toHaveCount(3)
  })

  test('Limpar filtros restaura a lista', async ({ page }) => {
    await setStatus(page, 'Pago')
    await expect(rows(page)).toHaveCount(4)
    await clearFilters(page)
    await expect(rows(page)).toHaveCount(15)
  })

  test('Ordenar por valor previsto crescente', async ({ page }) => {
    await sortByForecastAsc(page)
    await expect(rows(page).first()).toContainText('Material escritório')
  })

  test('Modal de detalhe exibe todos os campos', async ({ page }) => {
    await openDetail(page, 'Recebimento cliente A')
    const modal = detailModal(page)
    await expect(modal).toBeVisible()
    const campo = rotulo => detailField(page, rotulo)
    await expect(campo('Pagador')).toHaveText('Empresa Alpha')
    await expect(campo('Tipo')).toHaveText('Entrada')
    await expect(campo('Categoria')).toHaveText('Sem categoria')
    await expect(campo('Observações')).toHaveText('NF 1042')
    await closeDetail(page)
    await expect(modal).toBeHidden()
  })

  for (const [termo, linhas] of [
    ['Carlos', 4], ['Tecnologia', 2], ['NF 1042', 1], ['manutencao', 1],
    ['8.200', 2], ['15/11/2026', 1], ['vencido', 1], ['receita', 4],
  ]) {
    test(`Busca encontra qualquer informação: "${termo}"`, async ({ page }) => {
      await search(page, termo)
      await expect(rows(page)).toHaveCount(linhas)
    })
  }

  // "conta " tem espaço final: no .feature ele não sobrevive à célula da tabela (ver comentário lá)
  for (const [termo, linhas] of [['conta', 2], ['conta ', 1]]) {
    test(`Espaço no termo de busca é respeitado: ${JSON.stringify(termo)}`, async ({ page }) => {
      await search(page, termo)
      await expect(rows(page)).toHaveCount(linhas)
    })
  }

  for (const [termo, linhas] of [
    ['15/11/2026', 1], ['15/11/26', 1], ['15/11', 1], ['2026-11-15', 1], ['5/11/2026', 1], ['/11/2026', 9],
  ]) {
    test(`Busca por data em formatos diferentes: "${termo}"`, async ({ page }) => {
      await search(page, termo)
      await expect(rows(page)).toHaveCount(linhas)
    })
  }

  test('Fechar modal clicando fora', async ({ page }) => {
    await openDetail(page, 'Recebimento cliente A')
    const modal = detailModal(page)
    await expect(modal).toBeVisible()
    await clickOutsideDetail(page)
    await expect(modal).toBeHidden()
  })

  test('Fechar modal com Esc', async ({ page }) => {
    await openDetail(page, 'Recebimento cliente A')
    const modal = detailModal(page)
    await expect(modal).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
  })

  test('Botão X limpa a busca de uma vez', async ({ page }) => {
    const campo = page.getByTestId('filter-search')
    await search(page, 'aluguel')
    await expect(rows(page)).toHaveCount(2)
    await page.getByRole('button', { name: 'Limpar busca' }).click()
    await expect(campo).toHaveValue('')
    await expect(rows(page)).toHaveCount(15)
    await expect(campo).toBeFocused()
  })

  test('Botão X só aparece com texto na busca', async ({ page }) => {
    const x = page.getByRole('button', { name: 'Limpar busca' })
    await expect(x).toBeHidden()
    await search(page, 'a')
    await expect(x).toBeVisible()
    // alvo de toque >= 44x44 (celular e desktop)
    const box = await x.boundingBox()
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  })
})

test('Estado vazio sem importação', async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto('/')
  await abrirLancamentos(page)
  await expect(page.getByText('Nenhum dado importado')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ir para Importações' })).toBeVisible()
})
