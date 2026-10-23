import { describe, it, expect } from 'vitest'
import { merchantKey, recurring, openInstallments, commitmentSchedule, bankCosts } from '@/modules/commitments/index.js'

let n = 0
const e = (o = {}) => ({
  id: `e${++n}`, description: 'X', dueDate: '2026-10-05', forecast: 10, status: 'paid', type: 'out',
  transfer: false, category: null, installment: null, ...o
})
/** Uma ocorrência por mês, nos meses informados (dia 5). */
const mensal = (description, valor, meses, extra = {}) =>
  meses.map(m => e({ description, forecast: valor, dueDate: `${m}-05`, ...extra }))
const MESES = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']

describe('merchantKey', () => {
  it.each([
    ['Dl*Google Google', 'google google'],
    ['DL *Google One', 'google one'],
    ['Ifd*Lima Esfiharia e P', 'lima esfiharia e p'],
    ['IFD *Lima Esfiharia', 'lima esfiharia'],
    ['Ebn*Spotify', 'spotify'],
    ['EBN *Spotify', 'spotify'],
    ['Mp *Mercado Livre', 'mercado livre'],
    ['Pg *Loja Xyz', 'loja xyz'],
    ['Ec *Padaria Doce', 'padaria doce'],
    ['Bmb *Cafe Central', 'cafe central'],
    ['Jim.Com*Pizza Bar', 'pizza bar'],
    ['Amazonmktplc*Livros', 'livros'],
    ['Stb*Posto Alfa', 'posto alfa'],
    ['Vmt*Cinema Beta', 'cinema beta'],
    ['Cappta *Loja Gama', 'loja gama']
  ])('%s → %s', (descricao, esperado) => {
    expect(merchantKey(descricao)).toBe(esperado)
  })

  it('sem acento, caixa, espaços e sufixo de parcela', () => {
    expect(merchantKey('  Padaría   AÇAÍ - Parcela 2/10 ')).toBe('padaria acai')
  })
  it('sem prefixo, não mexe: "dl" no meio ou palavra parecida ficam', () => {
    expect(merchantKey('Odl*Loja')).toBe('odl*loja')
    expect(merchantKey('Dlz Comercio')).toBe('dlz comercio')
  })
  it('CPF mascarado e dados da conta saem da chave', () => {
    expect(merchantKey('Pix enviado - MARIA SOUZA - •••.111.222-•• - BANCO X Agência: 1 Conta: 2')).toBe('pix enviado - maria souza')
  })
  it('IOF de "X" vira a chave de X (com ou sem prefixo/parcela)', () => {
    expect(merchantKey('IOF de "Netflix.Com"')).toBe('netflix.com')
    expect(merchantKey('IOF de "Dl*Google Google"')).toBe('google google')
    expect(merchantKey('IOF de "Loja Z - Parcela 2/10"')).toBe('loja z')
    expect(merchantKey('IOF de atraso')).toBe('iof de atraso') // sem comércio entre aspas
  })
  it('nulo/vazio → ""', () => {
    expect(merchantKey(null)).toBe('')
    expect(merchantKey('')).toBe('')
  })
})

