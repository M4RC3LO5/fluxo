import { test, expect } from '@playwright/test'
import { FIXTURE, FIXED_NOW } from './helpers/importFixture.js'
import { dropFile } from './helpers/dropFile.js'
import { rows, norm } from './helpers/lancamentos.js'

const card = (page, id) => page.getByTestId(`source-card-${id}`)
const input = (page, id) => page.getByTestId(`source-input-${id}`)
const result = page => page.getByTestId('import-result')
const error = page => page.getByTestId('import-error')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto('/importacoes')
})

test('Clicar no card abre o seletor de arquivo', async ({ page }) => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), card(page, 'xlsx').click()])
  expect(chooser).toBeTruthy()
  await expect(input(page, 'xlsx')).toHaveAttribute('accept', '.xlsx')
})

test('Escolher o arquivo importa sem passos extras', async ({ page }) => {
  await input(page, 'xlsx').setInputFiles(FIXTURE)
  await expect(result(page)).toContainText('15 lançamentos importados')
  await expect(result(page)).toContainText('fluxo_exemplo')
  await expect(result(page).getByRole('link', { name: 'Ver Dashboard' })).toBeVisible()
  await expect(result(page).getByRole('link', { name: 'Ver Lançamentos' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Importar$/ })).toHaveCount(0) // sem botão "Importar"
})

test('Ir para lançamentos após importar', async ({ page }) => {
  await input(page, 'xlsx').setInputFiles(FIXTURE)
  await result(page).getByRole('link', { name: 'Ver Lançamentos' }).click()
  await expect(page).toHaveURL(/\/lancamentos$/)
  await expect(page.getByText('15 de 15 registros')).toBeVisible()
  await expect(rows(page)).toHaveCount(15)
})

test('Arquivo com extensão errada é recusado', async ({ page }) => {
  await input(page, 'xlsx').setInputFiles({ name: 'extrato.csv', mimeType: 'text/csv', buffer: Buffer.from('a;b') })
  await expect(error(page)).toContainText('Arquivo .csv não é aceito pela fonte Planilha Excel. Envie um .xlsx.')
  await expect(result(page)).toBeHidden()
  await expect(page.getByText('Histórico de Importações')).toBeHidden() // nada foi importado
})

for (const [nome, id] of [['Mercado Pago', 'mercadopago'], ['Santander', 'santander']]) {
  test(`Fontes ainda não disponíveis: ${nome}`, async ({ page }) => {
    await expect(card(page, id)).toContainText('Em breve')
    await expect(card(page, id)).toHaveAttribute('aria-disabled', 'true')
    let abriu = false
    page.on('filechooser', () => { abriu = true })
    await card(page, id).click()
    await page.waitForTimeout(500)
    expect(abriu).toBe(false)
  })
}

test.describe('Computador', () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, 'cenário de computador'))

  test('Arrastar o arquivo sobre o card importa', async ({ page }) => {
    await dropFile(page, '[data-testid="source-card-xlsx"]', FIXTURE, { drop: false })
    await expect(card(page, 'xlsx')).toHaveClass(/border-brand-400/) // destaque durante o dragover
    await dropFile(page, '[data-testid="source-card-xlsx"]', FIXTURE)
    await expect(result(page)).toContainText('15 lançamentos importados')
  })

  test('Arrastar o arquivo em qualquer lugar detecta a fonte', async ({ page }) => {
    await dropFile(page, 'main', FIXTURE, { drop: false })
    await expect(page.getByTestId('drop-overlay')).toContainText('Solte para importar')
    await dropFile(page, 'main', FIXTURE)
    await expect(result(page)).toContainText('15 lançamentos importados')
    await expect(page.getByTestId('drop-overlay')).toBeHidden()
  })
})

test.describe('Celular', () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'cenário de celular'))

  test('Celular orienta o toque e não rola para os lados', async ({ page }) => {
    await expect(card(page, 'xlsx').getByText('Toque para escolher o arquivo')).toBeVisible()
    await expect(card(page, 'xlsx').getByText('Clique ou arraste o arquivo aqui')).toBeHidden()
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    expect(sw).toBeLessThanOrEqual(iw)
  })
})
