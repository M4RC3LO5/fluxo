import { test, expect } from '@playwright/test'
import * as XLSX from 'xlsx'
import { FIXED_NOW, importFixture } from './helpers/importFixture.js'
import { waitAppReady } from './helpers/appReady.js'
import { showBills, showPersonal } from './helpers/dashboard.js'
import { rows, norm } from './helpers/lancamentos.js'

const OUTUBRO = 'tests/fixtures/pf_conta_outubro.csv'
const CARTAO = 'tests/fixtures/pf_cartao_outubro.csv'
const SETEMBRO = 'tests/fixtures/pf_conta_setembro.csv'

const result = page => page.getByTestId('import-result')
const text = async loc => norm(await loc.innerText())

/** Importa pelo card Nubank, um arquivo por vez (espera o resultado antes do próximo). */
async function importar(page, arquivo, esperado) {
  await page.locator('[data-testid="source-input-nubank"]').setInputFiles(arquivo)
  await expect(result(page)).toContainText(esperado)
}
async function importarTudo(page) {
  await page.goto('/importacoes')
  await waitAppReady(page)
  await importar(page, SETEMBRO, '3 lançamentos importados')
  await importar(page, OUTUBRO, '7 lançamentos importados')
  await importar(page, CARTAO, '5 lançamentos importados')
}
async function abrirDashboard(page) {
  await page.goto('/dashboard') // recarrega: a visão e o mês voltam ao padrão
  await waitAppReady(page)
  await expect(page.getByTestId('pf-month-label')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
})

