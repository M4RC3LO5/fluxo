import { test, expect } from '@playwright/test'
import { FIXED_NOW } from './helpers/importFixture.js'
import { waitAppReady } from './helpers/appReady.js'
import { abrirLancamentos, rows, detailField, detailModal, closeDetail } from './helpers/lancamentos.js'

const CARTAO = 'tests/fixtures/nubank_cartao.csv'
const LOJA = 'tests/fixtures/categorias_loja.csv'
const NOVO = 'tests/fixtures/categorias_novo.csv'
const PIX = 'tests/fixtures/categorias_pix.csv'

const result = page => page.getByTestId('import-result')
const loja = page => rows(page).filter({ hasText: 'Loja Desconhecida', hasNotText: 'IOF de' })

async function importar(page, arquivo, esperado) {
  await page.locator('[data-testid="source-input-nubank"]').setInputFiles(arquivo)
  await expect(result(page)).toContainText(esperado)
}
async function importarELista(page, arquivo, esperado) {
  await page.goto('/importacoes')
  await waitAppReady(page)
  await importar(page, arquivo, esperado)
  await abrirLancamentos(page)
}

const categoria = page => detailField(page, 'Categoria')

/** Abre o detalhe da n-ésima linha, lê a categoria e fecha. */
async function categoriaDe(page, linha) {
  await linha.click()
  const texto = await categoria(page).innerText()
  await closeDetail(page)
  return texto
}

/** Abre o detalhe, toca na categoria e escolhe uma do catálogo; devolve com o passo "ensinar" aberto. */
async function escolher(page, linha, nome) {
  await linha.click()
  await page.getByTestId('category-edit').click()
  await expect(page.getByTestId('category-picker')).toBeVisible()
  await page.getByTestId('category-search').fill(nome)
  await page.getByTestId('category-option').filter({ hasText: nome }).first().click()
  await expect(page.getByTestId('category-rule')).toBeVisible()
}

async function soEste(page) {
  await page.getByTestId('rule-only-this').click()
  await expect(page.getByTestId('category-rule')).toBeHidden()
  await closeDetail(page)
}
async function criarRegra(page) {
  await page.getByTestId('rule-create').click()
  await expect(page.getByTestId('category-rule')).toBeHidden()
  await closeDetail(page)
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
})

test('Categorização automática ao importar', async ({ page }) => {
  await importarELista(page, CARTAO, '5 lançamentos importados')
  expect(await categoriaDe(page, rows(page).filter({ hasText: 'Supermercado Bom Preço' }))).toBe('Mercado')
  expect(await categoriaDe(page, rows(page).filter({ hasText: 'Restaurante Sabor' }))).toBe('Alimentação')
  expect(await categoriaDe(page, rows(page).filter({ hasText: 'Loja X - Parcela 2/10' }))).toBe('Sem categoria')
})

test.describe('Corrigir uma vez', () => {
  test.beforeEach(async ({ page }) => {
    await importarELista(page, LOJA, '4 lançamentos importados')
  })

  test('Criar regra: os repetidos mudam e o próximo arquivo já entra categorizado', async ({ page }) => {
    await expect(loja(page)).toHaveCount(3)
    await escolher(page, loja(page).first(), 'Lazer')
    await expect(page.getByTestId('rule-pattern')).toHaveValue('loja desconhecida')
    await expect(page.getByTestId('rule-impact')).toHaveText('2 lançamentos existentes serão atualizados')
    await criarRegra(page)

    for (let i = 0; i < 3; i++) expect(await categoriaDe(page, loja(page).nth(i))).toBe('Lazer')
    // a categoria que veio do banco não é tocada pela regra
    expect(await categoriaDe(page, rows(page).filter({ hasText: 'IOF de' }))).toBe('IOF')

    await page.goto('/importacoes')
    await waitAppReady(page)
    await importar(page, NOVO, '1 lançamento importado')
    await abrirLancamentos(page)
    await expect(loja(page)).toHaveCount(4)
    expect(await categoriaDe(page, loja(page).last())).toBe('Lazer') // ordenado por vencimento: o de novembro é o último
  })

  test('Só este: só aquele lançamento muda', async ({ page }) => {
    await escolher(page, loja(page).first(), 'Lazer')
    await soEste(page)
    expect(await categoriaDe(page, loja(page).first())).toBe('Lazer')
    expect(await categoriaDe(page, loja(page).nth(1))).toBe('Sem categoria')
    expect(await categoriaDe(page, loja(page).nth(2))).toBe('Sem categoria')
  })

  test('Regra não sobrescreve categoria do banco nem a escolha manual', async ({ page }) => {
    await escolher(page, loja(page).first(), 'Pets')
    await soEste(page) // este fica manual
    await escolher(page, loja(page).nth(1), 'Lazer')
    await expect(page.getByTestId('rule-impact')).toHaveText('1 lançamento existente será atualizado') // o manual e o do banco ficam de fora
    await criarRegra(page)

    expect(await categoriaDe(page, loja(page).first())).toBe('Pets') // manual
    expect(await categoriaDe(page, loja(page).nth(1))).toBe('Lazer')
    expect(await categoriaDe(page, loja(page).nth(2))).toBe('Lazer')
    expect(await categoriaDe(page, rows(page).filter({ hasText: 'IOF de' }))).toBe('IOF') // banco
  })

  test('Prévia ao vivo acompanha o texto da regra, que é editável', async ({ page }) => {
    await escolher(page, loja(page).first(), 'Lazer')
    const impacto = page.getByTestId('rule-impact')
    await expect(impacto).toHaveText('2 lançamentos existentes serão atualizados')
    await page.getByTestId('rule-pattern').fill('xyz que não existe')
    await expect(impacto).toHaveText('Nenhum outro lançamento existente será atualizado')
    await page.getByTestId('rule-pattern').fill('LOJA   Desconhecida - Parcela 1/2')
    await expect(impacto).toHaveText('2 lançamentos existentes serão atualizados') // normaliza acento, caixa, espaços e parcela
    await page.getByTestId('rule-pattern').fill('')
    await expect(page.getByTestId('rule-create')).toBeDisabled()
  })

  test('As regras persistem depois de recarregar', async ({ page }) => {
    await escolher(page, loja(page).first(), 'Lazer')
    await criarRegra(page)

    await page.reload()
    await waitAppReady(page)
    await abrirLancamentos(page)
    expect(await categoriaDe(page, loja(page).nth(1))).toBe('Lazer') // categorias gravadas

    await page.goto('/importacoes')
    await waitAppReady(page)
    await importar(page, NOVO, '1 lançamento importado') // a regra voltou do IndexedDB
    await abrirLancamentos(page)
    expect(await categoriaDe(page, loja(page).last())).toBe('Lazer')
  })
})

