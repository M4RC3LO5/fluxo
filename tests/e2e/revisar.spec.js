import { test, expect } from '@playwright/test'
import { FIXED_NOW } from './helpers/importFixture.js'
import { waitAppReady } from './helpers/appReady.js'
import { abrirLancamentos, rows, detailField, closeDetail } from './helpers/lancamentos.js'

const REVISAR = 'tests/fixtures/nubank_cartao_revisar.csv'

const result = page => page.getByTestId('import-result')
const grupos = page => page.getByTestId('review-group')
const norm = (s) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
const total = async page => norm(await page.getByTestId('review-total').innerText())

async function importar(page) {
  await page.goto('/importacoes')
  await waitAppReady(page)
  await page.locator('[data-testid="source-input-nubank"]').setInputFiles(REVISAR)
  await expect(result(page)).toContainText('9 lançamentos importados')
}
async function abrirRevisar(page) {
  await page.goto('/revisar')
  await waitAppReady(page)
  await expect(page.getByTestId('review-total')).toBeVisible()
}

/** Abre o grupo, escolhe a categoria e (opcional) ajusta o texto da regra. */
async function abrirGrupo(page, nome) {
  await grupos(page).filter({ hasText: nome }).getByTestId('review-open').click()
  await expect(page.getByTestId('review-sheet')).toBeVisible()
}
async function escolher(page, categoria) {
  await page.getByTestId('review-category-search').fill(categoria)
  await page.getByTestId('review-category-option').filter({ hasText: categoria }).first().click()
}
async function categorizar(page, nome, categoria, pattern) {
  await abrirGrupo(page, nome)
  await escolher(page, categoria)
  if (pattern !== undefined) await page.getByTestId('review-pattern').fill(pattern)
  await page.getByTestId('review-create').click()
  await expect(page.getByTestId('review-sheet')).toBeHidden()
}

/** Categoria do detalhe da n-ésima linha de Lançamentos. */
async function categoriaDe(page, linha) {
  await linha.click()
  const texto = await detailField(page, 'Categoria').innerText()
  await closeDetail(page)
  return texto
}
const lojaA = page => rows(page).filter({ hasText: 'Loja Desconhecida A', hasNotText: 'Estorno' })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
})

