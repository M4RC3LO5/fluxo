import { test, expect } from '@playwright/test'
import { FIXED_NOW } from './helpers/importFixture.js'
import { waitAppReady } from './helpers/appReady.js'
import { dropFile } from './helpers/dropFile.js'
import { idbGet } from './helpers/idb.js'
import { abrirLancamentos, rows, detailField, detailModal, closeDetail } from './helpers/lancamentos.js'

const CARTAO = 'tests/fixtures/nubank_cartao.csv'
const MP = 'tests/fixtures/mercadopago_extrato.pdf'
const MP_ERRADO = 'tests/fixtures/mercadopago_totais_errados.pdf'
const SANTANDER = 'tests/fixtures/santander_extrato.pdf'
const FATURA_CARTAO = 'tests/fixtures/nubank_cartao_fatura.csv'
const FATURA_CONTA = 'tests/fixtures/nubank_conta_fatura.csv'
const RESTITUICAO = 'tests/fixtures/nubank_conta_restituicao.csv'
const LONGO = 30000 // o pdfjs e o worker são baixados na primeira leitura de PDF

const itens = page => page.getByTestId('batch-item')
const total = page => page.getByTestId('batch-total')
const norm = (s) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
const linha = (page, texto) => rows(page).filter({ hasText: texto })
const selo = (page, texto) => linha(page, texto).getByTestId('type-badge')

async function irParaImportacoes(page) {
  await page.goto('/importacoes')
  await waitAppReady(page)
}
async function importarLote(page, arquivos) {
  await irParaImportacoes(page)
  await page.getByTestId('batch-input').setInputFiles(arquivos)
  await expect(total(page)).toBeVisible({ timeout: LONGO })
}
async function importarUm(page, fonte, arquivo, esperado) {
  await irParaImportacoes(page)
  await page.locator(`[data-testid="source-input-${fonte}"]`).setInputFiles(arquivo)
  await expect(page.getByTestId('import-result')).toContainText(esperado)
}
async function saidasDoDashboard(page) {
  await page.goto('/dashboard')
  await waitAppReady(page)
  await expect(page.getByTestId('pf-month-label')).toHaveText('outubro/2026')
  return norm(await page.getByTestId('pf-kpi-out').innerText())
}
/** Abre o detalhe do lançamento e o seletor de categoria. */
async function abrirCategoria(page, descricao) {
  await linha(page, descricao).first().click()
  await page.getByTestId('category-edit').click()
  await expect(page.getByTestId('category-picker')).toBeVisible()
}
const gravado = (page, descricao) => async () => {
  const entries = await idbGet(page, 'fluxo:finance:entries')
  return entries?.find(e => e.description.includes(descricao)) ?? null
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
})

