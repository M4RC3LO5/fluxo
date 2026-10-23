import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { itemsFromDocument, detectPdfSource } from '@/modules/importers/pdf.js'
import { parseSantanderItems, parseSantanderAmount } from '@/modules/importers/santanderParser.js'

describe('parseSantanderAmount — sinal no fim', () => {
  it.each([
    ['156,00-', -156],
    ['2.655,88-', -2655.88],
    ['3.226,00', 3226],
    ['0,02', 0.02],
    ['1.234.567,89-', -1234567.89],
    ['  581,55- ', -581.55],
    ['0,00', 0]
  ])('%s', (entrada, esperado) => expect(parseSantanderAmount(entrada)).toBeCloseTo(esperado, 2))

  it.each([[''], ['   '], ['abc'], ['--1,00'], ['-1,00-'], ['1,00-x'], [null], [undefined]])('rejeita %j', (entrada) => {
    expect(parseSantanderAmount(entrada)).toBeNaN()
  })
})

// ─── itens montados à mão (coordenadas do layout real) ───────────────────
const item = (str, x, y) => ({ str, x, y, width: str.length * 4 })
const right = (str, xr, y) => item(str, xr - str.length * 4, y)
const fmt = (n) => Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const signed = (n) => fmt(n) + (n < 0 ? '-' : '')

const frame = (n) => [item('EXTRATO CONSOLIDADO INTELIGENTE', 421, 27), item('janeiro/2026', 511, 36), item(`Pagina: ${n}/3`, 520, 823), item('Extrato_PF_A4_Inteligente', 34, 815)]
const HOLDER = 'MARINA EXEMPLO SANTOS PEREIRA'
const TRUNC = 'MARINA EXEMPLO SANTOS PER'

const resumo = ({ inicial = 100, creditos = 50, debitos = 30, final = 120, holder = HOLDER } = {}) => [
  item('Resumo - janeiro/2026', 34, 290), item('Nome', 34, 316), item(holder, 34, 325),
  item('Saldo de Conta Corrente em 31/12', 34, 345), right(fmt(inicial), 410, 345),
  item('Total de Créditos', 34, 357), right(fmt(creditos), 410, 357),
  item('Depósitos / Transferências', 50, 369), right(fmt(creditos), 410, 369),
  item('Total de Débitos', 34, 393), right(fmt(debitos), 410, 393),
  item('Saldo de Conta Corrente em 31/01', 34, 417), right(fmt(final), 410, 417)
]
const tableTop = (y = 450, inicial = 100) => [
  item('Conta Corrente', 34, y), item('Movimentação', 34, y + 15), ...tableHeader(y + 35),
  item('SALDO EM 31/12', 65, y + 50), right(fmt(inicial), 545, y + 50)
]
const tableHeader = (y) => [item('Data', 34, y), item('Descrição', 65, y), item('Nº Documento', 298, y), item('Movimento (R$)', 408, y), item('Saldo (R$)', 508, y)]

/** Movimento: data (só no 1º do dia), linhas da descrição (a 1ª na âncora, as outras ~9 pt abaixo), valor e saldo opcional. */
const mov = (y, { data, lines, valor, saldo, doc = '-' }) => [
  ...(data ? [item(data, 34, y)] : []),
  ...lines.map((l, i) => item(l, 65, y + 9 * i)),
  item(doc, 312, y), right(signed(valor), 462, y),
  ...(saldo === undefined ? [] : [right(signed(saldo), 545, y)])
]
const closing = (y, valor) => [item('SALDO EM 31/01', 65, y), right(fmt(valor), 545, y)]

/** Documento mínimo coerente: 100 + 50 - 30 = 120. */
const simples = (extra = {}) => [
  [...frame(1), item('Propaganda - Movimentação disponível nas próximas páginas', 34, 200)],
  [...frame(2), ...resumo(extra.resumo), ...tableTop(),
    ...mov(515, { data: '02/01', lines: ['PIX RECEBIDO', 'CARLOS TERCEIRO LIMA'], valor: 50 }),
    ...mov(540, { data: '10/01', lines: ['COMPRA MERCADO'], valor: -30, saldo: 120 }),
    ...closing(570, extra.fechamento ?? 120), ...(extra.depois ?? [])]
]

