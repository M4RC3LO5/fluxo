import { test, expect } from '@playwright/test'
import { FIXED_NOW } from './helpers/importFixture.js'
import { waitAppReady } from './helpers/appReady.js'
import { idbGet } from './helpers/idb.js'
import { abrirLancamentos, rows, closeDetail, detailModal } from './helpers/lancamentos.js'

const MP = 'tests/fixtures/mercadopago_extrato.pdf'
const TRANSF = 'tests/fixtures/nubank_conta_transf.csv'
const LONGO = 15000 // o pdfjs e o worker são baixados na primeira leitura de PDF

const result = page => page.getByTestId('import-result')
const linha = (page, texto) => rows(page).filter({ hasText: texto })
const selo = (page, texto) => linha(page, texto).getByTestId('type-badge')

async function irParaImportacoes(page) {
  await page.goto('/importacoes')
  await waitAppReady(page)
}
async function importarMercadoPago(page) {
  await page.locator('[data-testid="source-input-mercadopago"]').setInputFiles(MP)
  await expect(result(page)).toContainText('12 lançamentos importados', { timeout: LONGO })
}
async function importarNubank(page, arquivo, esperado) {
  await page.locator('[data-testid="source-input-nubank"]').setInputFiles(arquivo)
  await expect(result(page)).toContainText(esperado)
}
async function importarAmbos(page) {
  await irParaImportacoes(page)
  await importarMercadoPago(page)
  await importarNubank(page, TRANSF, '4 lançamentos importados')
}

/** O lançamento gravado no IndexedDB (poll: a gravação é assíncrona). */
const gravado = (page, descricao) => async () => {
  const entries = await idbGet(page, 'fluxo:finance:entries')
  return entries?.find(e => e.description.includes(descricao)) ?? null
}

const kpiTexto = async (page, id) => (await page.getByTestId(id).innerText()).replace(/ /g, ' ')
async function saidasDoDashboard(page) {
  await page.goto('/dashboard')
  await waitAppReady(page)
  await expect(page.getByTestId('pf-month-label')).toHaveText('outubro/2026')
  return kpiTexto(page, 'pf-kpi-out')
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
})

test('Titular aprendido do PDF aparece em Configurações', async ({ page }) => {
  await irParaImportacoes(page)
  await importarMercadoPago(page)
  await page.getByTestId('settings-link').click()
  await expect(page).toHaveURL(/\/configuracoes$/)
  await expect(page.getByTestId('holder-name')).toHaveCount(1)
  await expect(page.getByTestId('holder-name')).toContainText('Marina Exemplo Santos')
})

test('Pix para conta própria é detectado pelo nome e sai das Saídas', async ({ page }) => {
  await irParaImportacoes(page)
  await importarMercadoPago(page)
  const antes = await saidasDoDashboard(page)
  expect(antes).toContain('R$ 613,20')

  await irParaImportacoes(page)
  await importarNubank(page, TRANSF, '4 lançamentos importados')
  await abrirLancamentos(page)
  await expect(selo(page, 'enviada pelo Pix - Marina Exemplo Santos')).toHaveText('Transferência')
  await expect(selo(page, 'PAULO PRESTADOR')).toHaveText('Saída')
  await expect(selo(page, 'Padaria Doce')).toHaveText('Saída')

  // 123,45 + 50,00 de saídas novas; os 500,00 do titular (e os 1.200,00 pareados) ficaram de fora
  expect(await saidasDoDashboard(page)).toContain('R$ 786,65')
})

test('Pix pareado entre contas: Nubank × Mercado Pago, mesmo dia e valor', async ({ page }) => {
  await importarAmbos(page)
  await abrirLancamentos(page)
  await expect(selo(page, 'CONTA SEM NOME')).toHaveText('Transferência')
  await expect(selo(page, 'Pix recebido Carlos Terceiro Lima')).toHaveText('Transferência') // era Entrada

  await linha(page, 'CONTA SEM NOME').click()
  await expect(page.getByTestId('transfer-info')).toContainText('pareada com Mercado Pago em 03/10')
  await closeDetail(page)
  await linha(page, 'Pix recebido Carlos Terceiro Lima').click()
  await expect(page.getByTestId('transfer-info')).toContainText('pareada com Nubank em 03/10')
})

test('Detectada por nome: o detalhe diz como e "Não é transferência" desfaz de vez', async ({ page }) => {
  await importarAmbos(page)
  await abrirLancamentos(page)
  await linha(page, 'enviada pelo Pix - Marina Exemplo Santos').click()
  await expect(page.getByTestId('transfer-info')).toContainText('detectada por nome')
  await page.getByTestId('transfer-undo').click()
  await expect(page.getByTestId('transfer-info')).toHaveCount(0)
  await expect(page.getByTestId('transfer-mark')).toBeVisible() // dá para marcar de novo
  await closeDetail(page)
  await expect(selo(page, 'enviada pelo Pix - Marina Exemplo Santos')).toHaveText('Saída')

  // gravado como "manual"
  await expect.poll(async () => (await gravado(page, 'Marina Exemplo Santos - •••')())?.transferSource).toBe('manual')

  await page.reload()
  await waitAppReady(page)
  await abrirLancamentos(page)
  await expect(selo(page, 'enviada pelo Pix - Marina Exemplo Santos')).toHaveText('Saída')

  // nova importação (tudo duplicado) reavalia as transferências, mas respeita a escolha
  await irParaImportacoes(page)
  await importarNubank(page, TRANSF, '0 lançamentos importados · 4 duplicatas ignoradas')
  await abrirLancamentos(page)
  await expect(selo(page, 'enviada pelo Pix - Marina Exemplo Santos')).toHaveText('Saída')
})

