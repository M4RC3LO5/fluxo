import { shiftMonth } from '@/modules/kpis/pfKpis.js'

export { shiftMonth }

export const monthOf = (iso) => (iso ? String(iso).slice(0, 7) : null)

const dayNumber = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : NaN
}

/** Dias de a até b (b − a). */
export const daysBetween = (a, b) => dayNumber(b) - dayNumber(a)

/** Maior data (AAAA-MM-DD) dos lançamentos, ou ''. */
export function latestDate(entries) {
  let max = ''
  for (const e of entries) if (e.dueDate && e.dueDate > max) max = e.dueDate
  return max
}

export const cents = (n) => Math.round((Number(n) || 0) * 100)
export const reais = (c) => c / 100

/** Mediana de números inteiros (centavos); par → média dos dois do meio, arredondada. */
export function median(values) {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}