describe('parseSantanderItems — montagem', () => {
  it('lê titular, mês e totais do Resumo', () => {
    const { summary } = parseSantanderItems(simples())
    expect(summary).toEqual({ holder: HOLDER, month: 'janeiro', year: 2026, saldoInicial: 100, totalCreditos: 50, totalDebitos: 30, saldoFinal: 120 })
  })

  it('descrição em 2 linhas: unida com " - "', () => {
    const { entries } = parseSantanderItems(simples())
    expect(entries.map(e => e.description)).toEqual(['PIX RECEBIDO - CARLOS TERCEIRO LIMA', 'COMPRA MERCADO'])
  })

  it('mapeia para o modelo canônico', () => {
    const { entries } = parseSantanderItems(simples(), { importId: 'imp-1' })
    expect(entries[0]).toMatchObject({ dueDate: '2026-01-02', forecast: 50, paid: 50, status: 'paid', type: 'in', externalId: null,
      account: 'santander-cc', source: 'santander', importId: 'imp-1', transfer: false })
    expect(entries[1]).toMatchObject({ dueDate: '2026-01-10', forecast: 30, type: 'out' })
  })

  it('data herdada: movimentos sem data impressa usam a do anterior', () => {
    const pages = [frame(1), [...frame(2), ...resumo({ creditos: 60, debitos: 40, final: 120 }), ...tableTop(),
      ...mov(515, { data: '02/01', lines: ['A'], valor: 60 }),
      ...mov(530, { lines: ['B'], valor: -25 }), // sem data
      ...mov(545, { lines: ['C'], valor: -15, saldo: 120 }), // sem data
      ...closing(570, 120)]]
    const { entries } = parseSantanderItems(pages)
    expect(entries.map(e => e.dueDate)).toEqual(['2026-01-02', '2026-01-02', '2026-01-02'])
  })

  it('data de dezembro no extrato de janeiro cai no ano anterior', () => {
    const pages = [frame(1), [...frame(2), ...resumo({ creditos: 50, debitos: 30 }), ...tableTop(),
      ...mov(515, { data: '31/12', lines: ['A'], valor: 50 }), ...mov(530, { data: '10/01', lines: ['B'], valor: -30, saldo: 120 }), ...closing(570, 120)]]
    expect(parseSantanderItems(pages).entries.map(e => e.dueDate)).toEqual(['2025-12-31', '2026-01-10'])
  })

  it('Nº Documento numérico e "-" são aceitos', () => {
    const pages = [frame(1), [...frame(2), ...resumo(), ...tableTop(),
      ...mov(515, { data: '02/01', lines: ['A'], valor: 50, doc: '512701' }), ...mov(530, { data: '10/01', lines: ['B'], valor: -30, saldo: 120 }), ...closing(570, 120)]]
    expect(parseSantanderItems(pages).entries).toHaveLength(2)
  })

  it('ignora a propaganda da página 1 (mesmo com a palavra "Movimentação")', () => {
    expect(parseSantanderItems(simples()).entries).toHaveLength(2)
  })

  it('tabela cruzando página: cabeçalho repetido e descrição que continua no topo', () => {
    const p2 = [...frame(2), ...resumo(), ...tableTop(),
      ...mov(515, { data: '02/01', lines: ['PIX RECEBIDO', 'CARLOS TERCEIRO LIMA'], valor: 50 }),
      item('PAGAMENTO CONTA LUZ', 65, 790), item('-', 312, 790), right('30,00-', 462, 790), right('120,00', 545, 790), item('10/01', 34, 790)]
    const p3 = [...frame(3), ...tableHeader(60), item('CONCESSIONARIA ENERGIA', 65, 78), ...closing(100, 120)]
    const { entries } = parseSantanderItems([frame(1), p2, p3])
    expect(entries).toHaveLength(2)
    expect(entries[1].description).toBe('PAGAMENTO CONTA LUZ - CONCESSIONARIA ENERGIA')
  })

  it('seção "Débito Automático" repete movimento e é ignorada', () => {
    const depois = [
      item('Débito Automático em Conta Corrente', 34, 620), ...tableHeader(634),
      ...mov(650, { data: '10/01', lines: ['COMPRA MERCADO'], valor: -30 }),
      item('Poupança', 34, 700), item('SALDO ANTERIOR', 65, 714), right('0,00', 545, 714), item('SALDO ATUAL', 65, 723), right('0,00', 545, 723)
    ]
    const { entries, warnings } = parseSantanderItems(simples({ depois }))
    expect(entries).toHaveLength(2)
    expect(warnings).toEqual([])
  })

  it('outras seções ignoradas não viram lançamentos', () => {
    const depois = ['Saldos por Período', 'Comprovantes de Pagamento', 'Créditos Contratados', 'Investimentos', 'Pacote de Serviços']
      .flatMap((h, i) => [item(h, 34, 620 + i * 40), item('02/01', 34, 634 + i * 40), item('ALGO', 65, 634 + i * 40), item('-', 312, 634 + i * 40), right('9,99', 462, 634 + i * 40)])
    expect(parseSantanderItems(simples({ depois })).entries).toHaveLength(2)
  })

  it('poupança com movimentos: aviso (não erro) e nada importado dela', () => {
    const depois = [item('Poupança', 34, 700), item('05/01', 34, 714), item('CREDITO ANIVERSARIO', 65, 714), right('1,23', 462, 714)]
    const { entries, warnings } = parseSantanderItems(simples({ depois }))
    expect(entries).toHaveLength(2)
    expect(warnings).toEqual(['Movimentos da poupança não foram importados'])
  })

  it('classifica transferência do titular truncado e Pix de terceiro', () => {
    const pages = [frame(1), [...frame(2), ...resumo({ creditos: 90, debitos: 0, final: 190 }), ...tableTop(),
      ...mov(515, { data: '02/01', lines: ['PIX RECEBIDO', TRUNC], valor: 50 }),
      ...mov(535, { data: '03/01', lines: ['PIX RECEBIDO', 'CARLOS TERCEIRO LIMA'], valor: 40, saldo: 190 }), ...closing(570, 190)]]
    const { entries } = parseSantanderItems(pages)
    expect(entries[0]).toMatchObject({ transfer: true, category: 'Transferência entre contas', type: 'in' })
    expect(entries[1]).toMatchObject({ transfer: false, category: null, type: 'in' })
  })
})