test.describe('Importação em lote', () => {
  test('Importar vários arquivos de uma vez: uma linha por arquivo, total geral e histórico', async ({ page }) => {
    await irParaImportacoes(page)
    await page.getByTestId('batch-input').setInputFiles([CARTAO, MP, SANTANDER])
    await expect(total(page)).toBeVisible({ timeout: LONGO })

    await expect(itens(page)).toHaveCount(3)
    await expect(itens(page).nth(0)).toHaveText('✓ nubank_cartao.csv · 5 importados · 0 duplicatas')
    await expect(itens(page).nth(1)).toHaveText('✓ mercadopago_extrato.pdf · 12 importados · 0 duplicatas')
    await expect(itens(page).nth(2)).toHaveText('✓ santander_extrato.pdf · 12 importados · 0 duplicatas')
    await expect(total(page)).toContainText('29 lançamentos importados')
    await expect(total(page)).toContainText('3 de 3 arquivos')
    await expect(page.getByTestId('batch-progress')).toBeHidden()
    await expect(page.getByTestId('history-row')).toHaveCount(3)

    // reimportar o mesmo lote: tudo vira duplicata, ainda uma linha por arquivo
    await page.getByTestId('batch-input').setInputFiles([CARTAO, MP])
    await expect(itens(page).nth(0)).toHaveText('✓ nubank_cartao.csv · 0 importados · 5 duplicatas', { timeout: LONGO })
    await expect(itens(page).nth(1)).toHaveText('✓ mercadopago_extrato.pdf · 0 importados · 12 duplicatas')
  })

  test('o card também aceita vários arquivos e cada um precisa ser da fonte do card', async ({ page }) => {
    await irParaImportacoes(page)
    await page.locator('[data-testid="source-input-nubank"]').setInputFiles([CARTAO, 'tests/fixtures/nubank_conta.csv', MP])
    await expect(total(page)).toBeVisible({ timeout: LONGO })
    await expect(itens(page).nth(0)).toContainText('✓ nubank_cartao.csv · 5 importados')
    await expect(itens(page).nth(1)).toContainText('✓ nubank_conta.csv')
    await expect(itens(page).nth(2)).toContainText('✗ mercadopago_extrato.pdf')
    await expect(itens(page).nth(2)).toContainText('Mercado Pago')
    await expect(page.getByTestId('history-row')).toHaveCount(2)
  })

  test('Arrastar vários arquivos na página: a fonte de cada um sai do conteúdo', async ({ page }) => {
    await irParaImportacoes(page)
    await dropFile(page, 'main', [CARTAO, MP, SANTANDER])
    await expect(total(page)).toBeVisible({ timeout: LONGO })
    await expect(itens(page)).toHaveCount(3)
    await expect(total(page)).toContainText('29 lançamentos importados')
    const historico = page.getByTestId('history-row')
    await expect(historico).toHaveCount(3)
    await expect(historico.filter({ hasText: 'nubank_cartao.csv' })).toContainText('NUBANK')
    await expect(historico.filter({ hasText: 'mercadopago_extrato.pdf' })).toContainText('MERCADOPAGO')
    await expect(historico.filter({ hasText: 'santander_extrato.pdf' })).toContainText('SANTANDER')
  })

  test('Um arquivo com erro não para o lote', async ({ page }) => {
    await importarLote(page, [MP_ERRADO, CARTAO])
    await expect(itens(page)).toHaveCount(2)
    await expect(itens(page).nth(0)).toContainText('✗ mercadopago_totais_errados.pdf · ')
    await expect(itens(page).nth(0)).toContainText('Extrato não conferiu')
    await expect(itens(page).nth(1)).toHaveText('✓ nubank_cartao.csv · 5 importados · 0 duplicatas')
    await expect(total(page)).toContainText('5 lançamentos importados')
    await expect(total(page)).toContainText('1 de 2 arquivos')
    await expect(total(page)).toContainText('1 falhou')
    await expect(page.getByTestId('history-row')).toHaveCount(1)
  })

  test('arquivo irreconhecível falha sozinho; o aviso de sem categoria leva a Revisar', async ({ page }) => {
    await importarLote(page, [CARTAO, 'tests/fixtures/pdf_outro_banco.pdf'])
    await expect(itens(page).nth(1)).toContainText('✗ pdf_outro_banco.pdf · PDF não reconhecido')
    await expect(page.getByTestId('batch-uncategorized')).toContainText('sem categoria')
    await page.getByTestId('batch-review-link').click()
    await expect(page).toHaveURL(/\/revisar$/)
  })
})

