import { describe, it, expect } from 'vitest'
import { classifySantander } from '@/modules/importers/santanderRules.js'

const HOLDER = 'MARINA EXEMPLO SANTOS PEREIRA'
const TRUNC = 'MARINA EXEMPLO SANTOS PER' // 25 caracteres

describe('classifySantander — transferência entre contas', () => {
  it.each([
    ['PIX RECEBIDO'], ['PIX ENVIADO OPEN FINANCE'], ['TED'], ['TRANSFERENCIA ENTRE CONTAS'], ['TRANSF ENTRE CONTAS'], ['Pix recebido']
  ])('%s + titular truncado em 25 chars', (primeira) => {
    expect(classifySantander([primeira, TRUNC], HOLDER)).toEqual({ transfer: true, category: 'Transferência entre contas' })
  })

  it('nome completo e caixa/acentos diferentes também valem', () => {
    expect(classifySantander(['PIX RECEBIDO', HOLDER], HOLDER)).toMatchObject({ transfer: true })
    expect(classifySantander(['PIX RECEBIDO', 'marina exemplo santos per'], 'Márina Exemplo Santos Pereira')).toMatchObject({ transfer: true })
  })

  it('Pix de terceiro NÃO é transferência', () => {
    expect(classifySantander(['PIX RECEBIDO', 'CARLOS TERCEIRO LIMA'], HOLDER)).toEqual({})
    expect(classifySantander(['PIX ENVIADO', 'MARINA OUTRA PESSOA'], HOLDER)).toEqual({})
  })

  it('prefixo curto (< 10 caracteres) não basta', () => {
    expect(classifySantander(['PIX RECEBIDO', 'MARINA'], HOLDER)).toEqual({})
    expect(classifySantander(['PIX RECEBIDO', 'MARINA EX'], HOLDER)).toEqual({}) // 9
    expect(classifySantander(['PIX RECEBIDO', 'MARINA EXE'], HOLDER)).toMatchObject({ transfer: true }) // 10
  })

  it('exige a 2ª linha e o titular', () => {
    expect(classifySantander(['PIX RECEBIDO'], HOLDER)).toEqual({})
    expect(classifySantander(['PIX RECEBIDO', TRUNC], '')).toEqual({})
  })

  it('só vale para Pix/TED/transferência na 1ª linha', () => {
    expect(classifySantander(['COMPRA CARTAO', TRUNC], HOLDER)).toEqual({})
    expect(classifySantander(['TEDDY LOJA', TRUNC], HOLDER)).toEqual({})
  })
})

describe('classifySantander — categorias', () => {
  it.each([
    [['REMUNERACAO APLICACAO AUTOMATICA'], 'Rendimentos'],
    [['OPERACOES CREDITO IMOBILIARIO', 'PREST CR IM'], 'Financiamento imobiliário'],
    [['TARIFA MENSAL PACOTE', 'SERVICOS'], 'Tarifas bancárias'],
    [['JUROS CHEQUE ESPECIAL'], 'Encargos'],
    [['IOF OPERACAO CREDITO', 'CONTRATO 0098'], 'Encargos'],
    [['  operações   CRÉDITO imobiliário  '], 'Financiamento imobiliário'], // sem acento/caixa/espaços extras
    [['OPERACOES DE CAMBIO'], undefined]
  ])('%j', (linhas, categoria) => {
    const r = classifySantander(linhas, HOLDER)
    expect(r.category).toBe(categoria)
    expect(r.transfer).toBeUndefined()
  })

  it('compra comum não tem regra', () => {
    expect(classifySantander(['PAGAMENTO IPVA-CANAIS', 'INTERNET LICENCIAMENTO EL'], HOLDER)).toEqual({})
    expect(classifySantander(['DEBITO AUT. TELEFONE CELULAR', 'VIVO MOVEL-SP'], HOLDER)).toEqual({})
  })

  it('"IOFERTA" não é IOF', () => {
    expect(classifySantander(['IOFERTA LOJA'], HOLDER)).toEqual({})
  })
})