describe('parseSantanderItems — conferência com os totais impressos', () => {
  const falha = (pages, trecho) => expect(() => parseSantanderItems(pages)).toThrow(`Extrato não conferiu: ${trecho}. Nada foi importado.`)

  it('passa quando tudo bate', () => {
    expect(() => parseSantanderItems(simples())).not.toThrow()
  })
  it('falha em Total de Créditos', () => falha(simples({ resumo: { creditos: 51 } }), 'Total de Créditos, esperado R$ 51,00, calculado R$ 50,00'))
  it('falha em Total de Débitos', () => falha(simples({ resumo: { debitos: 31 } }), 'Total de Débitos, esperado R$ 31,00, calculado R$ 30,00'))
  it('falha em Saldo final (Resumo)', () => falha(simples({ resumo: { final: 125 } }), 'Saldo final, esperado R$ 125,00, calculado R$ 120,00'))
  it('falha no SALDO EM de fechamento da tabela', () => falha(simples({ fechamento: 121 }), 'Saldo de fechamento da tabela, esperado R$ 121,00, calculado R$ 120,00'))
  it('falha no saldo corrente de um movimento com saldo', () => {
    const pages = [frame(1), [...frame(2), ...resumo(), ...tableTop(),
      ...mov(515, { data: '02/01', lines: ['A'], valor: 50, saldo: 151 }), ...mov(535, { data: '10/01', lines: ['B'], valor: -30 }), ...closing(570, 120)]]
    falha(pages, 'saldo após o movimento de 02/01 (A), esperado R$ 151,00, calculado R$ 150,00')
  })
  it('saldo corrente parte do último ponto conhecido (movimentos sem saldo no meio)', () => {
    const pages = [frame(1), [...frame(2), ...resumo({ creditos: 80, debitos: 30, final: 150 }), ...tableTop(),
      ...mov(515, { data: '02/01', lines: ['A'], valor: 50 }), ...mov(530, { lines: ['B'], valor: 30, saldo: 180 }),
      ...mov(545, { data: '10/01', lines: ['C'], valor: -30, saldo: 151 }), ...closing(570, 150)]]
    falha(pages, 'saldo após o movimento de 10/01 (C), esperado R$ 151,00, calculado R$ 150,00')
  })
  it('falha quando o saldo inicial da tabela difere do Resumo', () => {
    const pages = [frame(1), [...frame(2), ...resumo({ inicial: 100 }), ...tableTop(450, 101),
      ...mov(515, { data: '02/01', lines: ['A'], valor: 50 }), ...mov(535, { data: '10/01', lines: ['B'], valor: -30, saldo: 121 }), ...closing(570, 120)]]
    falha(pages, 'Saldo inicial da tabela, esperado R$ 100,00, calculado R$ 101,00')
  })
  it('Resumo incompleto recusa o extrato', () => {
    const pages = simples()
    pages[1] = pages[1].filter(i => i.str !== 'Total de Débitos')
    expect(() => parseSantanderItems(pages)).toThrow('Resumo do extrato incompleto (Total de Débitos)')
  })
  it('sem SALDO EM de fechamento recusa o extrato', () => {
    const pages = simples()
    pages[1] = pages[1].filter(i => i.str !== 'SALDO EM 31/01')
    expect(() => parseSantanderItems(pages)).toThrow('SALDO EM de fechamento não encontrado')
  })
})