test.describe('Pagamento de fatura', () => {
  test('pareado automaticamente: a saída da conta e o "Pagamento recebido" viram transferência', async ({ page }) => {
    await importarLote(page, [FATURA_CARTAO, FATURA_CONTA])
    await expect(total(page)).toContainText('5 lançamentos importados')

    await abrirLancamentos(page)
    await expect(selo(page, 'Pagamento recebido')).toHaveText('Transferência')
    // só a saída de R$ 1.234,56 pareia; a de R$ 300,00 continua sendo gasto
    await expect(rows(page).filter({ hasText: 'PAGAMENTO TITULO' }).filter({ hasText: '1.234,56' }).getByTestId('type-badge')).toHaveText('Transferência')
    await expect(rows(page).filter({ hasText: 'PAGAMENTO TITULO' }).filter({ hasText: '300,00' }).getByTestId('type-badge')).toHaveText('Saída')

    await rows(page).filter({ hasText: 'PAGAMENTO TITULO' }).filter({ hasText: '1.234,56' }).click()
    await expect(detailField(page, 'Categoria')).toHaveText('Pagamento de fatura')
    await expect(page.getByTestId('transfer-info')).toContainText('pareada com Nubank (cartão)')
    await closeDetail(page)

    // Saídas = Padaria 45,90 + Restaurante 76,50 + o título de R$ 300,00
    expect(await saidasDoDashboard(page)).toContain('422,40')
  })

  test('sem a fatura importada o título continua sendo Saída', async ({ page }) => {
    await importarUm(page, 'nubank', FATURA_CONTA, '3 lançamentos importados')
    expect(await saidasDoDashboard(page)).toContain('1.580,46')
  })

  test('marcar manualmente como "Pagamento de fatura" tira da lista de Saídas', async ({ page }) => {
    await importarUm(page, 'nubank', FATURA_CONTA, '3 lançamentos importados')
    await abrirLancamentos(page)
    await abrirCategoria(page, '1.234,56')

    const secao = page.getByTestId('category-not-expense')
    await expect(secao).toContainText('Não é gasto')
    await expect(secao.getByTestId('category-not-expense-option')).toHaveText([/Pagamento de fatura/, /Transferência entre contas/, /Investimentos/])
    await expect(secao).toContainText('use quando as compras do cartão já estão importadas')
    await secao.getByTestId('category-not-expense-option').filter({ hasText: 'Pagamento de fatura' }).click()
    // o lançamento já virou transferência, mas o passo "ensinar" continua montado
    await expect(page.getByTestId('category-rule')).toBeVisible()
    await page.getByTestId('rule-only-this').click()
    await expect(page.getByTestId('category-rule')).toBeHidden()
    await expect(page.getByTestId('transfer-info')).toContainText('marcada por você')
    await closeDetail(page)

    await expect(selo(page, '1.234,56')).toHaveText('Transferência')
    await expect.poll(async () => (await gravado(page, 'PAGAMENTO TITULO')())?.transferSource).toBe('manual')
    // Saídas = 45,90 + 300,00
    expect(await saidasDoDashboard(page)).toContain('345,90')
  })

  test('regra para "Não é gasto": vale para os próximos e remover a regra desfaz só o dela', async ({ page }) => {
    await importarUm(page, 'nubank', FATURA_CONTA, '3 lançamentos importados')
    await abrirLancamentos(page)
    await abrirCategoria(page, '1.234,56')
    await page.getByTestId('category-not-expense-option').filter({ hasText: 'Pagamento de fatura' }).click()
    await expect(page.getByTestId('rule-pattern')).toHaveValue('pagamento titulo')
    await expect(page.getByTestId('rule-impact')).toHaveText('1 lançamento existente será atualizado')
    await page.getByTestId('rule-create').click()
    await expect(page.getByTestId('category-rule')).toBeHidden()
    await closeDetail(page)

    await expect(selo(page, 'PAGAMENTO TITULO')).toHaveText(['Transferência', 'Transferência'])
    await expect.poll(async () => (await gravado(page, '300,00')) ?? 'x').toBeTruthy()

    await page.getByTestId('settings-link').click()
    await expect(page.getByTestId('rule-item')).toContainText('pagamento titulo')
    await expect(page.getByTestId('rule-item')).toContainText('(não é gasto)')
    await expect(page.getByTestId('rule-matches')).toHaveText('casa 1 lançamento hoje') // a escolhida à mão não conta
    await page.getByTestId('rule-remove').click()
    await expect(page.getByTestId('rules-status')).toContainText('1 lançamento recalculado')

    await abrirLancamentos(page)
    // a de R$ 300,00 (só da regra) volta a ser Saída; a escolhida à mão continua transferência
    await expect(rows(page).filter({ hasText: 'PAGAMENTO TITULO' }).filter({ hasText: '300,00' }).getByTestId('type-badge')).toHaveText('Saída')
    await expect(rows(page).filter({ hasText: 'PAGAMENTO TITULO' }).filter({ hasText: '1.234,56' }).getByTestId('type-badge')).toHaveText('Transferência')
  })

  test('"Não é transferência" vale também para a transferência de regra', async ({ page }) => {
    await importarUm(page, 'nubank', FATURA_CONTA, '3 lançamentos importados')
    await abrirLancamentos(page)
    await abrirCategoria(page, '1.234,56')
    await page.getByTestId('category-not-expense-option').filter({ hasText: 'Investimentos' }).click()
    await page.getByTestId('rule-create').click()
    await expect(page.getByTestId('category-rule')).toBeHidden()
    await closeDetail(page)

    await linha(page, '300,00').click()
    await expect(page.getByTestId('transfer-info')).toContainText('marcado por uma regra sua')
    await page.getByTestId('transfer-undo').click()
    await expect(detailModal(page).getByTestId('transfer-info')).toBeHidden()
    await closeDetail(page)
    await expect(rows(page).filter({ hasText: 'PAGAMENTO TITULO' }).filter({ hasText: '300,00' }).getByTestId('type-badge')).toHaveText('Saída')
  })
})