test('O catálogo é filtrado pelo tipo do lançamento', async ({ page }) => {
  await importarELista(page, CARTAO, '5 lançamentos importados')
  // saída: categorias de saída, não de entrada
  await rows(page).filter({ hasText: 'Loja X - Parcela 2/10' }).click()
  await page.getByTestId('category-edit').click()
  const opcoes = page.getByTestId('category-option')
  await expect(opcoes.filter({ hasText: 'Mercado' })).toHaveCount(1)
  await expect(opcoes.filter({ hasText: 'Salário' })).toHaveCount(0)
  await page.getByTestId('category-search').fill('xyzzy')
  await expect(page.getByText('Nenhuma categoria encontrada.')).toBeVisible()
})

test('Entrada só oferece categorias de entrada', async ({ page }) => {
  await importarELista(page, CARTAO, '5 lançamentos importados')
  await rows(page).filter({ hasText: 'Estorno Cinema' }).click()
  await page.getByTestId('category-edit').click()
  const opcoes = page.getByTestId('category-option')
  await expect(opcoes.filter({ hasText: 'Salário' })).toHaveCount(1)
  await expect(opcoes.filter({ hasText: 'Mercado' })).toHaveCount(0)
})

test('Transferência não tem categoria editável', async ({ page }) => {
  await importarELista(page, CARTAO, '5 lançamentos importados')
  await rows(page).filter({ hasText: 'Pagamento recebido' }).click()
  await expect(page.getByTestId('category-edit')).toHaveCount(0)
  await expect(page.getByTestId('category-locked')).toContainText('não é editável nesta versão')
  await expect(categoria(page)).toHaveText('Pagamento de fatura')
})

test('Ranking do Dashboard: "Sem categoria" deixa de liderar', async ({ page }) => {
  await importarELista(page, CARTAO, '5 lançamentos importados')
  await page.goto('/dashboard')
  await waitAppReady(page)
  await expect(page.getByTestId('pf-month-label')).toHaveText('novembro/2026')
  const categorias = page.getByTestId('pf-rank-category').getByTestId('pf-rank-row')
  await expect(categorias.first()).toContainText('Mercado')
  await expect(categorias.first()).not.toContainText('Sem categoria')
  await expect(page.getByTestId('pf-rank-category')).toContainText('Alimentação')
})

test('Descrição longa de Pix: encurtada na lista e no ranking, completa no detalhe', async ({ page }) => {
  await importarELista(page, PIX, '1 lançamento importado')
  const linha = rows(page).first()
  await expect(linha).toContainText('Transferência enviada pelo Pix - MARIA SOUZA')
  await expect(linha).not.toContainText('Agência')
  await expect(linha).not.toContainText('•••')

  await linha.click()
  await expect(page.getByText('Agência: 1 Conta: 2', { exact: false }).first()).toBeAttached() // a descrição completa continua no detalhe
  await closeDetail(page)

  await page.goto('/dashboard')
  await waitAppReady(page)
  const descricoes = page.getByTestId('pf-rank-description').getByTestId('pf-rank-row')
  await expect(descricoes.first()).toContainText('Transferência enviada pelo Pix - MARIA SOUZA')
  await expect(descricoes.first()).not.toContainText('Agência')
})
