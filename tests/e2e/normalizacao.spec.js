import { test, expect } from '@playwright/test'
import { importFixture, FIXED_NOW } from './helpers/importFixture.js'
import { waitAppReady } from './helpers/appReady.js'
import { abrirLancamentos, rows, openDetail, detailField, closeDetail } from './helpers/lancamentos.js'

const FIXTURE_CATEGORIAS = 'tests/fixtures/fluxo_categorias.xlsx'

async function importCategorias(page) {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto('/importacoes')
  await page.locator('[data-testid="source-input-xlsx"]').setInputFiles(FIXTURE_CATEGORIAS)
  await expect(page.getByText('5 registros importados')).toBeVisible()
  await abrirLancamentos(page)
}

test('Categoria e centro de custo separados', async ({ page }) => {
  await importCategorias(page)
  await openDetail(page, 'Venda projeto Alfa')
  await expect(detailField(page, 'Categoria')).toHaveText('Serviços')
  await expect(detailField(page, 'Centro de Custo')).toHaveText('Comercial')
})

test('Tipo derivado da coluna', async ({ page }) => {
  await importCategorias(page)
  await openDetail(page, 'Venda projeto Alfa') // Receita
  await expect(detailField(page, 'Tipo')).toHaveText('Entrada')
  await closeDetail(page)
  await openDetail(page, 'Aluguel escritório - Novembro') // Despesa
  await expect(detailField(page, 'Tipo')).toHaveText('Saída')
})

test('Planilha antiga sem coluna Categoria', async ({ page }) => {
  await importFixture(page)
  await abrirLancamentos(page)
  await openDetail(page, 'Recebimento cliente A')
  await expect(detailField(page, 'Categoria')).toHaveText('Sem categoria')
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

test('Migração de dados do schema 1', async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto('/')
  await waitAppReady(page)

  const v1 = [
    { id: 'imp_1', dueDate: '2026-10-20', description: 'Fornecedor TI antigo', forecast: 890, paid: 890, status: 'paid',
      responsible: 'Ana', payer: 'TechSoft', center: 'Tecnologia', type: 'despesa', notes: '' },
    { id: 'imp_2', dueDate: '2026-10-25', description: 'Recebimento antigo', forecast: 5000, paid: 0, status: 'pending',
      responsible: 'Marcelo', payer: 'Cliente', center: 'Comercial', type: 'receita', notes: '' }
  ]
  await idb.put(page, {
    'fluxo:schema': 1,
    'fluxo:finance:entries': v1,
    'fluxo:import:history': [{ id: 1, source: 'xlsx', fileName: 'antigo.xlsx', versionName: 'antigo', count: 2, importedAt: '2026-10-01T00:00:00.000Z' }],
    'fluxo:import:activeVersionId': 1
  })

  await page.reload()
  await waitAppReady(page)
  await abrirLancamentos(page)
  await expect(rows(page)).toHaveCount(2)

  await openDetail(page, 'Fornecedor TI antigo')
  await expect(detailField(page, 'Categoria')).toHaveText('Sem categoria')
  await expect(detailField(page, 'Centro de Custo')).toHaveText('Tecnologia') // center não vira category
  await closeDetail(page)

  expect(await idb.get(page, 'fluxo:schema')).toBe(2)
  const entries = await idb.get(page, 'fluxo:finance:entries')
  expect(entries).toHaveLength(2)
  for (const e of entries) {
    expect(e.category).toBeNull()
    expect(e.source).toBe('xlsx')
    expect(e.importId).toBeNull()
  }
  expect(entries.map(e => e.type)).toEqual([null, 'in'])
})