// ─── regressões do extrato real ──────────────────────────────────────────
describe('títulos de seção em x maior que 40 (coordenadas reais)', () => {
  // x/y reais dos títulos: Resumo 62,4 · Conta Corrente 70,8 · Movimentação 34 · Comprovantes 70,8 · Investimentos 62,4 · Pacote 62,4
  const resumoReal = (opts) => resumo(opts).map(i => (i.str.startsWith('Resumo') ? { ...i, x: 62.4, y: 293.3 } : i))
  // y real de "Conta Corrente" = 537,5; "Movimentação", o cabeçalho e o SALDO EM vêm logo abaixo
  const tabelaReal = (inicial) => tableTop(537.5, inicial).map(i => (i.str === 'Conta Corrente' ? { ...i, x: 70.8 } : i))
  const secoesDepois = () => [
    item('Saldos por Período', 34, 690), item('01/01 a 31/01', 65, 704), right('9,99', 462, 704),
    item('Comprovantes de Pagamento', 70.8, 716), item('02/01', 34, 726), item('PAGAMENTO BOLETO', 65, 726), item('-', 312, 726), right('9,99', 462, 726),
    item('Investimentos', 62.4, 738), item('02/01', 34, 748), item('APLICACAO CDB', 65, 748), item('-', 312, 748), right('9,99', 462, 748),
    item('Pacote de Serviços', 62.4, 760), item('Pacote Exemplo Plus', 65, 770), right('38,90', 462, 770),
    item('Fale Conosco', 70.8, 785), item('SAC 0800 000 0000', 65, 795)
  ]

  it('Resumo (x 62,4) e Conta Corrente (x 70,8) são reconhecidos', () => {
    const pages = [frame(1), [...frame(2), ...resumoReal(), ...tabelaReal(100),
      ...mov(605, { data: '02/01', lines: ['PIX RECEBIDO', 'CARLOS TERCEIRO LIMA'], valor: 50 }),
      ...mov(630, { data: '10/01', lines: ['COMPRA MERCADO'], valor: -30, saldo: 120 }), ...closing(655, 120)]]
    const { entries, summary } = parseSantanderItems(pages)
    expect(entries).toHaveLength(2)
    expect(summary).toMatchObject({ holder: HOLDER, saldoInicial: 100, totalCreditos: 50, totalDebitos: 30, saldoFinal: 120 })
  })

  it('seções ignoradas com títulos em x 62,4 / 70,8 não entram', () => {
    const pages = [frame(1), [...frame(2), ...resumoReal(), ...tabelaReal(100),
      ...mov(605, { data: '02/01', lines: ['PIX RECEBIDO', 'CARLOS TERCEIRO LIMA'], valor: 50 }),
      ...mov(630, { data: '10/01', lines: ['COMPRA MERCADO'], valor: -30, saldo: 120 }), ...closing(655, 120), ...secoesDepois()]]
    const { entries, warnings } = parseSantanderItems(pages)
    expect(entries).toHaveLength(2)
    expect(warnings).toEqual([])
  })

  it('descrição que começa em x 65 com valor na linha não é título', () => {
    const pages = [frame(1), [...frame(2), ...resumoReal(), ...tabelaReal(100),
      ...mov(605, { data: '02/01', lines: ['INVESTIMENTOS RESGATE'], valor: 50 }), // começa como um título ignorado, mas tem valor
      ...mov(630, { data: '10/01', lines: ['COMPRA MERCADO'], valor: -30, saldo: 120 }), ...closing(655, 120)]]
    expect(parseSantanderItems(pages).entries.map(e => e.description)).toEqual(['INVESTIMENTOS RESGATE', 'COMPRA MERCADO'])
  })
})

