import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { itemsFromDocument, detectPdfSource } from '@/modules/importers/pdf.js'
import { parseMercadoPagoItems, verifyStatement } from '@/modules/importers/mercadoPagoParser.js'

// ─── itens montados à mão (sem PDF) ──────────────────────────────────────
const COL = { data: 40, desc: 110, id: 340, valor: 430, saldo: 500 }
const item = (str, x, y) => ({ str, x, y, width: str.length * 4 })
const money = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

/** Cabeçalho do documento (1ª página). */
const docHeader = ({ entradas, saidas, inicial, final }) => [
  item('EXTRATO DE CONTA', 40, 40), item('Mercado Pago', 440, 40),
  item('Marina Exemplo Santos', 40, 70), item('CPF/CNPJ: 000.000.000-00', 40, 82),
  item('Periodo: De 01-10-2026 al 31-10-2026', 40, 116),
  item(`Entradas: ${money(entradas)}`, 40, 140), item(`Saidas: ${money(saidas)}`, 40, 152),
  item(`Saldo inicial: ${money(inicial)}`, 40, 164), item(`Saldo final: ${money(final)}`, 40, 176),
  item('DETALHE DOS MOVIMENTOS', 40, 205)
]
const tableHeader = (y) => [item('Data', COL.data, y), item('Descrição', COL.desc, y), item('ID da operação', COL.id, y), item('Valor', COL.valor, y), item('Saldo', COL.saldo, y)]
const footer = (n) => [item('Data de geração: 22-10-2026', 40, 790), item('SAC 0800 000 0000', 40, 800), item('CNPJ 00.000.000/0001-00', 40, 810), item(`${n}/2`, 520, 822)]

/** Âncora (data/ID/valor/saldo em y) com fragmentos de descrição em y + deslocamento. */
const row = (y, { date = '02-10-2026', id, valor, saldo, desc }) => [
  item(date, COL.data, y), item(id, COL.id, y), item(money(valor), COL.valor, y), item(money(saldo), COL.saldo, y),
  ...desc.map(([dy, text]) => item(text, COL.desc, y + dy))
]

const TOTALS = { entradas: 150, saidas: -40, inicial: 10, final: 120 }
const page1 = (rows, totals = TOTALS) => [...docHeader(totals), ...tableHeader(225), ...rows.flat(), ...footer(1)]

