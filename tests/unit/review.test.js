import { describe, it, expect } from 'vitest'
import { uncategorizedGroups, countUncategorized, isUncategorized } from '@/modules/categories/review.js'
import { recalculateRuleCategories, applyRules } from '@/modules/categories/rules.js'
import { SEED_RULES } from '@/modules/categories/seedRules.js'

let n = 0
const e = (o = {}) => ({
  id: `e${++n}`, description: 'Loja X', dueDate: '2026-10-05', forecast: 10, status: 'paid', type: 'out',
  transfer: false, category: null, categorySource: null, ...o
})
const user = (pattern, category) => ({ id: `u-${pattern}`, pattern, category, origin: 'user', createdAt: '2026-10-01' })

describe('uncategorizedGroups', () => {
  it('agrupa pela descrição normalizada e junta as parcelas', () => {
    const r = uncategorizedGroups([
      e({ description: 'Loja X - Parcela 1/3', forecast: 100 }),
      e({ description: 'LOJA X - Parcela 2/3', forecast: 100 }),
      e({ description: 'loja  x', forecast: 50 })
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ key: 'loja x', pattern: 'loja x', name: 'Loja X', type: 'out', count: 3, total: 250 })
  })

  it('o nome vem da 1ª ocorrência, encurtado e sem o sufixo da parcela', () => {
    const [g] = uncategorizedGroups([e({ description: 'Mercearia Zeta - Parcela 2/3' }), e({ description: 'MERCEARIA ZETA - Parcela 3/3' })])
    expect(g.name).toBe('Mercearia Zeta')
  })

  it('CPF mascarado e dados da conta ficam fora do nome, do key e do pattern', () => {
    const [g] = uncategorizedGroups([
      e({ description: 'Transferência enviada pelo Pix - MARIA SOUZA - •••.111.222-•• - BANCO X Agência: 1 Conta: 2' }),
      e({ description: 'Transferência enviada pelo Pix - MARIA SOUZA - •••.111.222-•• - BANCO Y Agência: 9 Conta: 8' })
    ])
    expect(g.name).toBe('Transferência enviada pelo Pix - MARIA SOUZA')
    expect(g.key).toBe('transferencia enviada pelo pix - maria souza')
    expect(g.count).toBe(2)
  })

  it('separa entrada e saída da mesma descrição em 2 grupos', () => {
    const r = uncategorizedGroups([e({ description: 'Loja X', type: 'out', forecast: 30 }), e({ description: 'Loja X', type: 'in', forecast: 20 })])
    expect(r.map(g => [g.type, g.total])).toEqual([['out', 30], ['in', 20]])
  })

  it('ignora transferência, categorizados (qualquer origem), pendentes e sem tipo', () => {
    const r = uncategorizedGroups([
      e({ transfer: true }),
      e({ category: 'Lazer', categorySource: 'manual' }),
      e({ category: 'IOF', categorySource: 'bank' }),
      e({ category: 'Mercado', categorySource: 'rule' }),
      e({ status: 'pending' }),
      e({ type: null }),
      e({ description: 'Única', forecast: 7 })
    ])
    expect(r.map(g => g.name)).toEqual(['Única'])
  })

  it('ordena por total, do maior para o menor (empate: pelo nome)', () => {
    const r = uncategorizedGroups([
      e({ description: 'Pequena', forecast: 10 }), e({ description: 'Grande', forecast: 500 }),
      e({ description: 'Média B', forecast: 100 }), e({ description: 'Média A', forecast: 100 }),
      e({ description: 'Pequena', forecast: 5 })
    ])
    expect(r.map(g => g.name)).toEqual(['Grande', 'Média A', 'Média B', 'Pequena'])
  })

  it('soma em centavos: 0,1 × 1000 = 100 exato', () => {
    const [g] = uncategorizedGroups(Array.from({ length: 1000 }, () => e({ forecast: 0.1 })))
    expect(g.total).toBe(100)
    expect(g.count).toBe(1000)
  })

  it('months: meses distintos em ordem; sampleIds: até 3', () => {
    const lista = [
      e({ dueDate: '2026-10-15' }), e({ dueDate: '2026-08-10' }), e({ dueDate: '2026-10-02' }), e({ dueDate: '2026-09-12' }), e({ dueDate: null })
    ]
    const [g] = uncategorizedGroups(lista)
    expect(g.months).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(g.sampleIds).toEqual(lista.slice(0, 3).map(x => x.id))
    expect(g.count).toBe(5)
  })

  it('sem lançamentos → vazio', () => expect(uncategorizedGroups([])).toEqual([]))
})

