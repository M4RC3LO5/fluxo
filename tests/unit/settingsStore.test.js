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
const { useFinanceStore } = await import('@/stores/financeStore.js')
const { refreshOwnTransfers } = await import('@/modules/transfers/transferService.js')

beforeEach(() => { disco.clear(); setActivePinia(createPinia()) })

describe('settingsStore', () => {
  it('adiciona o titular sem duplicar (acento, caixa e espaços) e grava', async () => {
    const s = useSettingsStore()
    expect(await s.addHolderName('  Marina   Exemplo Santos ')).toBe(true)
    expect(await s.addHolderName('MARÍNA EXEMPLO SANTOS')).toBe(false)
    expect(s.holderNames).toEqual(['Marina Exemplo Santos'])
    expect(disco.get('s')).toEqual({ holderNames: ['Marina Exemplo Santos'] })
  })
  it('ignora nome vazio', async () => {
    const s = useSettingsStore()
    expect(await s.addHolderName('   ')).toBe(false)
    expect(await s.addHolderName(null)).toBe(false)
  })
  it('remove e hidrata de volta', async () => {
    const s = useSettingsStore()
    await s.addHolderName('Marina Exemplo Santos')
    await s.addHolderName('Outro Nome Completo')
    await s.removeHolderName('marina exemplo santos')
    expect(s.holderNames).toEqual(['Outro Nome Completo'])
    setActivePinia(createPinia())
    const novo = useSettingsStore()
    await novo.hydrate()
    expect(novo.holderNames).toEqual(['Outro Nome Completo'])
  })
  it('hidratação ignora lixo', async () => {
    disco.set('s', { holderNames: ['Ok Nome Completo', '', 42, null] })
    const s = useSettingsStore()
    await s.hydrate()
    expect(s.holderNames).toEqual(['Ok Nome Completo'])
  })
})

describe('refreshOwnTransfers', () => {
  const lanc = (id, description, extra = {}) => ({ id, description, dueDate: '2026-09-10', forecast: 100, status: 'paid', type: 'out', account: 'nubank-conta',
    transfer: false, transferSource: null, pairedWith: null, category: null, categorySource: null, ...extra })

  it('marca por nome, grava só quando muda e é idempotente', async () => {
    const f = useFinanceStore()
    const s = useSettingsStore()
    f.entries = [lanc('a', 'Transferência enviada pelo Pix - MARINA EXEMPLO SANTOS PER - •••'), lanc('b', 'Compra')]
    expect(await refreshOwnTransfers()).toBe(0) // sem nome configurado
    await s.addHolderName('Marina Exemplo Santos Pereira')
    expect(await refreshOwnTransfers()).toBe(1)
    expect(f.entries[0]).toMatchObject({ transfer: true, transferSource: 'name' })
    expect(f.entries[1].transfer).toBe(false)
    expect(await refreshOwnTransfers()).toBe(0) // idempotente
  })

  it('desfazer e marcar passam pela store e ficam gravados', async () => {
    const f = useFinanceStore()
    const s = useSettingsStore()
    await s.addHolderName('Marina Exemplo Santos Pereira')
    f.entries = [lanc('a', 'Pix enviado MARINA EXEMPLO SANTOS PER'), lanc('b', 'Pix enviado Terceiro Qualquer')]
    await refreshOwnTransfers()
    await f.undoOwnTransfer('a')
    expect(f.entries[0]).toMatchObject({ transfer: false, transferSource: 'manual' })
    await refreshOwnTransfers()
    expect(f.entries[0].transfer).toBe(false) // não volta
    await f.markOwnTransfer('b')
    expect(f.entries[1]).toMatchObject({ transfer: true, transferSource: 'manual' })
  })

  it('remover o nome desfaz o que era só por nome', async () => {
    const f = useFinanceStore()
    const s = useSettingsStore()
    await s.addHolderName('Marina Exemplo Santos Pereira')
    f.entries = [lanc('a', 'Pix enviado MARINA EXEMPLO SANTOS PER')]
    await refreshOwnTransfers()
    expect(f.entries[0].transfer).toBe(true)
    await s.removeHolderName('Marina Exemplo Santos Pereira')
    await refreshOwnTransfers()
    expect(f.entries[0]).toMatchObject({ transfer: false, transferSource: null, category: null })
  })
})
