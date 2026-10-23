import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// sem IndexedDB nos testes unitários: o storage vira no-op e o flush só executa a gravação
vi.mock('@/modules/persistence/storage.js', () => ({
  KEYS: { entries: 'e', history: 'h' },
  load: async () => undefined,
  save: async () => {},
  debounced: (fn) => Object.assign(() => {}, { flush: () => Promise.resolve(fn()) })
}))

const { useFinanceStore } = await import('@/stores/financeStore.js')

const tag = (i = 0) => ({ id: `t${i}-${Math.random()}`, dueDate: '2026-11-07', description: 'Pedagio Tag', forecast: 3.99, source: 'nubank' })
const lote = (n) => Array.from({ length: n }, (_, i) => tag(i))

describe('addEntries — duplicata por contagem', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useFinanceStore()
  })

  // existentes × novos → adicionados
  it.each([
    [0, 2, 2],
    [1, 2, 1],
    [2, 2, 0],
    [3, 2, 0],
    [1, 3, 2],
    [2, 3, 1]
  ])('existentes %i, novos %i → adiciona %i', async (existentes, novos, adicionados) => {
    store.entries = lote(existentes)
    const r = await store.addEntries(lote(novos))
    expect(r).toEqual({ added: adicionados, skipped: novos - adicionados })
    expect(store.entries).toHaveLength(existentes + adicionados)
  })

  it('repetição só dentro do mesmo lote entra inteira', async () => {
    const r = await store.addEntries(lote(3))
    expect(r).toEqual({ added: 3, skipped: 0 })
  })

  it('chaves diferentes não se cancelam', async () => {
    store.entries = lote(2)
    const r = await store.addEntries([{ ...tag(), description: 'Outro' }, { ...tag(), forecast: 4 }])
    expect(r.added).toBe(2)
  })
})
