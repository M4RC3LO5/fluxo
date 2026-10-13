import { test, expect } from '@playwright/test'
import { importFixture, FIXED_NOW } from './helpers/importFixture.js'

// Lê o estado final de um gráfico: dados e tamanho de cada elemento
// (barra: height/width, arco: endAngle-startAngle, ponto: y)
const readChart = (page, testid) => page.evaluate(async (testid) => {
  const { Chart } = await import('/node_modules/.vite/deps/chart__js.js')
  const canvas = document.querySelector(`[data-testid="${testid}"]`)
  const ch = canvas && Chart.getChart(canvas)
  if (!ch) return null
  return {
    type: ch.config.type,
    labels: ch.data.labels,
    datasets: ch.data.datasets.map(d => d.data),
    width: canvas.clientWidth,
    height: canvas.clientHeight,
    sizes: ch.data.datasets.map((_, i) => ch.getDatasetMeta(i).data.map(el =>
      ch.config.type === 'doughnut' ? +(el.endAngle - el.startAngle).toFixed(3)
      : ch.config.type === 'line' ? Math.round(el.y)
      : Math.round(Math.abs(el.horizontal ? el.x - el.base : el.base - el.y))))
  }
}, testid)

const checks = {
  'chart-bar': c => {
    // barras proporcionais: Marcelo previsto 25.350 vs Carlos 13.950
    expect(c.datasets[0][0]).toBe(25350)
    expect(c.sizes[0][0] / c.sizes[0][1]).toBeCloseTo(25350 / 13950, 1)
  },
  'chart-doughnut': c => {
    // 3 fatias somando 2π
    expect(c.sizes[0]).toHaveLength(3)
    expect(c.sizes[0].reduce((a, b) => a + b, 0)).toBeCloseTo(2 * Math.PI, 1)
  },
  'chart-payer': c => {
    // 4 barras horizontais proporcionais
    expect(c.labels).toHaveLength(4)
    expect(c.sizes[0][0] / c.sizes[0][3]).toBeCloseTo(8200 / 890, 0)
  },
  'chart-line': c => {
    expect(c.labels).toEqual(['10/26', '11/26'])
    expect(c.sizes[0]).toHaveLength(2)
  },
}

// espera o gráfico chegar ao estado FINAL correto (não basta ter tamanho: não pode ficar preso no primeiro frame da animação)
async function expectComplete(page, testid) {
  await expect.poll(async () => {
    const c = await readChart(page, testid)
    if (!c || !c.width || !c.height) return 'sem tamanho (canvas oculto ou não criado)'
    try { checks[testid](c); return 'ok' } catch (e) { return String(e.message).split('\n').slice(0, 4).join(' ') }
  }, { message: `gráfico ${testid} não ficou completo`, timeout: 8000 }).toBe('ok')
}

test('dashboard renderiza os 4 gráficos completos, sem erros de console', async ({ page, isMobile }) => {
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`) })
  page.on('pageerror', e => errors.push(`[pageerror] ${e.stack || e.message}`))

  // desktop: viewport alto (screenshot fullPage redimensiona a janela e reinicia a animação dos gráficos responsivos).
  // celular: viewport real do Pixel 7, percorrendo as abas.
  if (!isMobile) await page.setViewportSize({ width: 1280, height: 2800 })
  await importFixture(page)

  // setFixedTime congela Date.now() e o Chart.js anima por Date.now(): libera o relógio (mesma data) para a animação rodar
  await page.clock.setSystemTime(FIXED_NOW)
  if (isMobile) await page.getByTestId('bottom-nav-item').filter({ hasText: 'Dashboard' }).tap()
  else await page.getByRole('link', { name: /Dashboard/ }).first().click()

  if (isMobile) {
    const abas = ['Previsto × Pago', 'Responsáveis', 'Pagadores', 'Evolução']
    const ids = ['chart-bar', 'chart-doughnut', 'chart-payer', 'chart-line']
    for (const [i, nome] of abas.entries()) {
      await page.getByTestId('chart-tab').filter({ hasText: nome }).tap()
      await expectComplete(page, ids[i])
    }
  } else {
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'tests/e2e/screenshots/dashboard.png' })
    for (const id of Object.keys(checks)) await expectComplete(page, id)
  }

  expect(errors).toEqual([])
})
