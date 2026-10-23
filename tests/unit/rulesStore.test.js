import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// storage em memória: grava o que a store salva e devolve no load
const disco = new Map()
vi.mock('@/modules/persistence/storage.js', () => ({
  KEYS: { entries: 'e', history: 'h', rules: 'r' },
  load: async (k) => disco.get(k),
  save: async (k, v) => { disco.set(k, JSON.parse(JSON.stringify(v))) },
  debounced: (fn) => Object.assign(() => {}, { flush: () => Promise.resolve(fn()) })
}))

const { useRulesStore } = await import('@/stores/rulesStore.js')
const { useFinanceStore } = await import('@/stores/financeStore.js')
const { SEED_RULES } = await import('@/modules/categories/seedRules.js')

beforeEach(() => { disco.clear(); setActivePinia(createPinia()) })

describe('rulesStore', () => {
  it('começa só com as seeds', () => {
    const s = useRulesStore()
    expect(s.userRules).toEqual([])
    expect(s.rules).toHaveLength(SEED_RULES.length)
  })

  it('cria regra do usuário com pattern normalizado e grava', async () => {
    const s = useRulesStore()
    const r = await s.addUserRule('  Loja DESCONHECIDA - Parcela 1/3 ', 'Lazer')
    expect(r).toMatchObject({ pattern: 'loja desconhecida', category: 'Lazer', origin: 'user' })
    expect(disco.get('r')).toEqual([expect.objectContaining({ pattern: 'loja desconhecida', category: 'Lazer', origin: 'user' })])
    expect(s.rules.at(-1).pattern).toBe('loja desconhecida')
  })

  it('mesmo pattern atualiza a categoria em vez de duplicar', async () => {
    const s = useRulesStore()
    await s.addUserRule('loja x', 'Lazer')
    await s.addUserRule('LOJA X', 'Pets')
    expect(s.userRules).toHaveLength(1)
    expect(s.userRules[0].category).toBe('Pets')
  })

  it('recusa regra sem texto ou sem categoria', async () => {
    const s = useRulesStore()
    await expect(s.addUserRule('   ', 'Lazer')).rejects.toThrow()
    await expect(s.addUserRule('x', '')).rejects.toThrow()
  })

  it('persiste só as regras do usuário e hidrata de volta', async () => {
    await useRulesStore().addUserRule('loja x', 'Lazer')
    setActivePinia(createPinia()) // "recarregar a página"
    const s = useRulesStore()
    expect(s.userRules).toEqual([])
    await s.hydrate()
    expect(s.userRules.map(r => r.pattern)).toEqual(['loja x'])
    expect(s.rules).toHaveLength(SEED_RULES.length + 1)
  })

  it('hidratação ignora lixo gravado', async () => {
    disco.set('r', [{ pattern: 'ok', category: 'Lazer', origin: 'user', id: '1' }, { pattern: '', category: 'X', origin: 'user' }, null, { pattern: 'seed', category: 'X', origin: 'seed' }])
    const s = useRulesStore()
    await s.hydrate()
    expect(s.userRules.map(r => r.pattern)).toEqual(['ok'])
  })

  it('removeRule', async () => {
    const s = useRulesStore()
    const r = await s.addUserRule('loja x', 'Lazer')
    await s.removeRule(r.id)
    expect(s.userRules).toEqual([])
    expect(disco.get('r')).toEqual([])
  })
})

describe('financeStore: correção manual e regras', () => {
  const lanc = (id, description, extra = {}) => ({ id, description, dueDate: '2026-10-05', forecast: 10, status: 'paid', type: 'out', transfer: false, category: null, categorySource: null, ...extra })

  it('setEntryCategory marca como manual e grava', async () => {
    const f = useFinanceStore()
    f.entries = [lanc('a', 'Loja Desconhecida')]
    expect(await f.setEntryCategory('a', 'Lazer')).toBe(true)
    expect(f.entries[0]).toMatchObject({ category: 'Lazer', categorySource: 'manual' })
    expect(await f.setEntryCategory('nao-existe', 'Lazer')).toBe(false)
  })

  it('"Criar regra": os 3 repetidos mudam, o manual e o do banco não', async () => {
    const f = useFinanceStore()
    const r = useRulesStore()
    f.entries = [lanc('a', 'Loja Desconhecida'), lanc('b', 'Loja Desconhecida - Parcela 2/3'), lanc('c', 'LOJA DESCONHECIDA'),
      lanc('d', 'Loja Desconhecida', { category: 'IOF', categorySource: 'bank' }), lanc('e', 'Loja Desconhecida', { category: 'Pets', categorySource: 'manual' })]
    await f.setEntryCategory('a', 'Lazer')
    await r.addUserRule('loja desconhecida', 'Lazer')
    const mudou = await f.applyRules(r.rules)
    expect(mudou).toBe(2)
    expect(f.entries.map(e => [e.category, e.categorySource])).toEqual([
      ['Lazer', 'manual'], ['Lazer', 'rule'], ['Lazer', 'rule'], ['IOF', 'bank'], ['Pets', 'manual']])
  })

  it('o filtro de categoria ignora acento/caixa', () => {
    const f = useFinanceStore()
    f.entries = [lanc('a', 'x', { category: 'mercado' }), lanc('b', 'y', { category: 'Mercado' }), lanc('c', 'z', { category: 'Saúde' })]
    f.filters.category = 'MERCADO'
    expect(f.filteredEntries.map(e => e.id)).toEqual(['a', 'b'])
    f.filters.category = 'saude'
    expect(f.filteredEntries.map(e => e.id)).toEqual(['c'])
  })
})
