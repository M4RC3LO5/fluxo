import { test, expect } from '@playwright/test'
import { importFixture, FIXED_NOW } from './helpers/importFixture.js'

test('dashboard renderiza os 4 gráficos completos, sem erros de console', async ({ page }) => {
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`) })
  page.on('pageerror', e => errors.push(`[pageerror] ${e.stack || e.message}`))

  // viewport alto: screenshot fullPage redimensiona a janela e reinicia a animação dos gráficos responsivos
  await page.setViewportSize({ width: 1280, height: 2800 })
  await importFixture(page)

  // setFixedTime congela Date.now() e o Chart.js anima por Date.now(): libera o relógio (mesma data) para a animação rodar
  await page.clock.setSystemTime(FIXED_NOW)
  await page.getByRole('link', { name: /Dashboard/ }).first().click()
  await page.waitForTimeout(2000)

  await page.screenshot({ path: 'tests/e2e/screenshots/dashboard.png' })

  const charts = await page.evaluate(async () => {
    const { Chart } = await import('/node_modules/.vite/deps/chart__js.js')
    return [...document.querySelectorAll('canvas')].map(c => {
      const ch = Chart.getChart(c)
      return ch && {
        type: ch.config.type,
        labels: ch.data.labels,
        datasets: ch.data.datasets.map(d => d.data),
        animating: ch.animating,
        // tamanho final de cada elemento (barra: height/width, arco: endAngle-startAngle, ponto: y)
        sizes: ch.data.datasets.map((_, i) => ch.getDatasetMeta(i).data.map(el =>
          ch.config.type === 'doughnut' ? +(el.endAngle - el.startAngle).toFixed(3)
          : ch.config.type === 'line' ? Math.round(el.y)
          : Math.round(Math.abs(el.horizontal ? el.x - el.base : el.base - el.y))))
      }
    })
  })
  console.log(JSON.stringify(charts, null, 1))
  console.log('ERRORS:', JSON.stringify(errors, null, 1))

  expect(charts).toHaveLength(4)
  expect(charts.every(Boolean)).toBe(true)
  expect(charts.every(c => !c.animating)).toBe(true)

  const [bar, donut, payer, line] = charts
  // barras proporcionais: Marcelo previsto 25.350 vs Carlos 13.950
  expect(bar.datasets[0][0]).toBe(25350)
  expect(bar.sizes[0][0] / bar.sizes[0][1]).toBeCloseTo(25350 / 13950, 1)
  // doughnut completo: 3 fatias somando 2π
  expect(donut.sizes[0]).toHaveLength(3)
  expect(donut.sizes[0].reduce((a, b) => a + b, 0)).toBeCloseTo(2 * Math.PI, 1)
  // pagador: 4 barras horizontais proporcionais
  expect(payer.labels).toHaveLength(4)
  expect(payer.sizes[0][0] / payer.sizes[0][3]).toBeCloseTo(8200 / 890, 0)
  // evolução: 2 pontos
  expect(line.labels).toEqual(['10/26', '11/26'])
  expect(line.sizes[0]).toHaveLength(2)
  expect(errors).toEqual([])
})
