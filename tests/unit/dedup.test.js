import { describe, it, expect } from 'vitest'
import { dedupKey } from '@/modules/importers/dedup.js'

const base = { dueDate: '2026-11-05', forecast: 10.1, description: '  Café   da Equipe ', source: 'xlsx' }

describe('dedupKey', () => {
  it('sem externalId: vencimento | centavos | descrição normalizada', () => {
    expect(dedupKey(base)).toBe('2026-11-05|1010|cafe da equipe')
  })
  it('ignora acento, caixa e espaços repetidos', () => {
    expect(dedupKey({ ...base, description: 'CAFE da equipe' })).toBe(dedupKey(base))
  })
  it('com externalId: fonte|externalId, ignorando os demais campos', () => {
    const a = { ...base, source: 'nubank', externalId: 'id-1' }
    expect(dedupKey(a)).toBe('nubank|id-1')
    expect(dedupKey({ ...a, forecast: 999, description: 'outra' })).toBe('nubank|id-1')
  })
  it('externalId nulo cai na chave padrão; mesma id em fontes diferentes não colide', () => {
    expect(dedupKey({ ...base, externalId: null })).toBe(dedupKey(base))
    expect(dedupKey({ ...base, source: 'nubank', externalId: 'x' })).not.toBe(dedupKey({ ...base, source: 'ofx', externalId: 'x' }))
  })
})