describe('recurring', () => {
  it('assinatura mensal: custo = valor + IOF do mesmo comércio, anual = × 12, meses e última data', () => {
    const lista = [
      ...mensal('Netflix.Com', 44.9, MESES),
      ...mensal('IOF de "Netflix.Com"', 1.57, MESES, { category: 'IOF' })
    ]
    const [r] = recurring(lista)
    expect(r).toMatchObject({ key: 'netflix.com', name: 'Netflix.Com', monthlyCost: 46.47, annualCost: 557.64, lastDate: '2026-10-05', active: true })
    expect(r.months).toEqual(MESES)
  })

  it('o IOF de outro comércio não entra', () => {
    const lista = [...mensal('Netflix.Com', 44.9, MESES), ...mensal('IOF de "Spotify"', 1, MESES)]
    expect(recurring(lista)[0].monthlyCost).toBe(44.9)
  })

  it('funde nomes do mesmo comércio com o mesmo valor: Netflix.Com + Netflix Entretenimento', () => {
    const lista = [
      ...mensal('Netflix.Com', 44.9, MESES.slice(0, 3)),
      ...mensal('Netflix Entretenimento', 44.9, MESES.slice(3))
    ]
    const r = recurring(lista)
    expect(r).toHaveLength(1) // sem a fusão seriam 2 grupos de 3 meses
    expect(r[0]).toMatchObject({ monthlyCost: 44.9, name: 'Netflix Entretenimento' })
    expect(r[0].months).toEqual(MESES)
  })

  it('Google One + Dl*Google Google (mesmo valor) fundem; Google Youtubepremium (valor diferente) fica separado', () => {
    const lista = [
      ...mensal('Google One', 119.98, MESES.slice(0, 3)),
      ...mensal('Dl*Google Google', 119.98, MESES.slice(3)),
      ...mensal('Google Youtubepremium', 26.9, MESES)
    ]
    const r = recurring(lista)
    expect(r.map(x => x.monthlyCost)).toEqual([119.98, 26.9])
    expect(r[0].months).toHaveLength(6)
    expect(r[1].key).toBe('google youtubepremium')
  })

  it('fusão tolera 5% de diferença entre as medianas, mas não mais', () => {
    const perto = [...mensal('Streamflix A', 100, MESES.slice(0, 3)), ...mensal('Streamflix B', 104, MESES.slice(3))]
    expect(recurring(perto)).toHaveLength(1)
    const longe = [...mensal('Streamflix A', 100, MESES.slice(0, 3)), ...mensal('Streamflix B', 110, MESES.slice(3))]
    expect(recurring(longe)).toHaveLength(2)
  })

  it('várias ocorrências por mês (pedágio) não é recorrente', () => {
    const nutag = MESES.flatMap(m => ['03', '10', '17'].map(d => e({ description: 'NuTag*FUJ2I56', forecast: 4.8, dueDate: `${m}-${d}` })))
    expect(recurring(nutag)).toEqual([])
  })

  it('valor variando 30% não é recorrente; 15% é', () => {
    const varia = MESES.map((m, i) => e({ description: 'Conta Variavel', forecast: i === 2 ? 130 : 100, dueDate: `${m}-05` }))
    expect(recurring(varia)).toEqual([])
    const quase = MESES.map((m, i) => e({ description: 'Conta Quase Fixa', forecast: i === 2 ? 115 : 100, dueDate: `${m}-05` }))
    expect(recurring(quase)).toHaveLength(1)
  })

  it('só 2 meses não é recorrente; 3 é', () => {
    expect(recurring(mensal('Servico Novo', 30, MESES.slice(0, 2)))).toEqual([])
    expect(recurring(mensal('Servico Novo', 30, MESES.slice(0, 3)))).toHaveLength(1)
  })

  it('meses repetidos no mesmo comércio contam uma vez só como mês', () => {
    const lista = [...mensal('Servico Novo', 30, MESES.slice(0, 2)), e({ description: 'Servico Novo', forecast: 30, dueDate: '2026-05-20' })]
    expect(recurring(lista)).toEqual([]) // 2 meses distintos
  })

  it('exclui parcelas, transferências, pendentes, entradas e as categorias de gasto frequente e de custo bancário', () => {
    const base = (extra) => mensal('Coisa Qualquer', 50, MESES, extra)
    expect(recurring(base({ installment: { current: 1, total: 6 } }))).toEqual([])
    expect(recurring(base({ transfer: true }))).toEqual([])
    expect(recurring(base({ status: 'pending' }))).toEqual([])
    expect(recurring(base({ type: 'in' }))).toEqual([])
    for (const category of ['Pedágio e estacionamento', 'Combustível', 'Alimentação', 'Mercado', 'IOF', 'Encargos', 'Tarifas bancárias']) {
      expect(recurring(base({ category }))).toEqual([])
    }
    expect(recurring(base({ category: 'Assinaturas' }))).toHaveLength(1)
    expect(recurring(base({ category: 'Financiamento imobiliário' }))).toHaveLength(1) // financiamento mensal é compromisso
  })

  it('ativo = visto nos últimos 45 dias antes de asOf (padrão: a maior data dos lançamentos)', () => {
    const parou = mensal('Servico Antigo', 20, ['2026-03', '2026-04', '2026-05'])
    const lista = [...parou, ...mensal('Servico Atual', 30, MESES)] // asOf = 2026-10-05
    const r = recurring(lista)
    expect(r.map(x => [x.name, x.active])).toEqual([['Servico Atual', true], ['Servico Antigo', false]]) // ativos primeiro
    expect(r[1].lastDate).toBe('2026-05-05')
    // limite: 45 dias exatos ainda é ativo; 46 não
    expect(recurring(parou, { asOf: '2026-06-19' })[0].active).toBe(true)
    expect(recurring(parou, { asOf: '2026-06-20' })[0].active).toBe(false)
  })

  it('ordena por custo mensal dentro de ativos', () => {
    const lista = [...mensal('Barato Mensal', 10, MESES), ...mensal('Caro Mensal', 200, MESES)]
    expect(recurring(lista).map(x => x.name)).toEqual(['Caro Mensal', 'Barato Mensal'])
  })

  it('categoria = a mais frequente do grupo; somas em centavos', () => {
    const lista = mensal('Servico Cents', 0.1 + 0.2, MESES, { category: 'Assinaturas' })
    const [r] = recurring(lista)
    expect(r.category).toBe('Assinaturas')
    expect(r.monthlyCost).toBe(0.3)
    expect(r.annualCost).toBe(3.6)
  })
})

