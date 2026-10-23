import { describe, it, expect } from 'vitest'
import {
  availableMonths, monthSummary, monthlySeries, topExpensesByCategory, topExpensesByDescription,
  shiftMonth, monthLabel, monthShortLabel
} from '@/modules/kpis/pfKpis.js'

let n = 0
const e = (o) => ({ id: `e${++n}`, dueDate: '2026-10-05', description: 'X', forecast: 10, status: 'paid', type: 'out', transfer: false, category: null, ...o })

describe('availableMonths', () => {
  it('meses com lançamentos pagos, do mais recente para o mais antigo, sem repetir', () => {
    const list = [e({ dueDate: '2026-09-30' }), e({ dueDate: '2026-10-01' }), e({ dueDate: '2026-10-20' }), e({ dueDate: '2025-12-31' })]
    expect(availableMonths(list)).toEqual(['2026-10', '2026-09', '2025-12'])
  })
  it('ignora pendentes e lançamentos sem data', () => {
    const list = [e({ dueDate: '2026-11-01', status: 'pending' }), e({ dueDate: null }), e({ dueDate: '2026-08-10' })]
    expect(availableMonths(list)).toEqual(['2026-08'])
  })
  it('sem lançamentos → vazio', () => expect(availableMonths([])).toEqual([]))
})

describe('monthSummary', () => {
  const lista = [
    e({ type: 'in', forecast: 1000 }),
    e({ type: 'in', forecast: 250.5 }),
    e({ type: 'out', forecast: 300.25 }),
    e({ type: 'out', forecast: 99.75 }),
    e({ type: 'out', forecast: 5000, transfer: true }), // transferência: fora
    e({ type: 'in', forecast: 7000, transfer: true }), // transferência: fora
    e({ type: null, forecast: 40 }), // sem tipo: fora das três contas
    e({ type: 'out', forecast: 70, status: 'pending' }), // não pago: fora
    e({ type: 'out', forecast: 80, dueDate: '2026-09-10' }) // outro mês
  ]

  it('transferências ficam fora de Entradas, Saídas e Saldo', () => {
    const r = monthSummary(lista, '2026-10')
    expect(r).toMatchObject({ entradas: 1250.5, saidas: 400, saldo: 850.5 })
  })
  it('transferências aparecem só como total informativo', () => {
    const r = monthSummary(lista, '2026-10')
    expect(r.transferencias).toBe(12000)
    expect(r.transferCount).toBe(2)
  })
  it('type null não entra nas contas e é contado', () => {
    expect(monthSummary(lista, '2026-10').untypedCount).toBe(1)
  })
  it('count = lançamentos pagos do mês (inclui transferências e sem tipo)', () => {
    expect(monthSummary(lista, '2026-10').count).toBe(7)
  })
  it('só status paid; outros meses não entram', () => {
    expect(monthSummary(lista, '2026-09')).toMatchObject({ entradas: 0, saidas: 80, saldo: -80, count: 1 })
  })
  it('mês sem dados → zeros', () => {
    expect(monthSummary(lista, '2030-01')).toEqual({ entradas: 0, saidas: 0, saldo: 0, transferencias: 0, transferCount: 0, untypedCount: 0, count: 0 })
  })
  it('soma em centavos: 0,1 + 0,2 = 0,3 exato', () => {
    const r = monthSummary([e({ type: 'in', forecast: 0.1 }), e({ type: 'in', forecast: 0.2 })], '2026-10')
    expect(r.entradas).toBe(0.3)
    const grande = Array.from({ length: 1000 }, () => e({ type: 'out', forecast: 0.1 }))
    expect(monthSummary(grande, '2026-10').saidas).toBe(100)
  })
  it('saldo negativo quando saídas > entradas', () => {
    expect(monthSummary([e({ type: 'in', forecast: 10 }), e({ type: 'out', forecast: 25.5 })], '2026-10').saldo).toBe(-15.5)
  })
})

