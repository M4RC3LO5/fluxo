import { test, expect } from '@playwright/test'
import { FIXED_NOW } from './helpers/importFixture.js'
import { dropFile } from './helpers/dropFile.js'
import { waitAppReady } from './helpers/appReady.js'
import { abrirLancamentos, rows, openDetail, detailField, closeDetail } from './helpers/lancamentos.js'

const EXTRATO = 'tests/fixtures/mercadopago_extrato.pdf'
const ERRADOS = 'tests/fixtures/mercadopago_totais_errados.pdf'
const OUTRO_BANCO = 'tests/fixtures/pdf_outro_banco.pdf'
const SEM_TEXTO = 'tests/fixtures/pdf_sem_texto.pdf'

const result = page => page.getByTestId('import-result')
const error = page => page.getByTestId('import-error')
const selo = (page, descricao) => rows(page).filter({ hasText: descricao }).getByTestId('type-badge')
const LONGO = 15000 // o pdfjs e o worker são baixados na primeira leitura de PDF

const importar = (page, arquivo) => page.locator('[data-testid="source-input-mercadopago"]').setInputFiles(arquivo)

async function categoriaDe(page, descricao) {
  await openDetail(page, descricao)
  const categoria = await detailField(page, 'Categoria').innerText()
  await closeDetail(page)
  return categoria
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto('/importacoes')
  await waitAppReady(page)
})

test('Card Mercado Pago está disponível e aceita .pdf', async ({ page }) => {
  await expect(page.getByTestId('source-card-mercadopago')).not.toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByTestId('source-card-mercadopago')).toContainText('Extrato da conta (PDF)')
  await expect(page.getByTestId('source-input-mercadopago')).toHaveAttribute('accept', '.pdf')
})

test('Importar extrato', async ({ page }) => {
  await importar(page, EXTRATO)
  await expect(result(page)).toContainText('12 lançamentos importados', { timeout: LONGO })
  await expect(page.getByTestId('import-period')).toContainText('01/10/2026 a 31/10/2026')
  await abrirLancamentos(page)
  await expect(rows(page)).toHaveCount(12)
})

test('Descrição quebrada entre páginas', async ({ page }) => {
  await importar(page, EXTRATO)
  await expect(result(page)).toContainText('12 lançamentos importados', { timeout: LONGO })
  await abrirLancamentos(page)
  await expect(rows(page).filter({ hasText: 'Pagamento com Pix Restaurante Sabor da Serra Unidade Centro Mesa 12' })).toHaveCount(1)
  await expect(rows(page).filter({ hasText: 'Pagamento com Pix Padaria Pao Quente Ltda Filial 02' })).toHaveCount(1) // 3 linhas
})

test('Transferências e rendimentos', async ({ page }) => {
  await importar(page, EXTRATO)
  await expect(result(page)).toContainText('12 lançamentos importados', { timeout: LONGO })
  await abrirLancamentos(page)

  await expect(selo(page, 'Pix recebido Marina Exemplo Santos')).toHaveText('Transferência')
  await expect(selo(page, 'Pagamento de fatura')).toHaveText('Transferência')
  await expect(selo(page, 'Dinheiro retirado Reserva Viagem')).toHaveText('Transferência')
  await expect(selo(page, 'Pix recebido Carlos Terceiro Lima')).toHaveText('Entrada')
  await expect(selo(page, 'Pix enviado Joao Prestador Servicos')).toHaveText('Saída')

  const rendimentos = rows(page).filter({ hasText: 'Rendimentos' })
  await expect(rendimentos).toHaveCount(2)
  await expect(rendimentos.first().getByTestId('type-badge')).toHaveText('Entrada')
  expect(await categoriaDe(page, 'Pagamento de fatura')).toBe('Pagamento de fatura')
  expect(await categoriaDe(page, 'Pix recebido Marina Exemplo Santos')).toBe('Transferência entre contas')
  await rendimentos.first().click()
  await expect(detailField(page, 'Categoria')).toHaveText('Rendimentos')
})

test('Extrato que não confere', async ({ page }) => {
  await importar(page, ERRADOS)
  await expect(error(page)).toContainText('Extrato não conferiu: Saldo final, esperado R$ 9.999,99, calculado R$ 2.153,36', { timeout: LONGO })
  await expect(error(page)).toContainText('Nada foi importado')
  await expect(result(page)).toBeHidden()
  await expect(page.getByText('Histórico de Importações')).toBeHidden()
  await abrirLancamentos(page)
  await expect(page.getByText('0 de 0 registros')).toBeVisible()
})

test('Reimportar', async ({ page }) => {
  await importar(page, EXTRATO)
  await expect(result(page)).toContainText('12 lançamentos importados', { timeout: LONGO })
  await importar(page, EXTRATO)
  await expect(result(page)).toContainText('0 lançamentos importados · 12 duplicatas ignoradas', { timeout: LONGO })
  await abrirLancamentos(page)
  await expect(rows(page)).toHaveCount(12)
})

test('PDF escaneado, sem texto', async ({ page }) => {
  await importar(page, SEM_TEXTO)
  await expect(error(page)).toContainText('PDF sem texto (imagem escaneada) não é suportado', { timeout: LONGO })
})

test('PDF de outro banco no card Mercado Pago é recusado', async ({ page }) => {
  await importar(page, OUTRO_BANCO)
  await expect(error(page)).toContainText('PDF não reconhecido como extrato do Mercado Pago', { timeout: LONGO })
})

test.describe('Computador', () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, 'cenário de computador'))

  test('Arrastar um .pdf em qualquer lugar detecta o Mercado Pago', async ({ page }) => {
    await dropFile(page, 'main', EXTRATO)
    await expect(result(page)).toContainText('12 lançamentos importados', { timeout: LONGO })
  })

  test('PDF sem as marcas do Mercado Pago arrastado na página', async ({ page }) => {
    await dropFile(page, 'main', OUTRO_BANCO)
    await expect(error(page)).toContainText('PDF não reconhecido', { timeout: LONGO })
    await expect(result(page)).toBeHidden()
  })
})