describe('openInstallments', () => {
  const parcela = (nome, atual, total, mes, valor = 250.66) =>
    e({ description: `${nome} - Parcela ${atual}/${total}`, forecast: valor, dueDate: `${mes}-12`, installment: { current: atual, total } })

  it('parcela 4/6 em 2026-09: faltam 2, nos meses 2026-10 e 2026-11', () => {
    const lista = [parcela('Loja Parcelada', 3, 6, '2026-08'), parcela('Loja Parcelada', 4, 6, '2026-09')]
    const [r] = openInstallments(lista, { asOf: '2026-09-30' })
    expect(r).toMatchObject({ key: 'loja parcelada', name: 'Loja Parcelada', amount: 250.66, current: 4, total: 6, remaining: 2, remainingTotal: 501.32, endMonth: '2026-11' })
    expect(r.schedule).toEqual([{ month: '2026-10', amount: 250.66 }, { month: '2026-11', amount: 250.66 }])
  })

  it('a última parcela vista define a atual, mesmo fora de ordem', () => {
    const lista = [parcela('Loja P', 4, 6, '2026-09'), parcela('Loja P', 2, 6, '2026-07'), parcela('Loja P', 3, 6, '2026-08')]
    expect(openInstallments(lista, { asOf: '2026-09-30' })[0]).toMatchObject({ current: 4, remaining: 2 })
  })

  it('compras do mesmo comércio com totais diferentes ficam separadas', () => {
    const lista = [parcela('Loja Y', 2, 6, '2026-09', 100), parcela('Loja Y', 1, 3, '2026-09', 100)]
    const r = openInstallments(lista, { asOf: '2026-09-30' })
    expect(r).toHaveLength(2)
    expect(r.map(x => x.total).sort()).toEqual([3, 6])
  })

  it('valores diferentes (> R$ 0,02) são compras diferentes; até R$ 0,02 é a mesma', () => {
    const iguais = [parcela('Loja Z', 1, 6, '2026-08', 100.0), parcela('Loja Z', 2, 6, '2026-09', 100.02)]
    expect(openInstallments(iguais, { asOf: '2026-09-30' })).toHaveLength(1)
    const diferentes = [parcela('Loja Z', 1, 6, '2026-08', 100.0), parcela('Loja Z', 2, 6, '2026-09', 100.03)]
    expect(openInstallments(diferentes, { asOf: '2026-09-30' })).toHaveLength(2)
  })

  it('terminadas (N/N) não são "em aberto"; as que já passaram do fim também não', () => {
    expect(openInstallments([parcela('Loja W', 6, 6, '2026-09')], { asOf: '2026-09-30' })).toEqual([])
    expect(openInstallments([parcela('Loja W', 4, 6, '2026-01')], { asOf: '2026-10-01' })).toEqual([]) // terminaria em 2026-03
  })

  it('o prefixo do intermediador não separa a mesma compra', () => {
    const lista = [parcela('Mp *Loja V', 1, 4, '2026-08'), parcela('Loja V', 2, 4, '2026-09')]
    expect(openInstallments(lista, { asOf: '2026-09-30' })).toHaveLength(1)
  })

  it('atravessa o ano e ordena pelo restante', () => {
    const lista = [parcela('Pequena', 1, 3, '2026-11', 50), parcela('Grande', 2, 12, '2026-11', 300)]
    const r = openInstallments(lista, { asOf: '2026-11-30' })
    expect(r.map(x => x.name)).toEqual(['Grande', 'Pequena'])
    expect(r[0].endMonth).toBe('2027-09')
    expect(r[1].schedule.map(s => s.month)).toEqual(['2026-12', '2027-01'])
  })
})

describe('commitmentSchedule', () => {
  const parcelas = [{ key: 'a', schedule: [{ month: '2026-11', amount: 250.66 }, { month: '2026-12', amount: 250.66 }] },
    { key: 'b', schedule: [{ month: '2026-11', amount: 100 }] }]
  const fixos = [{ monthlyCost: 46.47, active: true }, { monthlyCost: 21.9, active: false }]

  it('soma parcelas do mês + recorrentes ativos, para os próximos n meses depois de asOf', () => {
    const s = commitmentSchedule(parcelas, fixos, 3, '2026-10-20')
    expect(s.map(x => x.month)).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(s[0]).toEqual({ month: '2026-11', installments: 350.66, recurring: 46.47, total: 397.13 })
    expect(s[1]).toEqual({ month: '2026-12', installments: 250.66, recurring: 46.47, total: 297.13 })
    expect(s[2]).toEqual({ month: '2027-01', installments: 0, recurring: 46.47, total: 46.47 })
  })
  it('12 meses por padrão; sem nada, vazio', () => {
    expect(commitmentSchedule(parcelas, fixos, undefined, '2026-10-20')).toHaveLength(12)
    expect(commitmentSchedule([], [])).toEqual([])
  })
})

