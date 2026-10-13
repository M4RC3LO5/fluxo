import { test, expect } from '@playwright/test'
import { importFixture, FIXED_NOW } from './helpers/importFixture.js'
import { rows } from './helpers/lancamentos.js'

const byText = (page, testid, texto) => page.getByTestId(testid).filter({ hasText: texto })
const box = async loc => loc.first().boundingBox()
const visibleCount = loc => loc.evaluateAll(els => els.filter(e => e.offsetParent !== null).length)

async function abrirDashboard(page, isMobile) {
  await importFixture(page)
  // libera o relógio (mesma data): o Chart.js anima por Date.now()
  await page.clock.setSystemTime(FIXED_NOW)
  if (isMobile) await page.getByTestId('bottom-nav-item').filter({ hasText: 'Dashboard' }).tap()
  else await page.getByRole('link', { name: /Dashboard/ }).first().click()
  await expect(page.getByTestId('kpi-card').first()).toBeVisible()
}

test.beforeEach(async ({ page, isMobile }) => abrirDashboard(page, isMobile))

test.describe('Celular', () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'cenário de celular'))

  test('KPIs em duas colunas no celular', async ({ page }) => {
    const [prev, pago, pend, venc] = await Promise.all(
      ['Total Previsto', 'Total Pago', 'Total Pendente', 'Vencido Não Pago'].map(t => box(byText(page, 'kpi-card', t))))
    expect(Math.abs(prev.y - pago.y)).toBeLessThan(2)
    expect(Math.abs(pend.y - venc.y)).toBeLessThan(2)
    expect(pend.y).toBeGreaterThan(prev.y + prev.height - 2) // segunda linha abaixo da primeira
    // valores não quebram linha nem estouram o card
    for (const card of await page.getByTestId('kpi-card').all()) {
      const valor = card.locator('p').first()
      const [c, v] = [await card.boundingBox(), await valor.boundingBox()]
      expect(v.height).toBeLessThan(40) // uma linha só
      expect(v.x).toBeGreaterThanOrEqual(c.x)
      expect(v.x + v.width).toBeLessThanOrEqual(c.x + c.width)
    }
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    expect(sw).toBeLessThanOrEqual(iw)
  })

  test('Próximos vencimentos antes dos gráficos no celular', async ({ page }) => {
    const prox = await box(page.getByTestId('ranking-upcoming'))
    const graficos = await box(page.getByTestId('charts-section'))
    expect(prox.y).toBeLessThan(graficos.y)
  })

  test('Gráficos em abas no celular', async ({ page }) => {
    const abas = page.getByTestId('chart-tab')
    await expect(abas).toHaveText(['Previsto × Pago', 'Responsáveis', 'Pagadores', 'Evolução'])
    await expect(page.getByTestId('chart-bar')).toBeVisible()
    for (const id of ['chart-doughnut', 'chart-payer', 'chart-line']) await expect(page.getByTestId(id)).toBeHidden()

    await abas.filter({ hasText: 'Responsáveis' }).tap()
    const canvas = page.getByTestId('chart-doughnut')
    await expect(canvas).toBeVisible()
    await expect(page.getByTestId('chart-bar')).toBeHidden()
    await expect.poll(() => page.evaluate(async () => {
      const { Chart } = await import('/node_modules/.vite/deps/chart__js.js')
      const ch = Chart.getChart(document.querySelector('[data-testid="chart-doughnut"]'))
      return ch.getDatasetMeta(0).data.length
    })).toBe(3)
  })

  test('Ranking mostra os 3 primeiros e expande', async ({ page }) => {
    const centros = page.getByTestId('ranking-centers')
    const itens = centros.getByTestId('ranking-item')
    await expect.poll(() => visibleCount(itens)).toBe(3)
    await centros.getByTestId('ranking-see-all').filter({ hasText: 'Ver todos (6)' }).tap()
    await expect.poll(() => visibleCount(itens)).toBe(6)
  })

  test('Drill-down reflete o filtro no celular', async ({ page }) => {
    await byText(page, 'ranking-item', 'Marcelo').first().tap()
    await expect(page).toHaveURL(/\/lancamentos$/)
    await expect(page.getByTestId('filters-button')).toHaveText('Filtros (1)')
    await page.getByTestId('filters-button').tap()
    await expect(page.getByTestId('sheet-responsible')).toHaveValue('Marcelo')
  })
})

test.describe('Computador', () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, 'cenário de computador'))

  test('Computador mantém os 4 gráficos em grade', async ({ page }) => {
    for (const id of ['chart-bar', 'chart-doughnut', 'chart-payer', 'chart-line']) await expect(page.getByTestId(id)).toBeVisible()
    await expect(page.getByTestId('chart-tab').first()).toBeHidden()
  })
})

// Esquema: drill-down nos 2 projetos
const origens = {
  'responsável Marcelo':       p => byText(p, 'ranking-item', 'Marcelo').first(),
  'centro Comercial':          p => p.getByTestId('ranking-centers').getByTestId('ranking-item').filter({ hasText: 'Comercial' }),
  'alerta Vencidos não pagos': p => byText(p, 'alert-card', 'Vencidos Não Pagos'),
  'KPI Total Pago':            p => byText(p, 'kpi-card', 'Total Pago'),
  'KPI Total Pendente':        p => byText(p, 'kpi-card', 'Total Pendente'),
  'KPI Total Previsto':        p => byText(p, 'kpi-card', 'Total Previsto'),
}
for (const [origem, qtd] of [
  ['responsável Marcelo', 7], ['centro Comercial', 4], ['alerta Vencidos não pagos', 1],
  ['KPI Total Pago', 4], ['KPI Total Pendente', 10], ['KPI Total Previsto', 15],
]) {
  test(`Drill-down do dashboard para lançamentos: ${origem}`, async ({ page }) => {
    await origens[origem](page).click()
    await expect(page).toHaveURL(/\/lancamentos$/)
    await expect(rows(page)).toHaveCount(qtd)
  })
}

test('Drill-down também funciona pelo teclado (Enter)', async ({ page }) => {
  await byText(page, 'kpi-card', 'Total Pago').focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/lancamentos$/)
  await expect(rows(page)).toHaveCount(4)
})
