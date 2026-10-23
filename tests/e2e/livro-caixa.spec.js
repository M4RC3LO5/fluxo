import { test, expect } from '@playwright/test'
import { importFixture, FIXED_NOW, FIXTURE } from './helpers/importFixture.js'
import { waitAppReady } from './helpers/appReady.js'
import { abrirLancamentos, rows } from './helpers/lancamentos.js'

const CATEGORIAS = 'tests/fixtures/fluxo_categorias.xlsx'
const DUPLICADA = 'tests/fixtures/fluxo_duplicada.xlsx'

const result = page => page.getByTestId('import-result')
const historyRows = page => page.getByTestId('history-row')
const importar = (page, arquivo) => page.locator('[data-testid="source-input-xlsx"]').setInputFiles(arquivo)

async function totalLancamentos(page) {
  await abrirLancamentos(page)
  return rows(page).count()
}

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(FIXED_NOW) })

test('Importações se somam', async ({ page }) => {
  await importFixture(page)
  await importar(page, CATEGORIAS)
  await expect(result(page)).toContainText('5 lançamentos importados')
  await expect(historyRows(page)).toHaveCount(2)
  expect(await totalLancamentos(page)).toBe(20)
  await expect(page.getByText('20 de 20 registros')).toBeVisible()
})

test('Reimportar o mesmo arquivo', async ({ page }) => {
  await importFixture(page)
  await importar(page, FIXTURE)
  await expect(result(page)).toContainText('0 lançamentos importados · 15 duplicatas ignoradas')
  await expect(historyRows(page).first()).toContainText('15 ignoradas')
  expect(await totalLancamentos(page)).toBe(15)
})

test('Repetição dentro do mesmo arquivo é mantida', async ({ page }) => {
  await page.goto('/importacoes')
  await importar(page, DUPLICADA)
  await expect(result(page)).toContainText('3 lançamentos importados')
  await expect(result(page)).not.toContainText('duplicatas') // sem a 2ª parte quando M = 0
  expect(await totalLancamentos(page)).toBe(3)
})

test('Remover importação remove só os lançamentos dela', async ({ page }) => {
  await importFixture(page)
  await importar(page, CATEGORIAS)
  await expect(historyRows(page)).toHaveCount(2)

  const linha = historyRows(page).filter({ hasText: 'fluxo_categorias.xlsx' })
  await linha.getByRole('button', { name: 'Remover importação' }).click()
  await expect(page.getByRole('dialog')).toContainText('Remover importação e 5 lançamentos?')
  await page.getByTestId('confirm-remove').click()
  await expect(page.getByRole('dialog')).toBeHidden() // o sheet fecha depois da gravação
  await expect(historyRows(page)).toHaveCount(1)

  expect(await totalLancamentos(page)).toBe(15)
  await expect(rows(page).filter({ hasText: 'Venda projeto Alfa' })).toHaveCount(0)

  await page.reload()
  await waitAppReady(page)
  await abrirLancamentos(page)
  await expect(page.getByText('15 de 15 registros')).toBeVisible()
  await page.goto('/importacoes')
  await expect(historyRows(page)).toHaveCount(1)
  await expect(historyRows(page).first()).toContainText('fluxo_exemplo.xlsx')
})

test('Cancelar a remoção mantém tudo', async ({ page }) => {
  await importFixture(page)
  await page.getByRole('button', { name: 'Remover importação' }).click()
  await page.getByTestId('cancel-remove').click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(historyRows(page)).toHaveCount(1)
  expect(await totalLancamentos(page)).toBe(15)
})

/** Acesso direto ao IndexedDB do app (idb-keyval: banco "fluxo", store "kv"). */
const idb = {
  put: (page, items) => page.evaluate(items => new Promise((resolve, reject) => {
    const open = indexedDB.open('fluxo')
    open.onupgradeneeded = () => open.result.createObjectStore('kv')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const tx = open.result.transaction('kv', 'readwrite')
      for (const [k, v] of Object.entries(items)) tx.objectStore('kv').put(v, k)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
  }), items),
  get: (page, key) => page.evaluate(key => new Promise((resolve, reject) => {
    const open = indexedDB.open('fluxo')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const req = open.result.transaction('kv').objectStore('kv').get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }
  }), key)
}

test('Migração do schema 2', async ({ page }) => {
  await page.goto('/')
  await waitAppReady(page)

  const base = { category: null, type: null, source: 'xlsx', importId: null, paid: 0, status: 'pending', responsible: 'Ana', payer: 'X', center: 'TI', notes: '' }
  await idb.put(page, {
    'fluxo:schema': 2,
    'fluxo:finance:entries': [
      { ...base, id: 'a', dueDate: '2026-10-20', description: 'Licença antiga', forecast: 890 },
      { ...base, id: 'b', dueDate: '2026-10-25', description: 'Aluguel antigo', forecast: 3500 }
    ],
    'fluxo:import:history': [
      { id: 11, source: 'xlsx', fileName: 'velha.xlsx', versionName: 'velha', count: 9, importedAt: '2026-09-01T10:00:00.000Z' },
      { id: 12, source: 'xlsx', fileName: 'ativa.xlsx', versionName: 'ativa', count: 2, importedAt: '2026-10-01T10:00:00.000Z' }
    ],
    'fluxo:import:activeVersionId': 12
  })

  await page.reload()
  await waitAppReady(page)
  await abrirLancamentos(page)
  await expect(rows(page)).toHaveCount(2)

  await page.goto('/importacoes')
  await expect(historyRows(page)).toHaveCount(1)
  await expect(historyRows(page).first()).toContainText('ativa.xlsx')
  await expect(historyRows(page).first()).toContainText('+2')

  expect(await idb.get(page, 'fluxo:schema')).toBe(3)
  expect(await idb.get(page, 'fluxo:import:activeVersionId')).toBeUndefined()
  const entries = await idb.get(page, 'fluxo:finance:entries')
  expect(entries.map(e => e.importId)).toEqual([12, 12])
})

test('Migração do schema 2 sem versão ativa usa "Dados anteriores"', async ({ page }) => {
  await page.goto('/')
  await waitAppReady(page)
  await idb.put(page, {
    'fluxo:schema': 2,
    'fluxo:finance:entries': [{ id: 'a', dueDate: '2026-10-20', description: 'Sem origem', forecast: 10, paid: 0, status: 'pending',
      responsible: '', payer: '', center: '', notes: '', category: null, type: null, source: 'xlsx', importId: null }],
    'fluxo:import:history': []
  })
  await page.reload()
  await waitAppReady(page)
  await page.goto('/importacoes')
  await expect(historyRows(page)).toHaveCount(1)
  await expect(historyRows(page).first()).toContainText('Dados anteriores')
  const entries = await idb.get(page, 'fluxo:finance:entries')
  expect(entries[0].importId).toBe('legado')
})

test('Aba Versões removida', async ({ page }) => {
  await page.goto('/versoes')
  await expect(page).toHaveURL(/\/importacoes$/)
  await expect(page.getByRole('link', { name: /Versões/ })).toHaveCount(0)
})