describe('montagem da descrição', () => {
  it('1 linha (na própria âncora)', () => {
    const rows = [row(250, { id: '100000000001', valor: 150, saldo: 160, desc: [[0, 'Rendimentos']] }),
      row(310, { id: '100000000002', valor: -40, saldo: 120, desc: [[0, 'Compra simples']] })]
    const { entries } = parseMercadoPagoItems([page1(rows)])
    expect(entries.map(e => e.description)).toEqual(['Rendimentos', 'Compra simples'])
  })

  it('2 linhas (acima e na âncora) e 3 linhas (acima, na âncora e abaixo)', () => {
    const rows = [
      row(250, { id: '100000000001', valor: 150, saldo: 160, desc: [[-10, 'Pagamento com Pix'], [0, 'Padaria Pao Quente']] }),
      row(310, { id: '100000000002', valor: -40, saldo: 120, desc: [[-10, 'Compra no cartao'], [0, 'Loja Exemplo'], [10, 'Filial 02']] })
    ]
    const { entries } = parseMercadoPagoItems([page1(rows)])
    expect(entries.map(e => e.description)).toEqual(['Pagamento com Pix Padaria Pao Quente', 'Compra no cartao Loja Exemplo Filial 02'])
  })

  it('a linha abaixo da última âncora, perto dela, continua sendo dela', () => {
    const rows = [
      row(250, { id: '100000000001', valor: 150, saldo: 160, desc: [[0, 'Rendimentos']] }),
      row(310, { id: '100000000002', valor: -40, saldo: 120, desc: [[-10, 'Compra'], [0, 'Loja'], [10, 'Final']] })
    ]
    const { entries } = parseMercadoPagoItems([page1(rows)])
    expect(entries[1].description).toBe('Compra Loja Final')
  })

  it('descrição que começa no fim de uma página e termina no topo da próxima', () => {
    const p1 = page1([row(250, { id: '100000000001', valor: 150, saldo: 160, desc: [[0, 'Rendimentos']] }),
      row(310, { id: '100000000002', valor: -10, saldo: 150, desc: [[0, 'Pix enviado Joao']] }),
      [item('Pagamento com Pix Restaurante', COL.desc, 360)]]) // começo da descrição, longe da última âncora
    const p2 = [...tableHeader(60), ...row(95, { id: '100000000003', valor: -30, saldo: 120, date: '03-10-2026', desc: [[0, 'Sabor da Serra'], [10, 'Mesa 12']] }), ...footer(2)]
    const { entries } = parseMercadoPagoItems([p1, p2])
    expect(entries).toHaveLength(3)
    expect(entries[2].description).toBe('Pagamento com Pix Restaurante Sabor da Serra Mesa 12')
    expect(entries[1].description).toBe('Pix enviado Joao')
  })

  it('ignora cabeçalho do documento, cabeçalho repetido da tabela e rodapé', () => {
    const p1 = page1([row(250, { id: '100000000001', valor: 150, saldo: 160, desc: [[0, 'Rendimentos']] })], { entradas: 150, saidas: 0, inicial: 10, final: 160 })
    const { entries } = parseMercadoPagoItems([p1])
    expect(entries).toHaveLength(1)
    expect(entries[0].description).toBe('Rendimentos')
  })

  it('mapeia para o modelo canônico', () => {
    const p1 = page1([row(250, { id: '100000000001', valor: 150, saldo: 160, desc: [[0, 'Pix recebido Marina Exemplo Santos']] }),
      row(310, { id: '100000000002', valor: -40, saldo: 120, desc: [[0, 'Compra']] })])
    const { entries, summary } = parseMercadoPagoItems([p1], { importId: 'imp-9' })
    expect(summary).toMatchObject({ holder: 'Marina Exemplo Santos', periodStart: '2026-10-01', periodEnd: '2026-10-31', saldoInicial: 10, saldoFinal: 120 })
    expect(entries[0]).toMatchObject({ dueDate: '2026-10-02', forecast: 150, paid: 150, status: 'paid', type: 'in', transfer: true,
      category: 'Transferência entre contas', externalId: '100000000001', account: 'mercadopago-conta', source: 'mercadopago', importId: 'imp-9' })
    expect(entries[1]).toMatchObject({ forecast: 40, type: 'out', transfer: false, category: null })
  })
})

