import { cents, reais, monthOf, shiftMonth, latestDate } from './dates.js'
import { normalizeText } from '@/utils/search.js'

/**
 * Cronograma dos próximos n meses depois de asOf: parcelas em aberto (por mês) + recorrentes ativos (fixo por mês).
 * Devolve [{ month, installments, recurring, total }] (reais).
 */
export function commitmentSchedule(installments, recurringActive, n = 12, asOf = '') {
  const start = asOf ? monthOf(asOf) : null
  const recurringCents = recurringActive.filter(r => r.active !== false).reduce((s, r) => s + cents(r.monthlyCost), 0)
  const firstMonth = start ?? (installments.flatMap(i => i.schedule.map(s => s.month)).sort()[0] ?? null)
  if (!firstMonth) return []
  const base = start ?? shiftMonth(firstMonth, -1) // sem asOf: começa no primeiro mês com parcela
  return Array.from({ length: n }, (_, i) => {
    const month = shiftMonth(base, i + 1)
    const inst = installments.reduce((s, it) => s + it.schedule.filter(p => p.month === month).reduce((t, p) => t + cents(p.amount), 0), 0)
    return { month, installments: reais(inst), recurring: reais(recurringCents), total: reais(inst + recurringCents) }
  })
}

const CATEGORIES = { iof: 'IOF', encargos: 'Encargos', tarifas: 'Tarifas bancárias' }
const keyOf = (category) => Object.entries(CATEGORIES).find(([, name]) => normalizeText(name) === normalizeText(category || ''))?.[0] ?? null

/**
 * Custos bancários dos últimos `months` meses (até o mês de asOf): IOF, Encargos e Tarifas bancárias.
 * byMonth: [{ month, iof, encargos, tarifas, total }] em ordem cronológica.
 */
export function bankCosts(entries, { months = 12, asOf } = {}) {
  const end = monthOf(asOf || latestDate(entries))
  const empty = { iof: 0, encargos: 0, tarifas: 0, total: 0, byMonth: [] }
  if (!end) return empty
  const list = Array.from({ length: months }, (_, i) => shiftMonth(end, i - (months - 1)))
  const acc = new Map(list.map(m => [m, { iof: 0, encargos: 0, tarifas: 0 }]))
  for (const e of entries) {
    const k = e.status === 'paid' && e.type === 'out' && !e.transfer ? keyOf(e.category) : null
    const bucket = k ? acc.get(monthOf(e.dueDate)) : null
    if (bucket) bucket[k] += cents(e.forecast)
  }
  const totals = { iof: 0, encargos: 0, tarifas: 0 }
  const byMonth = list.map(month => {
    const b = acc.get(month)
    for (const k of Object.keys(totals)) totals[k] += b[k]
    return { month, iof: reais(b.iof), encargos: reais(b.encargos), tarifas: reais(b.tarifas), total: reais(b.iof + b.encargos + b.tarifas) }
  })
  return { iof: reais(totals.iof), encargos: reais(totals.encargos), tarifas: reais(totals.tarifas),
    total: reais(totals.iof + totals.encargos + totals.tarifas), byMonth }
}