describe('saldo zero é um saldo, não "ausente"', () => {
  // saldo inicial 0,00 · +50 · -50 · fechamento 0,00; depois a Poupança, com a própria "Movimentação" e SALDO ATUAL 0,55
  const zero = (poupanca) => [frame(1), [...frame(2), ...resumo({ inicial: 0, creditos: 50, debitos: 50, final: 0 }), ...tableTop(450, 0),
    ...mov(515, { data: '02/01', lines: ['PIX RECEBIDO', 'CARLOS TERCEIRO LIMA'], valor: 50, saldo: 50 }),
    ...mov(540, { data: '10/01', lines: ['COMPRA MERCADO'], valor: -50, saldo: 0 }), ...closing(570, 0),
    item('Poupança', 34, 620), item('Movimentação', 34, 634), ...tableHeader(648), ...poupanca]]

  it('saldo inicial 0,00 e fechamento 0,00: a Poupança não reabre a tabela', () => {
    const pages = zero([item('SALDO ANTERIOR', 65, 662), right('0,00', 545, 662),
      item('31/01', 34, 676), item('SALDO ATUAL', 65, 676), item('-', 312, 676), right('0,55', 462, 676)])
    const { entries, warnings, summary } = parseSantanderItems(pages)
    expect(entries.map(e => e.description)).toEqual(['PIX RECEBIDO - CARLOS TERCEIRO LIMA', 'COMPRA MERCADO'])
    expect(summary).toMatchObject({ saldoInicial: 0, saldoFinal: 0 })
    expect(warnings).toEqual([])
  })

  it('movimento de verdade na Poupança: aviso, e continua sem importar', () => {
    const pages = zero([item('05/01', 34, 662), item('CREDITO ANIVERSARIO', 65, 662), item('-', 312, 662), right('1,23', 462, 662)])
    const { entries, warnings } = parseSantanderItems(pages)
    expect(entries).toHaveLength(2)
    expect(warnings).toEqual(['Movimentos da poupança não foram importados'])
  })
})

// ─── contra o PDF sintético (pdfjs no Node) ──────────────────────────────
describe('PDF sintético', () => {
  const load = async (nome) => {
    const data = new Uint8Array(readFileSync(`tests/fixtures/${nome}`))
    return itemsFromDocument(await getDocument({ data, useSystemFonts: true }).promise)
  }

  it('detecta a fonte e lê os 12 movimentos', async () => {
    const { pages } = await load('santander_extrato.pdf')
    expect(pages).toHaveLength(3)
    expect(detectPdfSource(pages)).toBe('santander')
    const { entries, summary, warnings } = parseSantanderItems(pages)
    expect(entries).toHaveLength(12) // o Débito Automático repetido não duplica
    expect(warnings).toEqual([])
    expect(summary).toMatchObject({ holder: 'MARINA EXEMPLO SANTOS PEREIRA', month: 'janeiro', year: 2026, saldoInicial: 737.55 })
    expect(entries.filter(e => e.description.startsWith('DEBITO AUT.'))).toHaveLength(1)
    // data herdada e tarifa que cruza a página
    expect(entries.map(e => e.dueDate).slice(0, 5)).toEqual(['2026-01-02', '2026-01-05', '2026-01-05', '2026-01-08', '2026-01-08'])
    expect(entries[4].description).toBe('TARIFA MENSAL PACOTE - SERVICOS')
    expect(entries.filter(e => e.transfer).map(e => e.description)).toEqual([
      'PIX ENVIADO OPEN FINANCE - MARINA EXEMPLO SANTOS PER', 'PIX RECEBIDO - MARINA EXEMPLO SANTOS PER', 'PIX RECEBIDO - MARINA EXEMPLO SANTOS PER'])
    expect(entries.find(e => e.description === 'PIX RECEBIDO - CARLOS TERCEIRO LIMA')).toMatchObject({ transfer: false, type: 'in' })
    expect(entries.find(e => e.description.startsWith('REMUNERACAO'))).toMatchObject({ category: 'Rendimentos', transfer: false })
    expect(entries.find(e => e.description.startsWith('OPERACOES'))).toMatchObject({ category: 'Financiamento imobiliário', type: 'out' })
  })

  it('fecha com saldo zero e a Poupança (SALDO ATUAL 0,55) não vira lançamento', async () => {
    const { pages } = await load('santander_saldo_zero.pdf')
    const { entries, summary, warnings } = parseSantanderItems(pages)
    expect(summary.saldoFinal).toBe(0)
    expect(entries).toHaveLength(13)
    expect(entries.some(e => /SALDO (ATUAL|ANTERIOR)/.test(e.description))).toBe(false)
    expect(entries[12]).toMatchObject({ dueDate: '2026-01-31', forecast: 1144.05, type: 'out' })
    expect(warnings).toEqual([])
  })

  it('recusa o extrato com Total de Débitos errado', async () => {
    const { pages } = await load('santander_totais_errados.pdf')
    expect(() => parseSantanderItems(pages)).toThrow(/Extrato não conferiu: Total de Débitos, esperado R\$ 6\.718,78, calculado R\$ 6\.774,73\. Nada foi importado\./)
  })
})