test('Desfazer um par desfaz os dois lados', async ({ page }) => {
  await importarAmbos(page)
  await abrirLancamentos(page)
  await linha(page, 'CONTA SEM NOME').click()
  await page.getByTestId('transfer-undo').click()
  await closeDetail(page)
  await expect(selo(page, 'CONTA SEM NOME')).toHaveText('Saída')
  await expect(selo(page, 'Pix recebido Carlos Terceiro Lima')).toHaveText('Entrada') // o Mercado Pago volta a ser Entrada
})

test('Marcar um Pix de terceiro como transferência tira das Saídas', async ({ page }) => {
  await importarAmbos(page)
  expect(await saidasDoDashboard(page)).toContain('R$ 786,65')

  await abrirLancamentos(page)
  await linha(page, 'PAULO PRESTADOR').click()
  await expect(page.getByTestId('transfer-undo')).toHaveCount(0)
  await page.getByTestId('transfer-mark').click()
  await expect(page.getByTestId('transfer-info')).toContainText('marcada por você')
  await closeDetail(page)
  await expect(selo(page, 'PAULO PRESTADOR')).toHaveText('Transferência')
  await expect.poll(async () => (await gravado(page, 'PAULO PRESTADOR')())?.transferSource).toBe('manual')

  expect(await saidasDoDashboard(page)).toContain('R$ 663,20') // 786,65 − 123,45
})

test('Transferência do banco não tem botões; compra comum também não', async ({ page }) => {
  await importarAmbos(page)
  await abrirLancamentos(page)
  await linha(page, 'Pagamento de fatura').click()
  await expect(detailModal(page)).toBeVisible()
  await expect(page.getByTestId('transfer-undo')).toHaveCount(0)
  await expect(page.getByTestId('transfer-mark')).toHaveCount(0)
  await expect(page.getByTestId('transfer-info')).toHaveCount(0)
  await closeDetail(page)
  await linha(page, 'Padaria Doce').click() // sem Pix/TED na descrição
  await expect(page.getByTestId('transfer-mark')).toHaveCount(0)
})

test.describe('Configurações', () => {
  test('adicionar o nome do titular marca os Pix próprios; remover desfaz', async ({ page }) => {
    await irParaImportacoes(page)
    await importarNubank(page, TRANSF, '4 lançamentos importados') // o CSV do Nubank não traz o titular
    await abrirLancamentos(page)
    await expect(selo(page, 'enviada pelo Pix - Marina Exemplo Santos')).toHaveText('Saída')

    await page.getByTestId('settings-link').click()
    await expect(page.getByTestId('holder-empty')).toBeVisible()
    await page.getByTestId('holder-input').fill('Marina Exemplo Santos Pereira')
    await page.getByTestId('holder-add').click()
    await expect(page.getByTestId('holder-name')).toContainText('Marina Exemplo Santos Pereira')
    await expect(page.getByTestId('holder-status')).toContainText('1 lançamento reavaliado')

    await abrirLancamentos(page)
    await expect(selo(page, 'enviada pelo Pix - Marina Exemplo Santos')).toHaveText('Transferência')

    await page.getByTestId('settings-link').click()
    await page.getByTestId('holder-remove').click()
    await expect(page.getByTestId('holder-empty')).toBeVisible()
    await abrirLancamentos(page)
    await expect(selo(page, 'enviada pelo Pix - Marina Exemplo Santos')).toHaveText('Saída')
  })

  test('o nome fica gravado e não duplica', async ({ page }) => {
    await page.goto('/configuracoes')
    await waitAppReady(page)
    await page.getByTestId('holder-input').fill('Fulano de Tal Silva')
    await page.getByTestId('holder-add').click()
    await page.getByTestId('holder-input').fill('FULANO  DE TAL SILVA')
    await page.getByTestId('holder-add').click()
    await expect(page.getByTestId('holder-status')).toContainText('já está na lista')
    await expect(page.getByTestId('holder-name')).toHaveCount(1)
    await page.reload()
    await waitAppReady(page)
    await expect(page.getByTestId('holder-name')).toContainText('Fulano de Tal Silva')
  })

  test('sem rolagem horizontal', async ({ page }) => {
    await page.goto('/configuracoes')
    await waitAppReady(page)
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    expect(sw).toBeLessThanOrEqual(iw)
  })
})