// ─── conferência ─────────────────────────────────────────────────────────
describe('conferência com os totais impressos', () => {
  const rows = [row(250, { id: '100000000001', valor: 150, saldo: 160, desc: [[0, 'Rendimentos']] }),
    row(310, { id: '100000000002', valor: -40, saldo: 120, desc: [[0, 'Compra']] })]

  it('passa quando tudo bate', () => {
    expect(() => parseMercadoPagoItems([page1(rows)])).not.toThrow()
  })

  it.each([
    ['Entradas', { ...TOTALS, entradas: 151 }, 'Entradas, esperado R$ 151,00, calculado R$ 150,00'],
    ['Saídas', { ...TOTALS, saidas: -41 }, 'Saídas, esperado R$ 41,00, calculado R$ 40,00'],
    ['Saldo final', { ...TOTALS, final: 125 }, 'Saldo final, esperado R$ 125,00, calculado R$ 120,00']
  ])('falha no total: %s', (_, totals, trecho) => {
    expect(() => parseMercadoPagoItems([page1(rows, totals)])).toThrow(`Extrato não conferiu: ${trecho}. Nada foi importado.`)
  })

  it('falha no saldo corrente', () => {
    const quebrado = [rows[0], row(310, { id: '100000000002', valor: -40, saldo: 119, desc: [[0, 'Compra']] })]
    expect(() => parseMercadoPagoItems([page1(quebrado)])).toThrow('Extrato não conferiu: saldo após a operação 100000000002, esperado R$ 119,00, calculado R$ 120,00')
  })

  it('tolera 1 centavo de diferença no saldo corrente', () => {
    const ok = [rows[0], row(310, { id: '100000000002', valor: -40, saldo: 120.01, desc: [[0, 'Compra']] })]
    expect(() => parseMercadoPagoItems([page1(ok)])).not.toThrow()
  })

  it('a 1ª operação parte do saldo inicial', () => {
    const errada = [row(250, { id: '100000000001', valor: 150, saldo: 165, desc: [[0, 'Rendimentos']] }), rows[1]]
    expect(() => parseMercadoPagoItems([page1(errada)])).toThrow('saldo após a operação 100000000001')
  })

  it('verifyStatement direto', () => {
    const summary = { saldoInicial: 0, entradas: 10, saidas: -4, saldoFinal: 6 }
    const m = [{ id: '1', amount: 10, balance: 10 }, { id: '2', amount: -4, balance: 6 }]
    expect(() => verifyStatement(m, summary)).not.toThrow()
    expect(() => verifyStatement(m, { ...summary, saldoFinal: 7 })).toThrow('Saldo final')
  })

  it('cabeçalho do documento incompleto recusa o extrato', () => {
    const items = page1(rows).filter(i => !i.str.startsWith('Saldo final'))
    expect(() => parseMercadoPagoItems([items])).toThrow('Cabeçalho do extrato incompleto (Saldo final)')
  })
})

// ─── cabeçalho com rótulo e valor em itens separados (layout do extrato real) ───
describe('cabeçalho: leitura por par rótulo → valor', () => {
  // totais do extrato real: 0,08 + 7.031,38 - 6.651,13 = 380,33
  const movimentos = [
    ...row(250, { id: '100000000001', valor: 7031.38, saldo: 7031.46, desc: [[0, 'Pix recebido Carlos Terceiro Lima']] }),
    ...row(310, { id: '100000000002', valor: -6651.13, saldo: 380.33, desc: [[0, 'Pagamento de fatura']] })
  ]
  const comum = [
    item('EXTRATO DE CONTA', 44.3, 40), item('Mercado Pago', 440, 40),
    item('Marina Exemplo Santos', 44.3, 60), item('CPF/CNPJ: 000.000.000-00', 44.3, 72),
    item('Periodo:', 44.3, 90), item('De 01-10-2026 al 31-10-2026', 88.1, 90),
    ...tableHeader(150), ...movimentos, ...footer(1)
  ]
  // coordenadas reais do pdfjs: Saldo inicial à esquerda, Entradas/Saidas empilhadas no meio, Saldo final à direita
  const real = [
    item('Saldo inicial:', 44.3, 113.3), item('R$ 0,08', 88.1, 113.3),
    item('Entradas:', 178.3, 106.8), item('R$ 7.031,38', 211.6, 106.8),
    item('Saidas:', 178.3, 119.8), item('R$ -6.651,13', 204.3, 119.8),
    item('Saldo final:', 326.7, 114.3), item('R$ 380,33', 365.6, 114.3)
  ]
  const esperado = { saldoInicial: 0.08, entradas: 7031.38, saidas: -6651.13, saldoFinal: 380.33 }

  it('layout real: Saldo inicial e Saldo final na mesma linha agrupada', () => {
    const { summary, entries } = parseMercadoPagoItems([[...comum, ...real]])
    expect(summary).toMatchObject({ ...esperado, periodStart: '2026-10-01', periodEnd: '2026-10-31', holder: 'Marina Exemplo Santos' })
    expect(entries).toHaveLength(2)
  })

  it('independe da ordem dos itens (inclusive o período)', () => {
    const { summary } = parseMercadoPagoItems([[...comum, ...real].reverse()])
    expect(summary).toMatchObject({ ...esperado, periodStart: '2026-10-01', periodEnd: '2026-10-31' })
  })

  it('os quatro rótulos na mesma linha', () => {
    const naMesmaLinha = [
      item('Saldo inicial:', 44.3, 113.3), item('R$ 0,08', 88.1, 113.3),
      item('Entradas:', 178.3, 113.0), item('R$ 7.031,38', 211.6, 113.0),
      item('Saidas:', 270.3, 113.8), item('R$ -6.651,13', 296.3, 113.8),
      item('Saldo final:', 380.7, 113.3), item('R$ 380,33', 419.6, 113.3)
    ]
    const { summary } = parseMercadoPagoItems([[...comum, ...naMesmaLinha]])
    expect(summary).toMatchObject(esperado)
  })

  it('valor a mais de 3 px de altura do rótulo não é o valor dele', () => {
    const torto = real.map(i => (i.str === 'R$ 380,33' ? { ...i, y: i.y + 4 } : i))
    expect(() => parseMercadoPagoItems([[...comum, ...torto]])).toThrow('Cabeçalho do extrato incompleto (Saldo final)')
  })

  it('rótulo sem valor à direita é cabeçalho incompleto', () => {
    const semValor = real.filter(i => i.str !== 'R$ 0,08')
    expect(() => parseMercadoPagoItems([[...comum, ...semValor]])).toThrow('Cabeçalho do extrato incompleto (Saldo inicial)')
  })

  it('período fora do cabeçalho é cabeçalho incompleto', () => {
    const semPeriodo = comum.filter(i => !i.str.startsWith('De 01') && i.str !== 'Periodo:')
    expect(() => parseMercadoPagoItems([[...semPeriodo, ...real]])).toThrow('Cabeçalho do extrato incompleto (periodo)')
  })
})

