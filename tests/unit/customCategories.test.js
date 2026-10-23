import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const disco = new Map()
vi.mock('@/modules/persistence/storage.js', () => ({
  KEYS: { entries: 'e', history: 'h', rules: 'r', settings: 's' },
  load: async (k) => disco.get(k),
  save: async (k, v) => { disco.set(k, JSON.parse(JSON.stringify(v))) },
  debounced: (fn) => Object.assign(() => {}, { flush: () => Promise.resolve(fn()) })
}))

const { useSettingsStore } = await import('@/stores/settingsStore.js')
const { useRulesStore } = await import('@/stores/rulesStore.js')
const { useFinanceStore } = await import('@/stores/financeStore.js')
const { findCategory, canonicalCategory, categoriesFor } = await import('@/modules/categories/catalog.js')
const { renameCustomCategory, removeCustomCategory, categoryUsage } = await import('@/modules/categories/categoryService.js')
const { topExpensesByCategory } = await import('@/modules/kpis/pfKpis.js')

beforeEach(() => { disco.clear(); setActivePinia(createPinia()) })

describe('catálogo padrão ampliado', () => {
  it('traz as novas categorias de entrada e saída', () => {
    const nomes = (t) => categoriesFor(t).map(c => c.name)
    expect(nomes('in')).toEqual(expect.arrayContaining(['Restituição de impostos', 'Vendas', 'Presentes recebidos']))
    expect(nomes('out')).toEqual(expect.arrayContaining(['Vestuário', 'Viagem', 'Presentes', 'Casa e decoração', 'Filhos']))
  })
})

describe('categorias próprias', () => {
  it('cria, grava em fluxo:settings e entra no seletor do tipo certo', async () => {
    const s = useSettingsStore()
    expect(await s.addCustomCategory('  Restituição   de IR ', 'in')).toEqual({ ok: true, name: 'Restituição de IR' })
    expect(disco.get('s').customCategories).toEqual([{ name: 'Restituição de IR', kind: 'in' }])
    expect(categoriesFor('in').map(c => c.name)).toContain('Restituição de IR')
    expect(categoriesFor('out').map(c => c.name)).not.toContain('Restituição de IR')
  })

  it('nome repetido é recusado: catálogo ou próprias, ignorando acento e caixa', async () => {
    const s = useSettingsStore()
    expect((await s.addCustomCategory('MERCADO', 'out')).ok).toBe(false) // catálogo
    expect((await s.addCustomCategory('restituicao de impostos', 'in')).ok).toBe(false) // catálogo novo
    await s.addCustomCategory('Hobby', 'out')
    const r = await s.addCustomCategory('hóbby', 'out')
    expect(r).toMatchObject({ ok: false })
    expect(r.error).toMatch(/já existe/i)
    expect((await s.addCustomCategory('   ', 'out')).ok).toBe(false)
    expect(s.customCategories).toEqual([{ name: 'Hobby', kind: 'out' }])
  })

  it('hidrata de volta e o catálogo passa a conhecê-la (canonicalCategory)', async () => {
    const s = useSettingsStore()
    await s.addCustomCategory('Hobby', 'out')
    setActivePinia(createPinia())
    const novo = useSettingsStore()
    await novo.hydrate()
    expect(novo.customCategories).toEqual([{ name: 'Hobby', kind: 'out' }])
    expect(canonicalCategory('HOBBY')).toBe('Hobby')
    expect(findCategory('hobby')).toMatchObject({ kind: 'out' })
  })

  it('o ranking do Dashboard agrupa pelo nome da categoria própria', async () => {
    await useSettingsStore().addCustomCategory('Hobby', 'out')
    const mk = (id, category, forecast) => ({ id, dueDate: '2026-09-10', type: 'out', status: 'paid', forecast, category, transfer: false, description: 'x' })
    const top = topExpensesByCategory([mk('a', 'hobby', 10), mk('b', 'Hobby', 5)], '2026-09')
    expect(top).toHaveLength(1)
    expect(top[0]).toMatchObject({ name: 'Hobby', total: 15, count: 2 })
  })

  it('renomear atualiza lançamentos e regras', async () => {
    const s = useSettingsStore()
    const finance = useFinanceStore()
    const rules = useRulesStore()
    await s.addCustomCategory('Hobby', 'out')
    await finance.addEntries([
      { id: 'a', dueDate: '2026-09-10', description: 'LOJA DE TINTAS', forecast: 10, source: 'nubank', type: 'out' },
      { id: 'b', dueDate: '2026-09-11', description: 'OUTRA', forecast: 20, source: 'nubank', type: 'out' }
    ])
    await finance.setEntryCategory(finance.entries[0].id, 'Hobby')
    await rules.addUserRule('loja de tintas', 'Hobby')

    expect(categoryUsage('Hobby')).toEqual({ entries: 1, rules: 1 })
    const r = await renameCustomCategory('Hobby', 'Artesanato')
    expect(r).toMatchObject({ ok: true, name: 'Artesanato', entries: 1, rules: 1 })
    expect(finance.entries[0].category).toBe('Artesanato')
    expect(finance.entries[1].category).toBeFalsy()
    expect(rules.userRules[0].category).toBe('Artesanato')
    expect(s.customCategories).toEqual([{ name: 'Artesanato', kind: 'out' }])
    expect(findCategory('hobby')).toBeNull()
    expect(disco.get('s').customCategories[0].name).toBe('Artesanato')
  })

  it('renomear não pode colidir com outra categoria', async () => {
    const s = useSettingsStore()
    await s.addCustomCategory('Hobby', 'out')
    await s.addCustomCategory('Artesanato', 'out')
    expect((await renameCustomCategory('Hobby', 'artesanato')).ok).toBe(false)
    expect((await renameCustomCategory('Hobby', 'Mercado')).ok).toBe(false)
    expect((await renameCustomCategory('Hobby', 'HOBBY')).ok).toBe(true) // só a caixa muda
  })

  it('remover é bloqueado se um lançamento ou regra usa; libera quando ninguém usa', async () => {
    const s = useSettingsStore()
    const finance = useFinanceStore()
    const rules = useRulesStore()
    await s.addCustomCategory('Hobby', 'out')
    await finance.addEntries([{ id: 'a', dueDate: '2026-09-10', description: 'LOJA', forecast: 10, source: 'nubank', type: 'out' }])
    await finance.setEntryCategory(finance.entries[0].id, 'Hobby')
    const bloqueada = await removeCustomCategory('Hobby')
    expect(bloqueada).toEqual({ ok: false, entries: 1, rules: 0 })
    expect(s.customCategories).toHaveLength(1)

    await finance.setEntryCategory(finance.entries[0].id, 'Lazer')
    const regra = await rules.addUserRule('loja', 'Hobby')
    expect(await removeCustomCategory('Hobby')).toEqual({ ok: false, entries: 0, rules: 1 })

    await rules.removeRule(regra.id)
    expect(await removeCustomCategory('Hobby')).toEqual({ ok: true })
    expect(s.customCategories).toEqual([])
    expect(findCategory('Hobby')).toBeNull()
  })
})
