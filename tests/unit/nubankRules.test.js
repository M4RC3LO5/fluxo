import { describe, it, expect } from 'vitest'
import { classifyNubank } from '@/modules/importers/nubankRules.js'

describe('classifyNubank — cartão', () => {
  it.each([
    ['Pagamento recebido', { transfer: true, category: 'Pagamento de fatura' }],
    ['  pagamento   RECEBIDO ', { transfer: true, category: 'Pagamento de fatura' }],
    ['Saldo em atraso', { transfer: true, category: 'Saldo anterior' }],
    ['Multa de atraso', { category: 'Encargos' }],
    ['Juros de atraso', { category: 'Encargos' }],
    ['IOF de atraso', { category: 'Encargos' }],
    ['IOF de "Loja X"', { category: 'IOF' }],
    ['Estorno de "Loja Y" (Y)', { category: 'Estorno' }],
    ['Loja Z - Parcela 2/10', { installment: { current: 2, total: 10 } }],
    ['Café com acento - PARCELA 10/12', { installment: { current: 10, total: 12 } }]
  ])('%s', (descricao, esperado) => {
    expect(classifyNubank(descricao, 'cartao')).toEqual(esperado)
  })

  it('compra comum não tem regra', () => {
    expect(classifyNubank('Supermercado Bom Preço', 'cartao')).toEqual({})
    expect(classifyNubank('Parcela sem formato', 'cartao')).toEqual({})
  })
})

describe('classifyNubank — conta', () => {
  it.each([
    ['Resgate RDB', { transfer: true, category: 'Investimentos' }],
    ['Aplicação RDB', { transfer: true, category: 'Investimentos' }],
    ['Aplicacao RDB Nuconta', { transfer: true, category: 'Investimentos' }],
    ['Pagamento de fatura', { transfer: true, category: 'Pagamento de fatura' }]
  ])('%s', (descricao, esperado) => {
    expect(classifyNubank(descricao, 'conta')).toEqual(esperado)
  })

  it('regras do cartão não valem na conta e vice-versa', () => {
    expect(classifyNubank('Pagamento recebido', 'conta')).toEqual({})
    expect(classifyNubank('Resgate RDB', 'cartao')).toEqual({})
  })

  it('Pix comum não tem regra', () => {
    expect(classifyNubank('Transferência enviada pelo Pix - Maria', 'conta')).toEqual({})
  })
})