// ─── contra o PDF sintético (pdfjs no Node) ──────────────────────────────
describe('PDF sintético', () => {
  const load = async (nome) => {
    const data = new Uint8Array(readFileSync(`tests/fixtures/${nome}`))
    return itemsFromDocument(await getDocument({ data, useSystemFonts: true }).promise)
  }

  it('detecta a fonte e lê os 12 movimentos', async () => {
    const { pages } = await load('mercadopago_extrato.pdf')
    expect(pages).toHaveLength(2)
    expect(detectPdfSource(pages)).toBe('mercadopago')
    const { entries, summary } = parseMercadoPagoItems(pages)
    expect(entries).toHaveLength(12)
    expect(summary.holder).toBe('Marina Exemplo Santos')
    expect(entries[8].description).toBe('Pagamento com Pix Restaurante Sabor da Serra Unidade Centro Mesa 12') // cruza a página
    expect(entries[5].description).toBe('Pagamento com Pix Padaria Pao Quente Ltda Filial 02') // 3 linhas
    expect(entries.filter(e => e.transfer).map(e => e.description)).toEqual([
      'Pix recebido Marina Exemplo Santos', 'Dinheiro retirado Reserva Viagem', 'Pagamento de fatura', 'Dinheiro reservado Reserva Viagem'])
    expect(entries.filter(e => e.category === 'Rendimentos')).toHaveLength(2)
  })

  it('recusa o extrato com Saldo final errado', async () => {
    const { pages } = await load('mercadopago_totais_errados.pdf')
    expect(() => parseMercadoPagoItems(pages)).toThrow('Extrato não conferiu: Saldo final, esperado R$ 9.999,99, calculado R$ 2.153,36. Nada foi importado.')
  })
})

describe('detectPdfSource', () => {
  const pages = (...strs) => [strs.map((str, i) => item(str, 40, 40 + i * 12))]
  it('Mercado Pago', () => expect(detectPdfSource(pages('EXTRATO DE CONTA', 'Mercado Pago'))).toBe('mercadopago'))
  it('Santander', () => expect(detectPdfSource(pages('Santander', 'EXTRATO CONSOLIDADO INTELIGENTE'))).toBe('santander'))
  it('desconhecido', () => {
    expect(detectPdfSource(pages('Banco X', 'EXTRATO DE CONTA'))).toBeNull()
    expect(detectPdfSource(pages('Mercado Pago', 'Fatura'))).toBeNull()
  })
})
