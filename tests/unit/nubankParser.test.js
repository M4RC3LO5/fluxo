import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { detectNubankLayout, parseNubank } from '@/modules/importers/nubankParser.js'

const fixture = (nome) => new File([readFileSync(`tests/fixtures/${nome}`)], basename(nome), { type: 'text/csv' })
const csv = (texto) => new File([texto], 'x.csv', { type: 'text/csv' })

describe('detectNubankLayout', () => {
  it('conta', () => expect(detectNubankLayout(['Data', 'Valor', 'Identificador', 'Descrição'])).toBe('conta'))
  it('conta sem acento e com espaços', () => expect(detectNubankLayout([' data ', 'VALOR', 'identificador', 'Descricao'])).toBe('conta'))
  it('cartão', () => expect(detectNubankLayout(['date', 'title', 'amount'])).toBe('cartao'))
  it('cartão com categoria', () => expect(detectNubankLayout(['date', 'category', 'title', 'amount'])).toBe('cartao'))
  it('desconhecido', () => {
    expect(detectNubankLayout(['a', 'b'])).toBeNull()
    expect(detectNubankLayout([])).toBeNull()
  })
})

describe('parseNubank — conta', () => {
  it('converte as linhas válidas e avisa da inválida', async () => {
    const { entries, warnings, layout } = await parseNubank(fixture('nubank_conta.csv'), { importId: 'imp-1' })
    expect(layout).toBe('conta')
    expect(entries).toHaveLength(5)
    expect(warnings).toEqual(['Linha 7 ignorada: data inválida ("31/02/2026").'])

    const enviado = entries[0]
    expect(enviado).toMatchObject({
      dueDate: '2026-11-05', description: 'Transferência enviada pelo Pix - Maria Souza',
      forecast: 150, paid: 150, status: 'paid', type: 'out',
      externalId: 'id-0001', account: 'nubank-conta', source: 'nubank', importId: 'imp-1'
    })
    const recebido = entries[1]
    expect(recebido).toMatchObject({ forecast: 320.5, type: 'in', externalId: 'id-0002' })
    expect(entries[3]).toMatchObject({ description: 'Pagamento de fatura', forecast: 1234.56, type: 'out' })
    expect(entries[4]).toMatchObject({ forecast: 2500, type: 'in' })
    expect(new Set(entries.map(e => e.id)).size).toBe(5)
  })

  it('avisa de valor inválido', async () => {
    const { entries, warnings } = await parseNubank(csv('Data,Valor,Identificador,Descrição\n01/11/2026,abc,i1,X\n02/11/2026,10.00,i2,Y\n'))
    expect(entries).toHaveLength(1)
    expect(warnings[0]).toBe('Linha 2 ignorada: valor inválido ("abc").')
  })
})

describe('parseNubank — cartão', () => {
  it('compras são saída; pagamento e estorno são entrada', async () => {
    const { entries, warnings, layout } = await parseNubank(fixture('nubank_cartao.csv'))
    expect(layout).toBe('cartao')
    expect(warnings).toEqual([])
    expect(entries.map(e => e.type)).toEqual(['out', 'out', 'out', 'in', 'in'])
    expect(entries.map(e => e.forecast)).toEqual([189.9, 99.9, 76.5, 1234.56, 32])
    expect(entries[1].description).toBe('Loja X - Parcela 2/10')
    expect(entries[0]).toMatchObject({ dueDate: '2026-11-01', externalId: null, account: 'nubank-cartao', category: null, status: 'paid', paid: 189.9 })
  })

  it('lê a categoria, separador ; e BOM', async () => {
    const { entries, layout } = await parseNubank(fixture('nubank_cartao_categoria.csv'))
    expect(layout).toBe('cartao')
    expect(entries.map(e => e.category)).toEqual(['mercado', 'transporte', 'restaurante'])
    expect(entries[0]).toMatchObject({ forecast: 54.9, type: 'out' })
  })
})

describe('parseNubank — erros', () => {
  it('cabeçalho desconhecido', async () => {
    await expect(parseNubank(csv('a;b\n1;2\n'))).rejects.toThrow('CSV não reconhecido como extrato Nubank')
  })
  it('sem nenhuma linha válida', async () => {
    await expect(parseNubank(csv('date,title,amount\nxx,Y,1\n'))).rejects.toThrow('Nenhum lançamento válido')
  })
})