describe('bankCosts', () => {
  const custo = (category, valor, data, extra = {}) => e({ description: category, category, forecast: valor, dueDate: data, ...extra })
  const lista = [
    custo('IOF', 1.57, '2026-10-05'), custo('IOF', 1.57, '2026-09-05'),
    custo('Encargos', 19.75, '2026-08-20'),
    custo('Tarifas bancárias', 38.9, '2026-07-10'),
    custo('Mercado', 999, '2026-10-05'), custo('Assinaturas', 999, '2026-10-05'), // outras categorias: fora
    custo('IOF', 500, '2025-10-31'), // 13 meses atrás: fora da janela de 12 (2025-11 a 2026-10)
    custo('IOF', 0.1, '2025-11-01'), // primeiro mês da janela: dentro
    custo('IOF', 77, '2026-10-05', { transfer: true }), custo('IOF', 77, '2026-10-05', { status: 'pending' }), // fora
    custo('Encargos', 77, '2026-10-05', { type: 'in' })
  ]

  it('soma só IOF, Encargos e Tarifas, só os últimos 12 meses', () => {
    const r = bankCosts(lista, { asOf: '2026-10-20' })
    expect(r).toMatchObject({ iof: 3.24, encargos: 19.75, tarifas: 38.9, total: 61.89 })
  })
  it('byMonth: 12 meses em ordem cronológica, zeros onde não há custo', () => {
    const r = bankCosts(lista, { asOf: '2026-10-20' })
    expect(r.byMonth).toHaveLength(12)
    expect(r.byMonth[0]).toMatchObject({ month: '2025-11', iof: 0.1, total: 0.1 })
    expect(r.byMonth[11]).toMatchObject({ month: '2026-10', iof: 1.57, total: 1.57 })
    expect(r.byMonth.find(m => m.month === '2026-08')).toMatchObject({ encargos: 19.75, iof: 0 })
  })
  it('asOf padrão = a maior data; janela configurável; soma em centavos', () => {
    expect(bankCosts([custo('IOF', 0.1, '2026-10-01'), custo('IOF', 0.2, '2026-09-01')]).iof).toBe(0.3)
    expect(bankCosts(lista, { months: 2, asOf: '2026-10-20' }).iof).toBe(3.14)
    expect(bankCosts([])).toEqual({ iof: 0, encargos: 0, tarifas: 0, total: 0, byMonth: [] })
  })
})

describe('commitmentsOverview', () => {
  const lista = [
    ...mensal('Netflix.Com', 44.9, MESES), ...mensal('IOF de "Netflix.Com"', 1.57, MESES, { category: 'IOF' }),
    ...mensal('Spotify', 21.9, MESES.slice(0, 3)),
    ...['2026-07', '2026-08', '2026-09', '2026-10'].map((m, i) => e({ description: `Loja Parcelada - Parcela ${i + 1}/6`, forecast: 250.66, dueDate: `${m}-12`, installment: { current: i + 1, total: 6 } })),
    e({ description: 'Loja Avulsa', forecast: 120, dueDate: '2026-10-20' })
  ]

  it('junta ativos, parados, parcelas, cronograma e o total do próximo mês', async () => {
    const { commitmentsOverview } = await import('@/modules/commitments/index.js')
    const o = commitmentsOverview(lista)
    expect(o.asOf).toBe('2026-10-20')
    expect(o.recurringActive.map(r => r.name)).toEqual(['Netflix.Com'])
    expect(o.recurringInactive.map(r => r.name)).toEqual(['Spotify'])
    expect(o.installments).toHaveLength(1)
    expect(o.schedule).toHaveLength(12)
    expect(o.nextMonth.month).toBe('2026-11')
    expect(o.nextMonthTotal).toBe(297.13) // 250,66 de parcela + 46,47 de Netflix com IOF
    expect(o.bank).toMatchObject({ iof: 9.42, total: 9.42 })
  })

  it('"Não é recorrente" (chave ignorada) tira o item e o valor do total', async () => {
    const { commitmentsOverview } = await import('@/modules/commitments/index.js')
    const o = commitmentsOverview(lista, ['netflix.com', 'spotify'])
    expect(o.recurringActive).toEqual([])
    expect(o.recurringInactive).toEqual([])
    expect(o.nextMonthTotal).toBe(250.66)
  })

  it('sem lançamentos, tudo vazio', async () => {
    const { commitmentsOverview } = await import('@/modules/commitments/index.js')
    const o = commitmentsOverview([])
    expect(o.nextMonthTotal).toBe(0)
    expect(o.schedule).toEqual([])
    expect(o.installments).toEqual([])
  })
})
