import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const disco = new Map()
vi.mock('@/modules/persistence/storage.js', () => ({
  KEYS: { entries: 'e', history: 'h', rules: 'r', settings: 's' },
  load: async (k) => disco.get(k),
  save: async (k, v) => { disco.set(k, JSON.parse(JSON.stringify(v))) },
  debounced: (fn) => Object.assign(() => {}, { flush: () => Promise.resolve(fn()) })
}))

const { applyRules, recalculateRuleCategories, countChanges } = await import('@/modules/categories/rules.js')
const { useRulesStore } = await import('@/stores/rulesStore.js')
const { useFinanceStore } = await import('@/stores/financeStore.js')
const { undoTransfer } = await import('@/modules/transfers/ownTransfers.js')
const { isTransferCategory, notExpenseCategories } = await import('@/modules/categories/catalog.js')

let n = 0
const e = (o = {}) => ({
  id: `e${++n}`, description: 'TED FINANCIAMENTO', type: 'out', transfer: false, transferSource: null, pairedWith: null,
  category: null, categorySource: null, dueDate: '2026-09-10', forecast: 50, account: 'santander-cc', ...o
})
const regra = (pattern, category, extra = {}) => ({ id: `r-${pattern}`, pattern, category, origin: 'user', createdAt: '2026-10-01', ...extra })
const transferRule = (pattern, category = 'Pagamento de fatura') => regra(pattern, category, { action: 'transfer' })

beforeEach(() => { disco.clear(); setActivePinia(createPinia()) })

describe('"Não é gasto" no catálogo', () => {
  it('três categorias, todas de transferência', () => {
    expect(notExpenseCategories().map(c => c.name)).toEqual(['Pagamento de fatura', 'Transferência entre contas', 'Investimentos'])
    expect(isTransferCategory('pagamento de fatura')).toBe(true)
    expect(isTransferCategory('Mercado')).toBe(false)
  })
})

describe('regra com action transfer', () => {
  it('aplica: transfer true, transferSource "rule", categoria e categorySource "rule"', () => {
    const [x] = applyRules([e()], [transferRule('ted financiamento')])
    expect(x).toMatchObject({ transfer: true, transferSource: 'rule', category: 'Pagamento de fatura', categorySource: 'rule' })
  })
  it('vale para Entrada e Saída', () => {
    const [x] = applyRules([e({ type: 'in' })], [transferRule('ted financiamento', 'Investimentos')])
    expect(x).toMatchObject({ transfer: true, transferSource: 'rule', category: 'Investimentos' })
  })
  it('não toca manual, banco nem transferência de outra origem', () => {
    const list = [
      e({ category: 'Mercado', categorySource: 'manual' }),
      e({ category: 'Pagamento de fatura', categorySource: 'bank', transfer: true, transferSource: 'bank' }),
      e({ category: 'Transferência entre contas', categorySource: 'rule', transfer: true, transferSource: 'name' }),
      e({ category: 'Pagamento de fatura', categorySource: 'manual', transfer: true, transferSource: 'manual' })
    ]
    applyRules(list, [transferRule('ted financiamento')]).forEach((x, i) => expect(x).toBe(list[i]))
  })
  it('"Não é transferência" feito por você (manual) não é refeito pela regra', () => {
    const marcado = applyRules([e()], [transferRule('ted financiamento')])
    const desfeito = undoTransfer(marcado, marcado[0].id)
    expect(desfeito[0]).toMatchObject({ transfer: false, transferSource: 'manual', category: null })
    expect(applyRules(desfeito, [transferRule('ted financiamento')])[0]).toBe(desfeito[0])
    expect(recalculateRuleCategories(desfeito, [transferRule('ted financiamento')])[0]).toBe(desfeito[0])
  })
  it('é idempotente', () => {
    const uma = applyRules([e()], [transferRule('ted financiamento')])
    applyRules(uma, [transferRule('ted financiamento')]).forEach((x, i) => expect(x).toBe(uma[i]))
  })
  it('a prévia (countChanges) conta quem viraria transferência', () => {
    expect(countChanges([e(), e({ description: 'Padaria' })], [transferRule('ted financiamento')])).toBe(1)
  })
  it('remover a regra desfaz só os transferSource "rule" dela', () => {
    const outra = e({ description: 'PIX MARINA', transfer: true, transferSource: 'name', category: 'Transferência entre contas', categorySource: 'rule' })
    const manual = e({ category: 'Pagamento de fatura', categorySource: 'manual', transfer: true, transferSource: 'manual' })
    const aplicado = applyRules([e(), outra, manual], [transferRule('ted financiamento')])
    expect(aplicado[0].transfer).toBe(true)
    const [desfeito, ...resto] = recalculateRuleCategories(aplicado, [])
    expect(desfeito).toMatchObject({ transfer: false, transferSource: null, category: null, categorySource: null })
    expect(resto[0]).toBe(aplicado[1])
    expect(resto[1]).toBe(aplicado[2])
  })
  it('outra regra comum que sobra assume o lançamento (deixa de ser transferência)', () => {
    const aplicado = applyRules([e()], [transferRule('ted financiamento')])
    const [x] = recalculateRuleCategories(aplicado, [regra('ted', 'Moradia')])
    expect(x).toMatchObject({ transfer: false, transferSource: null, category: 'Moradia', categorySource: 'rule' })
  })
})

describe('rulesStore + financeStore', () => {
  it('addUserRule com categoria de "Não é gasto" grava action "transfer"; categoria comum não', async () => {
    const rules = useRulesStore()
    const a = await rules.addUserRule('ted financiamento', 'Pagamento de fatura')
    expect(a.action).toBe('transfer')
    const b = await rules.addUserRule('padaria', 'Alimentação')
    expect(b.action).toBeUndefined()
    // trocar a categoria da mesma regra atualiza a action
    expect((await rules.addUserRule('ted financiamento', 'Moradia')).action).toBeUndefined()
  })

  it('aplicar e remover pela store (no lugar)', async () => {
    const rules = useRulesStore()
    const finance = useFinanceStore()
    await finance.addEntries([{ id: 'a', dueDate: '2026-09-10', description: 'TED FINANCIAMENTO', forecast: 50, source: 'santander', type: 'out' }])
    const rule = await rules.addUserRule('ted financiamento', 'Pagamento de fatura')
    expect(await finance.applyRules(rules.rules)).toBe(1)
    expect(finance.entries[0]).toMatchObject({ transfer: true, transferSource: 'rule', category: 'Pagamento de fatura' })
    await rules.removeRule(rule.id)
    expect(await finance.recalculateRules(rules.rules)).toBe(1)
    expect(finance.entries[0]).toMatchObject({ transfer: false, category: null })
  })

  it('setEntryCategory com categoria de "Não é gasto" → transfer, manual', async () => {
    const finance = useFinanceStore()
    await finance.addEntries([{ id: 'a', dueDate: '2026-09-10', description: 'PAGAMENTO TITULO', forecast: 50, source: 'santander', type: 'out' }])
    await finance.setEntryCategory(finance.entries[0].id, 'Pagamento de fatura')
    expect(finance.entries[0]).toMatchObject({ transfer: true, transferSource: 'manual', category: 'Pagamento de fatura', categorySource: 'manual' })
    // categoria comum devolve a Saída
    await finance.setEntryCategory(finance.entries[0].id, 'Moradia')
    expect(finance.entries[0]).toMatchObject({ transfer: false, category: 'Moradia', categorySource: 'manual' })
  })
})
