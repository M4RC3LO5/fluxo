import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { FIXED_NOW } from './helpers/importFixture.js'
import { dropFile } from './helpers/dropFile.js'
import { waitAppReady } from './helpers/appReady.js'
import { abrirLancamentos, rows, openDetail, detailField, closeDetail, search } from './helpers/lancamentos.js'

const CONTA = 'tests/fixtures/nubank_conta.csv'
const CARTAO = 'tests/fixtures/nubank_cartao.csv'
const CARTAO_CATEGORIA = 'tests/fixtures/nubank_cartao_categoria.csv'
const ESPECIAIS = 'tests/fixtures/nubank_cartao_especiais.csv'
const SOBREPOSTO = 'tests/fixtures/nubank_cartao_sobreposto.csv'

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
  await expect(result(page)).toContainText('7 lançamentos importados')
  await expect(result(page)).toContainText('Linha 7 ignorada: data inválida')
  await abrirLancamentos(page)
  await expect(rows(page)).toHaveCount(7)
  await expect(selo(page, 'recebida pelo Pix')).toHaveText('Entrada')
  await expect(selo(page, 'enviada pelo Pix')).toHaveText('Saída')
})

test('Importar fatura do cartão', async ({ page }) => {
  await importarNubank(page, CARTAO)
  await expect(result(page)).toContainText('5 lançamentos importados')
  await abrirLancamentos(page)
  await expect(selo(page, 'Supermercado Bom Preço')).toHaveText('Saída')
  await expect(selo(page, 'Restaurante Sabor')).toHaveText('Saída')
  await expect(selo(page, 'Pagamento recebido')).toHaveText('Transferência') // pagamento de fatura não é receita
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
  await expect(result(page)).toContainText('7 lançamentos importados')
  await importarNubank(page, CONTA)
  await expect(result(page)).toContainText('0 lançamentos importados · 7 duplicatas ignoradas')
  await abrirLancamentos(page)
  await expect(rows(page)).toHaveCount(7)
})

async function categoriaDe(page, descricao) {
  await openDetail(page, descricao)
  const categoria = await detailField(page, 'Categoria').innerText()
  await closeDetail(page)
  return categoria
}

test('Pagamento de fatura é transferência', async ({ page }) => {
  await importarNubank(page, ESPECIAIS)
  await expect(result(page)).toContainText('10 lançamentos importados')
  await abrirLancamentos(page)
  await expect(selo(page, 'Pagamento recebido')).toHaveText('Transferência')
  expect(await categoriaDe(page, 'Pagamento recebido')).toBe('Pagamento de fatura')
  await expect(selo(page, 'Saldo em atraso')).toHaveText('Transferência')
  expect(await categoriaDe(page, 'Saldo em atraso')).toBe('Saldo anterior')
})

test('Encargos, IOF e estorno categorizados', async ({ page }) => {
  await importarNubank(page, ESPECIAIS)
  await abrirLancamentos(page)
  for (const d of ['Multa de atraso', 'Juros de atraso', 'IOF de atraso']) expect(await categoriaDe(page, d)).toBe('Encargos')
  expect(await categoriaDe(page, 'IOF de "Loja X"')).toBe('IOF')
  await expect(selo(page, 'Estorno de "Loja Y"')).toHaveText('Entrada')
  expect(await categoriaDe(page, 'Estorno de "Loja Y"')).toBe('Estorno')
})

test('Parcela identificada', async ({ page }) => {
  await importarNubank(page, ESPECIAIS)
  await abrirLancamentos(page)
  await openDetail(page, 'Loja Z - Parcela 2/10')
  await expect(detailField(page, 'Parcelamento')).toHaveText('Parcela 2 de 10')
})

test('Resgate de investimento na conta é transferência', async ({ page }) => {
  await importarNubank(page, CONTA)
  await abrirLancamentos(page)
  await expect(selo(page, 'Resgate RDB')).toHaveText('Transferência')
  await expect(selo(page, 'Aplicação RDB')).toHaveText('Transferência')
  expect(await categoriaDe(page, 'Resgate RDB')).toBe('Investimentos')
})

test('Repetições no mesmo dia somadas por contagem', async ({ page }) => {
  await importarNubank(page, ESPECIAIS)
  await expect(result(page)).toContainText('10 lançamentos importados')
  await importarNubank(page, SOBREPOSTO)
  await expect(result(page)).toContainText('1 lançamento importado · 2 duplicatas ignoradas')
  await abrirLancamentos(page)
  await expect(rows(page).filter({ hasText: 'Pedagio Tag' })).toHaveCount(3)
})

test('Busca por "transferencia" encontra só as transferências', async ({ page }) => {
  await importarNubank(page, ESPECIAIS)
  await abrirLancamentos(page)
  await search(page, 'transferencia')
  await expect(rows(page)).toHaveCount(2)
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
    await expect(result(page)).toContainText('7 lançamentos importados')
  })

  test('CSV desconhecido arrastado na página', async ({ page }, testInfo) => {
    const csv = testInfo.outputPath('extrato.csv')
    writeFileSync(csv, 'a;b\n1;2\n')
    await dropFile(page, 'main', csv)
    await expect(error(page)).toContainText('CSV não reconhecido')
    await expect(result(page)).toBeHidden()
  })
})