test.describe('com o extrato de exemplo importado', () => {
  test.beforeEach(async ({ page }) => {
    await importar(page)
  })

  test('o resultado da importação avisa e leva para Revisar', async ({ page }) => {
    await expect(page.getByTestId('import-uncategorized')).toContainText('8 sem categoria')
    await page.getByTestId('import-review-link').click()
    await expect(page).toHaveURL(/\/revisar$/)
    await expect(page.getByTestId('review-page')).toBeVisible()
  })

  test('grupos ordenados do maior total para o menor, parcelas juntas', async ({ page }) => {
    await abrirRevisar(page)
    expect(await total(page)).toBe('7 lançamentos sem categoria · R$ 620,00')
    await expect(grupos(page)).toHaveCount(3)
    await expect(grupos(page).nth(0)).toContainText('Loja Desconhecida A')
    await expect(grupos(page).nth(1)).toContainText('Loja Desconhecida B')
    await expect(grupos(page).nth(2)).toContainText('Mercearia Desconhecida C')
    expect(norm(await grupos(page).nth(0).getByTestId('review-group-summary').innerText())).toBe('3× · R$ 300,00')
    expect(norm(await grupos(page).nth(1).getByTestId('review-group-summary').innerText())).toBe('2× · R$ 200,00')
    expect(norm(await grupos(page).nth(2).getByTestId('review-group-summary').innerText())).toBe('2× · R$ 120,00') // as duas parcelas
    await expect(grupos(page).nth(2)).not.toContainText('Parcela')
    await expect(grupos(page).nth(0)).toContainText('ago/2026 · set/2026 · out/2026')
    await expect(grupos(page).nth(1)).toContainText('set/2026 · out/2026')
    // o supermercado foi categorizado por regra seed: não aparece
    await expect(page.getByTestId('review-page')).not.toContainText('Supermercado')
  })

  test('Entradas têm filtro e catálogo próprios', async ({ page }) => {
    await abrirRevisar(page)
    await page.getByTestId('review-filter-in').click()
    expect(await total(page)).toBe('1 lançamento sem categoria · R$ 30,00')
    await expect(grupos(page)).toHaveCount(1)
    await expect(grupos(page).first()).toContainText('Estorno Loja Desconhecida A')
    await abrirGrupo(page, 'Estorno')
    await expect(page.getByTestId('review-category-option').filter({ hasText: 'Reembolso' })).toHaveCount(1)
    await expect(page.getByTestId('review-category-option').filter({ hasText: 'Mercado' })).toHaveCount(0)
    await escolher(page, 'Reembolso')
    await page.getByTestId('review-create').click()
    await expect(page.getByTestId('review-empty')).toBeVisible() // não sobrou entrada sem categoria
    await expect(page.getByTestId('review-empty')).toContainText('Tudo categorizado')
  })

  test('categorizar um grupo cria a regra, categoriza tudo dele e tira o grupo da lista', async ({ page }) => {
    await abrirRevisar(page)
    await abrirGrupo(page, 'Loja Desconhecida A')
    await expect(page.getByTestId('review-count')).toHaveText('Escolha uma categoria.')
    await expect(page.getByTestId('review-create')).toBeDisabled()
    await escolher(page, 'Laz')
    await expect(page.getByTestId('review-count')).toHaveText('3 lançamentos serão categorizados como Lazer')
    await expect(page.getByTestId('review-create')).toHaveText('Criar regra (3 lançamentos)')
    await page.getByTestId('review-create').click()

    await expect(grupos(page)).toHaveCount(2) // some da lista (com uma animação curta)
    await expect(grupos(page).filter({ hasText: 'Loja Desconhecida A' })).toHaveCount(0)
    expect(await total(page)).toBe('4 lançamentos sem categoria · R$ 320,00')

    // a regra aparece em Configurações › Minhas regras
    await page.getByTestId('settings-link').click()
    const regra = page.getByTestId('rule-item')
    await expect(regra).toHaveCount(1)
    await expect(regra).toContainText('loja desconhecida a')
    await expect(regra).toContainText('Lazer')
    await expect(page.getByTestId('rule-matches')).toHaveText('casa 3 lançamentos hoje')

    // e os 3 lançamentos ficaram Lazer; o estorno (entrada) não foi tocado
    await abrirLancamentos(page)
    await expect(lojaA(page)).toHaveCount(3)
    for (let i = 0; i < 3; i++) expect(await categoriaDe(page, lojaA(page).nth(i))).toBe('Lazer')
    expect(await categoriaDe(page, rows(page).filter({ hasText: 'Estorno Loja Desconhecida A' }))).toBe('Sem categoria')
  })

  test('pattern editável: a contagem ao vivo muda antes de confirmar', async ({ page }) => {
    await abrirRevisar(page)
    await abrirGrupo(page, 'Loja Desconhecida A')
    await expect(page.getByTestId('review-pattern')).toHaveValue('loja desconhecida a')
    await escolher(page, 'Lazer')
    const contagem = page.getByTestId('review-count')
    await expect(contagem).toHaveText('3 lançamentos serão categorizados como Lazer')

    await page.getByTestId('review-pattern').fill('loja desconhecida') // trecho menor: pega o grupo B também
    await expect(contagem).toHaveText('5 lançamentos serão categorizados como Lazer') // o estorno é entrada: fora
    await expect(page.getByTestId('review-create')).toHaveText('Criar regra (5 lançamentos)')

    await page.getByTestId('review-pattern').fill('Loja  DESCONHECIDA b - Parcela 1/2') // normaliza acento, caixa, espaços e parcela
    await expect(contagem).toHaveText('2 lançamentos serão categorizados como Lazer')

    await page.getByTestId('review-pattern').fill('xyz que não existe')
    await expect(contagem).toHaveText('0 lançamentos serão categorizados como Lazer')
    await expect(page.getByTestId('review-create')).toBeDisabled()
    await page.getByTestId('review-pattern').fill('')
    await expect(contagem).toHaveText('Digite o texto da regra.')

    // confirmar com o trecho menor categoriza os dois grupos
    await page.getByTestId('review-pattern').fill('loja desconhecida')
    await page.getByTestId('review-create').click()
    await expect(grupos(page)).toHaveCount(1)
    await expect(grupos(page).first()).toContainText('Mercearia Desconhecida C')
  })

  test('Ignorar esconde só nesta sessão', async ({ page }) => {
    await abrirRevisar(page)
    await grupos(page).filter({ hasText: 'Loja Desconhecida B' }).getByTestId('review-ignore').click()
    await expect(grupos(page)).toHaveCount(2)
    expect(await total(page)).toBe('5 lançamentos sem categoria · R$ 420,00')
    await page.reload()
    await waitAppReady(page)
    await expect(grupos(page)).toHaveCount(3) // não gravou
  })

  test('banner no Dashboard Pessoal abre Revisar', async ({ page }) => {
    await page.goto('/dashboard')
    await waitAppReady(page)
    await expect(page.getByTestId('pf-month-label')).toHaveText('outubro/2026')
    await expect(page.getByTestId('review-banner')).toHaveText(/3 sem categoria no mês\s*·\s*Revisar/)
    await page.getByTestId('review-banner').click()
    await expect(page).toHaveURL(/\/revisar$/)
  })

  test('remover a regra devolve os lançamentos para Sem categoria', async ({ page }) => {
    await abrirRevisar(page)
    await categorizar(page, 'Loja Desconhecida A', 'Lazer')
    await expect(grupos(page)).toHaveCount(2)

    await page.getByTestId('settings-link').click()
    await page.getByTestId('rule-remove').click()
    await expect(page.getByTestId('rules-empty')).toBeVisible()
    await expect(page.getByTestId('rules-status')).toContainText('3 lançamentos recalculados')

    await abrirRevisar(page)
    await expect(grupos(page)).toHaveCount(3) // o grupo A voltou
    expect(await total(page)).toBe('7 lançamentos sem categoria · R$ 620,00')
  })

  test('remover a regra não mexe no que foi escolhido à mão', async ({ page }) => {
    await abrirRevisar(page)
    await categorizar(page, 'Loja Desconhecida A', 'Lazer')
    // um dos 3 passa a "manual" (editor do detalhe): essa escolha sobrevive à remoção da regra
    await abrirLancamentos(page)
    await lojaA(page).first().click()
    await page.getByTestId('category-edit').click()
    await page.getByTestId('category-search').fill('Pets')
    await page.getByTestId('category-option').filter({ hasText: 'Pets' }).first().click()
    await page.getByTestId('rule-only-this').click()
    await expect(page.getByTestId('category-rule')).toBeHidden()
    await closeDetail(page)

    await page.getByTestId('settings-link').click()
    await page.getByTestId('rule-remove').click()
    await expect(page.getByTestId('rules-status')).toContainText('2 lançamentos recalculados') // só os 2 que vinham da regra
    await abrirLancamentos(page)
    expect(await categoriaDe(page, lojaA(page).first())).toBe('Pets')
    expect(await categoriaDe(page, lojaA(page).nth(1))).toBe('Sem categoria')
  })

  test('categorizar todos os grupos: Tudo categorizado', async ({ page }) => {
    await abrirRevisar(page)
    await categorizar(page, 'Loja Desconhecida A', 'Lazer')
    await categorizar(page, 'Loja Desconhecida B', 'Outros gastos')
    await categorizar(page, 'Mercearia Desconhecida C', 'Mercado')
    await expect(page.getByTestId('review-empty')).toContainText('Tudo categorizado')
    expect(await total(page)).toBe('0 lançamentos sem categoria · R$ 0,00')
    await page.goto('/dashboard')
    await waitAppReady(page)
    await expect(page.getByTestId('review-banner')).toHaveText(/1 sem categoria no mês/) // sobra o estorno (entrada)
  })

  test('sem rolagem horizontal', async ({ page }) => {
    await abrirRevisar(page)
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    expect(sw).toBeLessThanOrEqual(iw)
  })
})

test('sem dados: Tudo categorizado', async ({ page }) => {
  await page.goto('/revisar')
  await waitAppReady(page)
  await expect(page.getByTestId('review-empty')).toContainText('Tudo categorizado')
})

test('Configurações: regras padrão recolhidas e só leitura', async ({ page }) => {
  await page.goto('/configuracoes')
  await waitAppReady(page)
  await expect(page.getByTestId('rules-empty')).toBeVisible()
  const alternar = page.getByTestId('seed-rules-toggle')
  await expect(alternar).toHaveText(/Regras padrão \(\d+\)/)
  await expect(page.getByTestId('seed-rules-list')).toHaveCount(0) // recolhida
  await alternar.click()
  await expect(page.getByTestId('seed-rules-list')).toBeVisible()
  await expect(page.getByTestId('seed-rule-item').first()).toBeVisible()
  await expect(page.getByTestId('seed-rules-list').getByTestId('rule-remove')).toHaveCount(0) // só leitura
  await expect(page.getByTestId('rule-remove')).toHaveCount(0)
})