test.describe('Visão Pessoal', () => {
  test.beforeEach(async ({ page }) => {
    await importarTudo(page)
    await abrirDashboard(page)
  })

  test('abre no mês mais recente, sem o controle (não há planilha)', async ({ page }) => {
    await expect(page.getByTestId('view-toggle')).toHaveCount(0)
    await expect(page.getByTestId('pf-month-label')).toHaveText('outubro/2026')
    await expect(page.getByTestId('kpi-card')).toHaveCount(0) // são os KPIs de Contas a pagar
  })

  test('Entradas, Saídas e Saldo do mês; transferências ficam de fora', async ({ page }) => {
    expect(await text(page.getByTestId('pf-kpi-in'))).toContain('R$ 5.000,00')
    expect(await text(page.getByTestId('pf-kpi-out'))).toContain('R$ 2.290,40')
    expect(await text(page.getByTestId('pf-kpi-balance'))).toContain('R$ 2.709,60')
    const transf = await text(page.getByTestId('pf-transfers'))
    expect(transf).toContain('Transferências: R$ 3.000,00 (2)')
    expect(transf).toContain('não entram nas contas')
    await expect(page.getByTestId('pf-untyped')).toHaveCount(0)
  })

  test('Saldo negativo fica vermelho; positivo, verde', async ({ page }) => {
    await expect(page.getByTestId('pf-kpi-balance').locator('p').first()).toHaveClass(/text-emerald-400/)
    await page.getByTestId('pf-month-prev').click() // setembro: 4.000 − 900
    await expect(page.getByTestId('pf-kpi-balance').locator('p').first()).toHaveClass(/text-emerald-400/)
  })

  test('navega pelos meses com ‹ e ›', async ({ page }) => {
    const label = page.getByTestId('pf-month-label')
    await expect(page.getByTestId('pf-month-next')).toBeDisabled() // já é o mais recente
    await page.getByTestId('pf-month-prev').click()
    await expect(label).toHaveText('setembro/2026')
    expect(await text(page.getByTestId('pf-kpi-in'))).toContain('R$ 4.000,00')
    expect(await text(page.getByTestId('pf-kpi-out'))).toContain('R$ 900,00')
    expect(await text(page.getByTestId('pf-kpi-balance'))).toContain('R$ 3.100,00')
    expect(await text(page.getByTestId('pf-transfers'))).toContain('R$ 300,00 (1)')
    await expect(page.getByTestId('pf-month-prev')).toBeDisabled() // o mais antigo
    await page.getByTestId('pf-month-next').click()
    await expect(label).toHaveText('outubro/2026')
  })

  test('gráfico: clicar numa barra seleciona o mês', async ({ page }) => {
    const chart = page.getByTestId('pf-chart')
    await expect(chart).toBeVisible()
    await expect.poll(async () => JSON.parse(await chart.getAttribute('data-bars') || '[]').length).toBe(12)
    const bars = JSON.parse(await chart.getAttribute('data-bars'))
    expect(bars[11].month).toBe('2026-10')
    const setembro = bars.find(b => b.month === '2026-09')
    await chart.scrollIntoViewIfNeeded() // o clique do mouse usa coordenadas da janela
    const box = await chart.locator('canvas').boundingBox()
    await page.mouse.click(box.x + setembro.x, box.y + setembro.y)
    await expect(page.getByTestId('pf-month-label')).toHaveText('setembro/2026')
  })

  test('rankings: categoria e descrição (top 5, valor e % das Saídas)', async ({ page }) => {
    const categorias = page.getByTestId('pf-rank-category').getByTestId('pf-rank-row')
    await expect(categorias).toHaveCount(4)
    // "Supermercado Bom Preço" (regra seed) e "mercado" (coluna do banco) são a mesma categoria: Mercado
    expect(await text(categorias.nth(0))).toContain('Sem categoria')
    expect(await text(categorias.nth(0))).toContain('R$ 1.304,90')
    expect(await text(categorias.nth(0))).toContain('57%')
    expect(await text(categorias.nth(1))).toContain('Mercado')
    expect(await text(categorias.nth(1))).toContain('R$ 880,50')
    expect(await text(categorias.nth(1))).toContain('38,4%')

    const descricoes = page.getByTestId('pf-rank-description').getByTestId('pf-rank-row')
    await expect(descricoes).toHaveCount(5)
    expect(await text(descricoes.nth(0))).toContain('Aluguel Imobiliária Centro')
    expect(await text(descricoes.nth(0))).toContain('52,4%')
    expect(await text(descricoes.nth(1))).toContain('Supermercado Bom Preço')
    expect(await text(descricoes.nth(1))).toContain('2 lançamentos')
    // "Academia Fitness - Parcela 2/12" aparece sem o sufixo da parcela
    expect(await text(descricoes.nth(3))).toContain('Academia Fitness')
    expect(await text(descricoes.nth(3))).not.toContain('Parcela')
  })

  test('sem rolagem horizontal', async ({ page }) => {
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    expect(sw).toBeLessThanOrEqual(iw)
  })

  test.describe('drill-down para Lançamentos', () => {
    const chips = page => page.getByTestId('filter-chip')

    test('Saídas: mês + tipo, e os chips saem um a um', async ({ page }) => {
      await page.getByTestId('pf-kpi-out').click()
      await expect(page).toHaveURL(/\/lancamentos$/)
      await expect(chips(page)).toHaveText(['out/2026 ×', 'Saídas ×'])
      await expect(rows(page)).toHaveCount(9) // 4 da conta + 5 do cartão (transferências fora)

      await page.getByRole('button', { name: 'Remover filtro Saídas' }).click()
      await expect(chips(page)).toHaveText(['out/2026 ×'])
      await expect(rows(page)).toHaveCount(12) // o mês inteiro, inclusive entradas e transferências

      await page.getByTestId('filter-chips-clear').click()
      await expect(chips(page)).toHaveCount(0)
      await expect(rows(page)).toHaveCount(15) // setembro + outubro
    })

    test('Entradas e Transferências', async ({ page }) => {
      await page.getByTestId('pf-kpi-in').click()
      await expect(chips(page)).toHaveText(['out/2026 ×', 'Entradas ×'])
      await expect(rows(page)).toHaveCount(1)

      await page.goBack()
      await expect(page.getByTestId('pf-month-label')).toHaveText('outubro/2026')
      await page.getByTestId('pf-transfers').click()
      await expect(chips(page)).toHaveText(['out/2026 ×', 'Transferências ×'])
      await expect(rows(page)).toHaveCount(2)
    })

    test('o mês escolhido vale no drill-down e se mantém ao voltar', async ({ page }) => {
      await page.getByTestId('pf-month-prev').click()
      await page.getByTestId('pf-kpi-out').click()
      await expect(chips(page)).toHaveText(['set/2026 ×', 'Saídas ×'])
      await expect(rows(page)).toHaveCount(1)
      await page.goBack()
      await expect(page.getByTestId('pf-month-label')).toHaveText('setembro/2026')
    })

    test('categoria: com nome e "Sem categoria"', async ({ page }) => {
      const categorias = page.getByTestId('pf-rank-category').getByTestId('pf-rank-row')
      await categorias.nth(1).click() // Mercado
      await expect(chips(page)).toHaveText(['out/2026 ×', 'Saídas ×', 'Categoria: Mercado ×'])
      await expect(rows(page)).toHaveCount(4) // 2 supermercados (regra) + 2 hortifruti (banco)

      await page.goBack()
      await page.getByTestId('pf-rank-category').getByTestId('pf-rank-row').nth(0).click() // Sem categoria
      await expect(chips(page)).toHaveText(['out/2026 ×', 'Saídas ×', 'Categoria: Sem categoria ×'])
      await expect(rows(page)).toHaveCount(3) // aluguel, academia e a compra sem categoria
    })

    test('descrição: filtra pela busca, juntando as parcelas', async ({ page }) => {
      await page.getByTestId('pf-rank-description').getByTestId('pf-rank-row').nth(1).click() // Supermercado Bom Preço
      await expect(page.getByTestId('filter-search')).toHaveValue('Supermercado Bom Preço')
      await expect(rows(page)).toHaveCount(2)
    })
  })
})

