import { describe, it, expect } from 'vitest'
import { classifyMercadoPago } from '@/modules/importers/mercadoPagoRules.js'

const HOLDER = 'Marina Exemplo Santos'

describe('classifyMercadoPago', () => {
  it('Rendimentos é receita real, não transferência', () => {
    expect(classifyMercadoPago('Rendimentos', HOLDER)).toEqual({ category: 'Rendimentos' })
    expect(classifyMercadoPago('  RENDIMENTOS ', HOLDER)).toEqual({ category: 'Rendimentos' })
  })

  it.each(['Dinheiro retirado Reserva Viagem', 'Dinheiro reservado Reserva Viagem', 'dinheiro RETIRADO'])('%s → Investimentos', (d) => {
    expect(classifyMercadoPago(d, HOLDER)).toEqual({ transfer: true, category: 'Investimentos' })
  })

  it('Pagamento de fatura é transferência', () => {
    expect(classifyMercadoPago('Pagamento de fatura', HOLDER)).toEqual({ transfer: true, category: 'Pagamento de fatura' })
  })

  it.each([
    'Pix recebido Marina Exemplo Santos',
    'Pix enviado marina exemplo santos',
    'Transferência enviada para Marina Exemplo Santos',
    'Pix recebido Mãrina Exemplo Santos'.replace('ã', 'a')
  ])('%s → transferência entre contas', (d) => {
    expect(classifyMercadoPago(d, HOLDER)).toEqual({ transfer: true, category: 'Transferência entre contas' })
  })

  it('Pix de terceiro NÃO é transferência', () => {
    expect(classifyMercadoPago('Pix recebido Carlos Terceiro Lima', HOLDER)).toEqual({})
    expect(classifyMercadoPago('Pix enviado Joao Prestador Servicos', HOLDER)).toEqual({})
  })

  it('titular desconhecido nunca marca transferência por nome', () => {
    expect(classifyMercadoPago('Pix recebido Marina Exemplo Santos', '')).toEqual({})
  })

  it('compra comum não tem regra', () => {
    expect(classifyMercadoPago('Compra Mercado Livre', HOLDER)).toEqual({})
  })
})
