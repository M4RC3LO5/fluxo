import { shortDescription } from '@/utils/description.js'
import { merchantKey } from './merchant.js'
import { cents, reais, monthOf, shiftMonth, latestDate } from './dates.js'

const AMOUNT_TOLERANCE = 2 // R$ 0,02 entre parcelas do mesmo parcelamento
const INSTALLMENT_SUFFIX = /\s*-\s*parcela\s+\d+\/\d+\s*$/i

/**
 * Parcelamentos em aberto. Agrupa por comércio + total de parcelas + valor (tolerância de R$ 0,02): a última
 * parcela vista define a atual; as demais caem em meses consecutivos depois dela. Só com parcelas por pagar.
 * Parcelamentos cujo último mês já passou (em relação a asOf) não contam como em aberto.
 */
export function openInstallments(entries, { asOf } = {}) {
  const reference = asOf || latestDate(entries)
  const groups = []
  for (const e of entries) {
    const { installment } = e
    if (!installment || e.type !== 'out' || e.transfer || !e.dueDate) continue
    const key = merchantKey(e.description)
    if (!key) continue
    const amount = cents(e.forecast)
    let g = groups.find(x => x.key === key && x.total === installment.total && Math.abs(x.amount - amount) <= AMOUNT_TOLERANCE)
    if (!g) {
      g = { key, total: installment.total, amount, items: [] }
      groups.push(g)
    }
    g.items.push(e)
  }

  const result = []
  for (const g of groups) {
    // a última parcela vista: a de maior número (empate: a mais recente)
    const last = [...g.items].sort((a, b) => a.installment.current - b.installment.current || a.dueDate.localeCompare(b.dueDate)).pop()
    const current = last.installment.current
    const remaining = g.total - current
    if (remaining <= 0) continue
    const lastMonth = monthOf(last.dueDate)
    const lastAmount = cents(last.forecast)
    const schedule = Array.from({ length: remaining }, (_, i) => ({ month: shiftMonth(lastMonth, i + 1), amount: reais(lastAmount) }))
    const endMonth = schedule[schedule.length - 1].month
    if (reference && endMonth < monthOf(reference)) continue // já terminou
    result.push({
      key: g.key,
      name: shortDescription(last.description).replace(INSTALLMENT_SUFFIX, '').replace(/\s+/g, ' ').trim(),
      amount: reais(lastAmount),
      current,
      total: g.total,
      remaining,
      remainingTotal: reais(lastAmount * remaining),
      endMonth,
      schedule
    })
  }
  return result.sort((a, b) => b.remainingTotal - a.remainingTotal || a.name.localeCompare(b.name, 'pt-BR'))
}
