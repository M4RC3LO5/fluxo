import { test, expect } from '@playwright/test'
import { FIXED_NOW } from './helpers/importFixture.js'
import { waitAppReady } from './helpers/appReady.js'
import { idbGet } from './helpers/idb.js'
import { rows } from './helpers/lancamentos.js'

const CSV = 'tests/fixtures/nubank_cartao_compromissos.csv'
const norm = (s) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
const texto = async loc => norm(await loc.innerText())

async function importar(page) {
  await page.goto('/importacoes')
  await waitAppReady(page)
  await page.locator('[data-testid="source-input-nubank"]').setInputFiles(CSV)
  await expect(page.getByTestId('import-result')).toContainText('39 lançamentos importados')
}
async function abrir(page) {
  await page.goto('/compromissos')
  await waitAppReady(page)
  await expect(page.getByTestId('cm-total')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
})

test('sem dados: estado vazio', async ({ page }) => {
  await page.goto('/compromissos')
  await waitAppReady(page)
  await expect(page.getByTestId('cm-empty')).toContainText('Nenhum dado importado ainda')
  await expect(page.getByTestId('cm-total')).toHaveCount(0)
})

test.describe('com o extrato de compromissos importado', () => {
  test.beforeEach(async ({ page }) => {
    await importar(page)
    await abrir(page)
  })

  test('assinatura internacional: custo mensal = valor + IOF, anual × 12, 6 meses', async ({ page }) => {
    const itens = page.getByTestId('cm-recurring-item')
    await expect(itens).toHaveCount(1)
    await expect(itens.first()).toContainText('Netflix.Com')
    expect(await texto(itens.first().getByTestId('cm-monthly'))).toBe('R$ 46,47/mês') // 44,90 + 1,57 de IOF
    expect(await texto(itens.first().getByTestId('cm-annual'))).toBe('R$ 557,64/ano')
    expect(await texto(itens.first().getByTestId('cm-months'))).toBe('6 meses')
  })

  test('pedágio (várias vezes por mês) não é assinatura; compra avulsa também não', async ({ page }) => {
    const recorrentes = page.getByTestId('cm-recurring')
    await expect(recorrentes).not.toContainText('NuTag')
    await expect(recorrentes).not.toContainText('Loja Avulsa')
    await expect(recorrentes).not.toContainText('Loja Parcelada') // parcela não é recorrente
  })

  test('assinatura que parou fica recolhida em "Parados"', async ({ page }) => {
    await expect(page.getByTestId('cm-recurring')).not.toContainText('Spotify')
    const alternar = page.getByTestId('cm-inactive-toggle')
    await expect(alternar).toContainText('Parados (1)')
    await expect(page.getByTestId('cm-inactive-list')).toHaveCount(0)
    await alternar.click()
    const parado = page.getByTestId('cm-inactive-item')
    await expect(parado).toHaveCount(1)
    expect(await texto(parado)).toContain('Spotify')
    expect(await texto(parado)).toContain('parou em 07/2026')
    expect(await texto(parado)).toContain('R$ 21,90/mês')
  })

  test('parcelas em aberto: 4/6 · faltam 2 · valor restante até o mês final', async ({ page }) => {
    const itens = page.getByTestId('cm-installment-item')
    await expect(itens).toHaveCount(1)
    await expect(itens.first()).toContainText('Loja Parcelada')
    expect(await texto(itens.first().getByTestId('cm-installment-text'))).toBe('4/6 · faltam 2 · R$ 501,32 até dez/2026')
    await expect(itens.first()).toContainText('R$ 250,66 por mês')
  })

  test('comprometido por mês = recorrentes ativos + parcelas do próximo mês, com o gráfico dos 12 meses', async ({ page }) => {
    expect(await texto(page.getByTestId('cm-total'))).toBe('R$ 297,13') // 46,47 + 250,66
    expect(await texto(page.getByTestId('cm-total-detail'))).toBe('novembro/2026: recorrentes R$ 46,47 + parcelas R$ 250,66')
    await expect(page.getByTestId('cm-chart').locator('canvas')).toBeVisible()
  })

  test('custos bancários: IOF, Encargos, Tarifas e total (12 meses)', async ({ page }) => {
    expect(await texto(page.getByTestId('cm-bank-iof'))).toContain('R$ 9,42') // 6 × 1,57
    expect(await texto(page.getByTestId('cm-bank-encargos'))).toContain('R$ 19,75')
    expect(await texto(page.getByTestId('cm-bank-tarifas'))).toContain('R$ 0,00')
    expect(await texto(page.getByTestId('cm-bank-total'))).toContain('R$ 29,17')
  })

  test('tocar em IOF abre os lançamentos da categoria', async ({ page }) => {
    await page.getByTestId('cm-bank-iof').click()
    await expect(page).toHaveURL(/\/lancamentos$/)
    await expect(page.getByTestId('filter-chip')).toHaveText(['Categoria: IOF ×'])
    await expect(rows(page)).toHaveCount(6)
  })

  test('"Não é recorrente" tira o item e o valor do total, sobrevive ao recarregar e desfaz em Configurações', async ({ page }) => {
    await page.getByTestId('cm-recurring-item').first().getByTestId('cm-not-recurring').click()
    await expect(page.getByTestId('cm-recurring-item')).toHaveCount(0)
    await expect(page.getByTestId('cm-recurring-empty')).toBeVisible()
    expect(await texto(page.getByTestId('cm-total'))).toBe('R$ 250,66') // só a parcela
    await expect.poll(async () => (await idbGet(page, 'fluxo:settings'))?.ignoredRecurring).toEqual(['netflix.com'])

    await page.reload()
    await waitAppReady(page)
    await expect(page.getByTestId('cm-total')).toBeVisible()
    await expect(page.getByTestId('cm-recurring-item')).toHaveCount(0)

    await page.getByTestId('settings-link').click()
    await expect(page.getByTestId('ignored-item')).toContainText('netflix.com')
    await page.getByTestId('ignored-undo').click()
    await expect(page.getByTestId('ignored-empty')).toBeVisible()
    await expect.poll(async () => (await idbGet(page, 'fluxo:settings'))?.ignoredRecurring).toEqual([]) // gravado antes de recarregar
    await abrir(page)
    await expect(page.getByTestId('cm-recurring-item')).toHaveCount(1)
    expect(await texto(page.getByTestId('cm-total'))).toBe('R$ 297,13')
  })

  test('card no Dashboard Pessoal abre a tela', async ({ page }) => {
    await page.goto('/dashboard')
    await waitAppReady(page)
    await expect(page.getByTestId('pf-month-label')).toBeVisible()
    expect(await texto(page.getByTestId('cm-card'))).toBe('Compromissos: R$ 297,13/mês · ver')
    await page.getByTestId('cm-card').click()
    await expect(page).toHaveURL(/\/compromissos$/)
    await expect(page.getByTestId('cm-total')).toBeVisible()
  })

  test('sem rolagem horizontal', async ({ page }) => {
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    expect(sw).toBeLessThanOrEqual(iw)
  })
})
