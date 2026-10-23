import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { FIXED_NOW } from './helpers/importFixture.js'
import { dropFile } from './helpers/dropFile.js'
import { waitAppReady } from './helpers/appReady.js'
import { abrirLancamentos, rows, openDetail, detailField } from './helpers/lancamentos.js'

const CONTA = 'tests/fixtures/nubank_conta.csv'
const CARTAO = 'tests/fixtures/nubank_cartao.csv'
const CARTAO_CATEGORIA = 'tests/fixtures/nubank_cartao_categoria.csv'

const result = page => page.getByTestId('import-result')
const error = page => page.getByTestId('import-error')
const selo = (page, descricao) => rows(page).filter({ hasText: descricao }).getByTestId('type-badge')

async function importarNubank(page, arquivo) {
  await page.locator('[data-testid="source-input-nubank"]').setInputFiles(arquivo)
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto('/importacoes')
  await waitAppReady(page)
})

test('Card Nubank está disponível e aceita .csv', async ({ page }) => {
  await expect(page.getByTestId('source-card-nubank')).not.toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByTestId('source-card-nubank')).toContainText('Extrato da conta ou fatura do cartão (CSV)')
  await expect(page.getByTestId('source-input-nubank')).toHaveAttribute('accept', '.csv')
})

test('Importar extrato da conta', async ({ page }) => {
  await importarNubank(page, CONTA)
  await expect(result(page)).toContainText('5 lançamentos importados')
  await expect(result(page)).toContainText('Linha 7 ignorada: data inválida')
  await abrirLancamentos(page)
  await expect(rows(page)).toHaveCount(5)
  await expect(selo(page, 'recebida pelo Pix')).toHaveText('Entrada')
  await expect(selo(page, 'enviada pelo Pix')).toHaveText('Saída')
})

test('Importar fatura do cartão', async ({ page }) => {
  await importarNubank(page, CARTAO)
  await expect(result(page)).toContainText('5 lançamentos importados')
  await abrirLancamentos(page)
  await expect(selo(page, 'Supermercado Bom Preço')).toHaveText('Saída')
  await expect(selo(page, 'Restaurante Sabor')).toHaveText('Saída')
  await expect(selo(page, 'Pagamento recebido')).toHaveText('Entrada')
  await expect(selo(page, 'Estorno Cinema')).toHaveText('Entrada')
  await expect(rows(page).filter({ hasText: 'Loja X - Parcela 2/10' })).toHaveCount(1)
})

test('Cartão com categoria do Nubank', async ({ page }) => {
  await importarNubank(page, CARTAO_CATEGORIA)
  await expect(result(page)).toContainText('3 lançamentos importados')
  await abrirLancamentos(page)
  await openDetail(page, 'Hortifruti Central')
  await expect(detailField(page, 'Categoria')).toHaveText('mercado')
})

test('Reimportar extrato da conta', async ({ page }) => {
  await importarNubank(page, CONTA)
  await expect(result(page)).toContainText('5 lançamentos importados')
  await importarNubank(page, CONTA)
  await expect(result(page)).toContainText('0 lançamentos importados · 5 duplicatas ignoradas')
  await abrirLancamentos(page)
  await expect(rows(page)).toHaveCount(5)
})

test('CSV com cabeçalho desconhecido no card Nubank é recusado', async ({ page }) => {
  // buffer em vez de caminho: o diretório de saída deste teste tem acento no nome e o seletor não dispara change
  await importarNubank(page, { name: 'desconhecido.csv', mimeType: 'text/csv', buffer: Buffer.from('a;b\n1;2\n') })
  await expect(error(page)).toContainText('CSV não reconhecido')
  await expect(result(page)).toBeHidden()
})

test.describe('Computador', () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, 'cenário de computador'))

  test('Arrastar um .csv em qualquer lugar detecta o Nubank', async ({ page }) => {
    await dropFile(page, 'main', CONTA)
    await expect(result(page)).toContainText('5 lançamentos importados')
  })

  test('CSV desconhecido arrastado na página', async ({ page }, testInfo) => {
    const csv = testInfo.outputPath('extrato.csv')
    writeFileSync(csv, 'a;b\n1;2\n')
    await dropFile(page, 'main', csv)
    await expect(error(page)).toContainText('CSV não reconhecido')
    await expect(result(page)).toBeHidden()
  })
})