describe('monthlySeries', () => {
  const lista = [
    e({ type: 'in', forecast: 100, dueDate: '2026-10-01' }), e({ type: 'out', forecast: 40, dueDate: '2026-10-02' }),
    e({ type: 'out', forecast: 60, dueDate: '2026-08-15' }), e({ type: 'in', forecast: 500, dueDate: '2025-10-20' }),
    e({ type: 'in', forecast: 9999, dueDate: '2026-10-03', transfer: true }), e({ type: 'in', forecast: 7, dueDate: '2026-10-03', status: 'pending' })
  ]
  it('12 meses até o mês final, em ordem cronológica, com zeros onde não há dados', () => {
    const s = monthlySeries(lista, '2026-10')
    expect(s).toHaveLength(12)
    expect(s[0].month).toBe('2025-11')
    expect(s[11]).toEqual({ month: '2026-10', entradas: 100, saidas: 40 })
    expect(s.find(m => m.month === '2026-08')).toEqual({ month: '2026-08', entradas: 0, saidas: 60 })
    expect(s.find(m => m.month === '2026-09')).toEqual({ month: '2026-09', entradas: 0, saidas: 0 })
  })
  it('mês fora da janela de 12 não entra', () => {
    expect(monthlySeries(lista, '2026-10').some(m => m.month === '2025-10')).toBe(false)
  })
  it('atravessa o ano e aceita outro n', () => {
    expect(monthlySeries([], '2026-02', 4).map(m => m.month)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
  it('transferências e pendentes ficam de fora', () => {
    expect(monthlySeries(lista, '2026-10')[11].entradas).toBe(100)
  })
})

describe('topExpensesByCategory', () => {
  const lista = [
    e({ forecast: 300, category: 'Mercado' }), e({ forecast: 100, category: 'Mercado' }),
    e({ forecast: 150, category: 'Transporte' }), e({ forecast: 50 }), e({ forecast: 25, category: '  ' }),
    e({ forecast: 999, category: 'Mercado', type: 'in' }), // entrada: fora
    e({ forecast: 999, category: 'Mercado', transfer: true }), // transferência: fora
    e({ forecast: 999, category: 'Mercado', dueDate: '2026-09-01' })
  ]
  it('agrupa por categoria, ordena por valor e calcula a % das Saídas', () => {
    const r = topExpensesByCategory(lista, '2026-10')
    expect(r.map(x => [x.name, x.total, x.count])).toEqual([['Mercado', 400, 2], ['Transporte', 150, 1], ['Sem categoria', 75, 2]])
    expect(r.map(x => x.share)).toEqual([64, 24, 12]) // total de Saídas = 625
  })
  it('categoria nula ou vazia vira "Sem categoria" com key __none__', () => {
    expect(topExpensesByCategory(lista, '2026-10').find(x => x.name === 'Sem categoria').key).toBe('__none__')
  })
  it('respeita n', () => {
    expect(topExpensesByCategory(lista, '2026-10', 2)).toHaveLength(2)
  })
  it('sem saídas → vazio', () => expect(topExpensesByCategory([e({ type: 'in' })], '2026-10')).toEqual([]))
})

describe('topExpensesByCategory: nomes do catálogo', () => {
  it('"mercado" (banco) e "Mercado" (catálogo) viram uma categoria só, com o nome do catálogo', () => {
    const r = topExpensesByCategory([e({ forecast: 100, category: 'mercado' }), e({ forecast: 50, category: 'Mercado' }), e({ forecast: 10, category: 'restaurante' })], '2026-10')
    expect(r.map(x => [x.name, x.total, x.count])).toEqual([['Mercado', 150, 2], ['restaurante', 10, 1]])
  })
  it('ignora acento: "Saude" e "Saúde"', () => {
    const r = topExpensesByCategory([e({ forecast: 5, category: 'Saude' }), e({ forecast: 5, category: 'Saúde' })], '2026-10')
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('Saúde')
  })
})

describe('topExpensesByDescription', () => {
  it('encurta CPF mascarado e dados da conta antes de agrupar', () => {
    const lista = [
      e({ description: 'Transferência enviada pelo Pix - MARIA SOUZA - •••.111.222-•• - BANCO X Agência: 1 Conta: 2', forecast: 100 }),
      e({ description: 'Transferência enviada pelo Pix - MARIA SOUZA - •••.111.222-•• - BANCO Y Agência: 9 Conta: 8', forecast: 50 })
    ]
    const r = topExpensesByDescription(lista, '2026-10')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ name: 'Transferência enviada pelo Pix - MARIA SOUZA', total: 150, count: 2 })
  })

  it('agrupa sem acento/caixa/espaços e sem o sufixo " - Parcela N/M"', () => {
    const lista = [
      e({ description: 'Loja Z - Parcela 2/10', forecast: 100 }),
      e({ description: 'LOJA Z - parcela 3/10', forecast: 100 }),
      e({ description: 'Loja  Z', forecast: 50 }),
      e({ description: 'Café Central', forecast: 30 }), e({ description: 'CAFE central', forecast: 20 })
    ]
    const r = topExpensesByDescription(lista, '2026-10')
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ name: 'Loja Z', total: 250, count: 3 })
    expect(r[1]).toMatchObject({ total: 50, count: 2 })
    expect(r[0].share + r[1].share).toBeCloseTo(100, 0)
  })
  it('o nome exibido é o da 1ª ocorrência, sem o sufixo', () => {
    const r = topExpensesByDescription([e({ description: 'Netflix - Parcela 1/12', forecast: 40 })], '2026-10')
    expect(r[0].name).toBe('Netflix')
  })
  it('só Saídas do mês, fora transferências', () => {
    const lista = [e({ description: 'A', forecast: 10 }), e({ description: 'B', forecast: 99, transfer: true }), e({ description: 'C', forecast: 99, type: 'in' })]
    expect(topExpensesByDescription(lista, '2026-10').map(x => x.name)).toEqual(['A'])
  })
  it('empate: ordem alfabética estável', () => {
    const r = topExpensesByDescription([e({ description: 'Beta', forecast: 10 }), e({ description: 'Alfa', forecast: 10 })], '2026-10')
    expect(r.map(x => x.name)).toEqual(['Alfa', 'Beta'])
  })
})

describe('meses', () => {
  it('shiftMonth atravessa o ano', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
    expect(shiftMonth('2026-10', -11)).toBe('2025-11')
  })
  it('rótulos', () => {
    expect(monthLabel('2026-10')).toBe('outubro/2026')
    expect(monthLabel('2026-03')).toBe('março/2026')
    expect(monthShortLabel('2026-10')).toBe('out/2026')
  })
})