test.describe('Categorias próprias', () => {
  test('criar "Restituição de IR" na entrada: fica no lançamento e em Minhas categorias, e sobrevive ao recarregar', async ({ page }) => {
    await importarUm(page, 'nubank', RESTITUICAO, '1 lançamento importado')
    await abrirLancamentos(page)
    await abrirCategoria(page, 'Receita Federal')

    // o catálogo padrão já traz "Restituição de impostos"; a própria é outra
    await page.getByTestId('category-new').click()
    await page.getByTestId('category-new-name').fill('restituição de impostos')
    await page.getByTestId('category-new-create').click()
    await expect(page.getByTestId('category-new-error')).toContainText('Já existe')

    await page.getByTestId('category-new-name').fill('Restituição de IR')
    await page.getByTestId('category-new-create').click()
    await expect(page.getByTestId('category-rule')).toBeVisible()
    await expect(page.getByTestId('category-chosen')).toHaveText('Restituição de IR')
    await page.getByTestId('rule-only-this').click()
    await expect(page.getByTestId('category-rule')).toBeHidden()
    await expect(detailField(page, 'Categoria')).toHaveText('Restituição de IR')
    await closeDetail(page)

    await page.reload()
    await waitAppReady(page)
    await page.getByTestId('settings-link').click()
    await expect(page.getByTestId('custom-category-name')).toHaveText('Restituição de IR')
    await abrirLancamentos(page)
    await abrirCategoria(page, 'Receita Federal')
    await page.getByTestId('category-search').fill('IR')
    await expect(page.getByTestId('category-option').filter({ hasText: 'Restituição de IR' })).toBeVisible()
  })

  test('Configurações: renomear atualiza o lançamento e remover é bloqueado enquanto algo usa', async ({ page }) => {
    await importarUm(page, 'nubank', RESTITUICAO, '1 lançamento importado')
    await abrirLancamentos(page)
    await abrirCategoria(page, 'Receita Federal')
    await page.getByTestId('category-new').click()
    await page.getByTestId('category-new-name').fill('Restituição de IR')
    await page.getByTestId('category-new-create').click()
    await page.getByTestId('rule-create').click() // a regra "crédito receita federal restituição" também usa a categoria
    await expect(page.getByTestId('category-rule')).toBeHidden()
    await closeDetail(page)

    await page.getByTestId('settings-link').click()
    await page.getByTestId('custom-category-remove').click()
    await expect(page.getByTestId('categories-status')).toContainText('1 lançamento e 1 regra usam esta categoria')
    await expect(page.getByTestId('custom-category')).toHaveCount(1)

    await page.getByTestId('custom-category-rename').click()
    await page.getByTestId('custom-category-input').fill('Mercado')
    await page.getByTestId('custom-category-save').click()
    await expect(page.getByTestId('categories-status')).toContainText('Já existe')
    await page.getByTestId('custom-category-input').fill('IR devolvido')
    await page.getByTestId('custom-category-save').click()
    await expect(page.getByTestId('categories-status')).toContainText('Categoria renomeada para IR devolvido')
    await expect(page.getByTestId('custom-category-name')).toHaveText('IR devolvido')
    await expect(page.getByTestId('rule-category')).toHaveText('IR devolvido')

    await abrirLancamentos(page)
    await linha(page, 'Receita Federal').click()
    await expect(detailField(page, 'Categoria')).toHaveText('IR devolvido')
  })

  test('Revisar também tem "Não é gasto" e "Nova categoria"', async ({ page }) => {
    await importarUm(page, 'nubank', RESTITUICAO, '1 lançamento importado')
    await page.goto('/revisar')
    await waitAppReady(page)
    await page.getByTestId('review-filter-in').click()
    await page.getByTestId('review-open').first().click()
    await expect(page.getByTestId('review-category-not-expense')).toContainText('Não é gasto')
    await page.getByTestId('review-category-new').click()
    await page.getByTestId('review-category-new-name').fill('Restituição de IR')
    await page.getByTestId('review-category-new-create').click()
    await expect(page.getByTestId('review-category-option').filter({ hasText: 'Restituição de IR' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('review-create').click()
    await expect(page.getByTestId('review-sheet')).toBeHidden()
    await expect(page.getByTestId('review-empty')).toBeVisible()
  })
})
