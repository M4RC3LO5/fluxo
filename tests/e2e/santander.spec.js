import { test, expect } from '@playwright/test'
import { FIXED_NOW } from './helpers/importFixture.js'
import { dropFile } from './helpers/dropFile.js'
import { waitAppReady } from './helpers/appReady.js'
import { abrirLancamentos, rows, openDetail, detailField, closeDetail } from './helpers/lancamentos.js'

const EXTRATO = 'tests/fixtures/santander_extrato.pdf'
const ERRADOS = 'tests/fixtures/santander_totais_errados.pdf'
const SALDO_ZERO = 'tests/fixtures/santander_saldo_zero.pdf'
const OUTRO_BANCO = 'tests/fixtures/pdf_outro_banco.pdf'

const result = page => page.getByTestId('import-result')
const error = page => page.getByTestId('import-error')
const linha = (page, texto) => rows(page).filter({ hasText: texto })
const selo = (page, texto) => linha(page, texto).getByTestId('type-badge')
const LONGO = 15000 // o pdfjs e o worker são baixados na primeira leitura de PDF

const importar = (page, arquivo) => page.locator('[data-testid="source-input-santander"]').setInputFiles(arquivo)

async function categoriaDe(page, texto) {
  await openDetail(page, texto)
  const categoria = await detailField(page, 'Categoria').innerText()
  await closeDetail(page)
  return categoria
}

async function importarEAbrir(page) {
  await importar(page, EXTRATO)
  await expect(result(page)).toContainText('12 lançamentos importados', { timeout: LONGO })
  await abrirLancamentos(page)
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto('/importacoes')
  await waitAppReady(page)
})

test('Card Santander está disponível e aceita .pdf', async ({ page }) => {
  await expect(page.getByTestId('source-card-santander')).not.toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByTestId('source-card-santander')).toContainText('Extrato consolidado mensal (PDF)')
  await expect(page.getByTestId('source-input-santander')).toHaveAttribute('accept', '.pdf')
})

test('Importar extrato consolidado', async ({ page }) => {
  await importar(page, EXTRATO)
  await expect(result(page)).toContainText('12 lançamentos importados', { timeout: LONGO })
  await expect(page.getByTestId('import-month')).toContainText('janeiro/2026')
  await abrirLancamentos(page)
  await expect(rows(page)).toHaveCount(12)
})

test('Data herdada no mesmo dia', async ({ page }) => {
  await importarEAbrir(page)
  // 05/01: o Pix enviado traz a data; a remuneração logo abaixo herda
  await expect(linha(page, 'PIX ENVIADO OPEN FINANCE')).toContainText('05/01/2026')
  await expect(linha(page, 'REMUNERACAO APLICACAO AUTOMATICA')).toContainText('05/01/2026')
  // 20/01: três movimentos, só o primeiro com data impressa
  await expect(linha(page, 'PAGAMENTO IPVA-CANAIS')).toContainText('20/01/2026')
  await expect(linha(page, 'PIX RECEBIDO - ANA CLIENTE SILVA')).toContainText('20/01/2026')
})

test('Débito automático não duplica', async ({ page }) => {
  await importarEAbrir(page)
  await expect(linha(page, 'DEBITO AUT. TELEFONE CELULAR - VIVO MOVEL-SP')).toHaveCount(1)
})

test('Descrição que continua na página seguinte', async ({ page }) => {
  await importarEAbrir(page)
  await expect(linha(page, 'TARIFA MENSAL PACOTE - SERVICOS')).toHaveCount(1)
})

test('Transferência entre contas próprias', async ({ page }) => {
  await importarEAbrir(page)
  const proprios = linha(page, 'MARINA EXEMPLO SANTOS PER')
  await expect(proprios).toHaveCount(3)
  await expect(proprios.getByTestId('type-badge')).toHaveText(['Transferência', 'Transferência', 'Transferência'])
  await expect(selo(page, 'PIX RECEBIDO - CARLOS TERCEIRO LIMA')).toHaveText('Entrada')
  await expect(selo(page, 'PIX RECEBIDO - ANA CLIENTE SILVA')).toHaveText('Entrada')
})

test('Categorias das linhas especiais', async ({ page }) => {
  await importarEAbrir(page)
  expect(await categoriaDe(page, 'TARIFA MENSAL PACOTE')).toBe('Tarifas bancárias')
  expect(await categoriaDe(page, 'IOF OPERACAO CREDITO')).toBe('Encargos')
  expect(await categoriaDe(page, 'JUROS CHEQUE ESPECIAL')).toBe('Encargos')
  expect(await categoriaDe(page, 'REMUNERACAO APLICACAO AUTOMATICA')).toBe('Rendimentos')
  expect(await categoriaDe(page, 'OPERACOES CREDITO IMOBILIARIO')).toBe('Financiamento imobiliário')
  expect(await categoriaDe(page, 'PIX ENVIADO OPEN FINANCE')).toBe('Transferência entre contas')
})

test('Extrato que não confere', async ({ page }) => {
  await importar(page, ERRADOS)
  await expect(error(page)).toContainText('Extrato não conferiu: Total de Débitos, esperado R$ 6.718,78, calculado R$ 6.774,73', { timeout: LONGO })
  await expect(error(page)).toContainText('Nada foi importado')
  await expect(result(page)).toBeHidden()
  await expect(page.getByText('Histórico de Importações')).toBeHidden()
  await abrirLancamentos(page)
  await expect(page.getByText('0 de 0 registros')).toBeVisible()
})

test('Extrato que fecha com saldo zero', async ({ page }) => {
  await importar(page, SALDO_ZERO)
  await expect(result(page)).toContainText('13 lançamentos importados', { timeout: LONGO })
  await expect(result(page)).not.toContainText('poupança') // nenhum aviso: a poupança só tem saldos
  await abrirLancamentos(page)
  await expect(rows(page)).toHaveCount(13)
  await expect(linha(page, 'SALDO ATUAL')).toHaveCount(0) // nada da Poupança
  await expect(linha(page, 'TED PARA OUTRA CONTA - EMPRESA EXEMPLO LTDA')).toHaveCount(1)
})

test('Reimportar', async ({ page }) => {
  await importar(page, EXTRATO)
  await expect(result(page)).toContainText('12 lançamentos importados', { timeout: LONGO })
  await importar(page, EXTRATO)
  await expect(result(page)).toContainText('0 lançamentos importados · 12 duplicatas ignoradas', { timeout: LONGO })
  await abrirLancamentos(page)
  await expect(rows(page)).toHaveCount(12)
})

test('PDF de outro banco no card Santander é recusado', async ({ page }) => {
  await importar(page, OUTRO_BANCO)
  await expect(error(page)).toContainText('PDF não reconhecido como extrato Santander', { timeout: LONGO })
})

test.describe('Computador', () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, 'cenário de computador'))

  test('Arrastar o PDF em qualquer lugar detecta o Santander', async ({ page }) => {
    await dropFile(page, 'main', EXTRATO)
    await expect(result(page)).toContainText('12 lançamentos importados', { timeout: LONGO })
    await expect(page.getByTestId('import-month')).toContainText('janeiro/2026')
  })
})