test.describe('Controle Pessoal | Contas a pagar', () => {
  test('com planilha: Pessoal é o padrão e dá para alternar sem perder nada', async ({ page }) => {
    await importFixture(page)
    await page.goto('/dashboard')
    await waitAppReady(page)
    await expect(page.getByTestId('view-toggle')).toBeVisible()
    await expect(page.getByTestId('view-toggle-personal')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('pf-month-label')).toBeVisible()

    await showBills(page)
    await expect(page.getByTestId('kpi-card')).toHaveCount(4)
    await expect(page.getByTestId('kpi-card').filter({ hasText: 'Total Previsto' })).toBeVisible()
    await expect(page.getByTestId('pf-month-label')).toHaveCount(0)

    await showPersonal(page)
    await expect(page.getByTestId('kpi-card')).toHaveCount(0)
  })

  test('sem lançamentos: o estado vazio de sempre e nenhum controle', async ({ page }) => {
    await page.goto('/dashboard')
    await waitAppReady(page)
    await expect(page.getByText('Nenhum dado importado ainda')).toBeVisible()
    await expect(page.getByTestId('view-toggle')).toHaveCount(0)
    await expect(page.getByTestId('pf-kpi-in')).toHaveCount(0)
  })

  test('lançamentos sem tipo ficam fora das contas e são contados', async ({ page }) => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Vencimento', 'Descrição', 'Valor Previsto', 'Status'],
      ['05/10/2026', 'Compra sem tipo A', 100, 'Pago'],
      ['06/10/2026', 'Compra sem tipo B', 50, 'Pago']
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Fluxo')
    await page.goto('/importacoes')
    await waitAppReady(page)
    await page.locator('[data-testid="source-input-xlsx"]').setInputFiles({
      name: 'sem_tipo.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    })
    await expect(result(page)).toContainText('2 lançamentos importados')
    await page.goto('/dashboard')
    await waitAppReady(page)
    await expect(page.getByTestId('pf-untyped')).toHaveText('2 lançamentos sem tipo')
    expect(await text(page.getByTestId('pf-kpi-in'))).toContain('R$ 0,00')
    expect(await text(page.getByTestId('pf-kpi-out'))).toContain('R$ 0,00')
  })
})