describe('countUncategorized / isUncategorized', () => {
  const lista = [
    e({ forecast: 10.1 }), e({ forecast: 20.2, type: 'in' }), e({ forecast: 5, dueDate: '2026-09-01' }),
    e({ category: 'Lazer', categorySource: 'manual' }), e({ transfer: true }), e({ status: 'pending' })
  ]
  it('total e quantidade, com filtros de mês e de tipo', () => {
    expect(countUncategorized(lista)).toEqual({ count: 3, total: 35.3 })
    expect(countUncategorized(lista, { month: '2026-10' })).toEqual({ count: 2, total: 30.3 })
    expect(countUncategorized(lista, { type: 'out' })).toEqual({ count: 2, total: 15.1 })
    expect(countUncategorized(lista, { month: '2026-10', type: 'in' })).toEqual({ count: 1, total: 20.2 })
  })
  it('isUncategorized', () => {
    expect(isUncategorized(e())).toBe(true)
    expect(isUncategorized(e({ category: '' }))).toBe(true)
    expect(isUncategorized(e({ category: 'Lazer' }))).toBe(false)
  })
})

describe('remover regra: recalculateRuleCategories', () => {
  const rule = user('loja desconhecida', 'Lazer')
  const base = [
    e({ id: 'a', description: 'Loja Desconhecida 1' }),
    e({ id: 'b', description: 'Loja Desconhecida 2' }),
    e({ id: 'c', description: 'Netflix.com' }), // veio de uma seed
    e({ id: 'd', description: 'Loja Desconhecida 3', category: 'Pets', categorySource: 'manual' }),
    e({ id: 'e', description: 'Loja Desconhecida IOF', category: 'IOF', categorySource: 'bank' }),
    e({ id: 'f', description: 'Loja Desconhecida Pix', transfer: true })
  ]
  const comRegra = applyRules(base, [...SEED_RULES, rule])
  const semRegra = [...SEED_RULES]

  it('o que veio da regra removida volta a ficar sem categoria', () => {
    expect(comRegra.slice(0, 2).map(x => [x.category, x.categorySource])).toEqual([['Lazer', 'rule'], ['Lazer', 'rule']])
    const r = recalculateRuleCategories(comRegra, semRegra)
    expect(r.slice(0, 2).map(x => [x.category, x.categorySource])).toEqual([[null, null], [null, null]])
  })

  it('só mexe nos "rule" daquela regra: seed, manual, bank e transferência ficam como estavam', () => {
    const [, , c, d, bank, transf] = comRegra
    const r = recalculateRuleCategories(comRegra, semRegra)
    expect(r[2]).toBe(c) // seed (Netflix → Assinaturas) continua
    expect(r[3]).toBe(d) // manual
    expect(r[4]).toBe(bank)
    expect(r[5]).toBe(transf)
  })

  it('se outra regra ainda casa, ele passa para ela (em vez de ficar sem categoria)', () => {
    const outra = user('loja desc', 'Pets')
    const r = recalculateRuleCategories(comRegra, [...SEED_RULES, outra])
    expect(r[0]).toMatchObject({ category: 'Pets', categorySource: 'rule' })
  })

  it('nada a recalcular → mesmos objetos; idempotente', () => {
    const r = recalculateRuleCategories(comRegra, [...SEED_RULES, rule])
    r.forEach((x, i) => expect(x).toBe(comRegra[i]))
    const sem = recalculateRuleCategories(comRegra, semRegra)
    recalculateRuleCategories(sem, semRegra).forEach((x, i) => expect(x).toBe(sem[i]))
  })
})
