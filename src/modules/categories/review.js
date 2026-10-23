import { normalizeForMatch } from './rules.js'
import { shortDescription } from '@/utils/description.js'

/**
 * Revisão em lote (funções puras): lançamentos pagos, sem categoria, de Entrada/Saída — fora transferências.
 * Somas em centavos para não acumular erro de ponto flutuante.
 */
const cents = (n) => Math.round((Number(n) || 0) * 100)
const INSTALLMENT_SUFFIX = /\s*-\s*parcela\s+\d+\/\d+\s*$/i

export const isUncategorized = (e) =>
  e.status === 'paid' && !e.transfer && !e.category && (e.type === 'in' || e.type === 'out')

const monthOf = (e) => (e.dueDate ? String(e.dueDate).slice(0, 7) : null)

/**
 * Grupos de lançamentos sem categoria por descrição (sem parcela e sem trecho sensível), separados por tipo
 * (a mesma descrição em entrada e em saída vira 2 grupos), do maior total para o menor.
 * pattern = sugestão de regra (= key); months = meses em que aparece (AAAA-MM, crescente).
 */
export function uncategorizedGroups(entries) {
  const groups = new Map()
  for (const e of entries) {
    if (!isUncategorized(e)) continue
    const key = normalizeForMatch(shortDescription(e.description))
    if (!key) continue
    const id = `${e.type}|${key}`
    let g = groups.get(id)
    if (!g) {
      const name = shortDescription(e.description).replace(INSTALLMENT_SUFFIX, '').replace(/\s+/g, ' ').trim()
      g = { key, name, pattern: key, type: e.type, count: 0, total: 0, months: new Set(), sampleIds: [] }
      groups.set(id, g)
    }
    g.count++
    g.total += cents(e.forecast)
    const month = monthOf(e)
    if (month) g.months.add(month)
    if (g.sampleIds.length < 3) g.sampleIds.push(e.id)
  }
  return [...groups.values()]
    .map(g => ({ ...g, total: g.total / 100, months: [...g.months].sort() }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'))
}

/** Quantos lançamentos sem categoria (e quanto), com filtros opcionais de mês e tipo. */
export function countUncategorized(entries, { month = '', type = '' } = {}) {
  let count = 0
  let total = 0
  for (const e of entries) {
    if (!isUncategorized(e) || (month && monthOf(e) !== month) || (type && e.type !== type)) continue
    count++
    total += cents(e.forecast)
  }
  return { count, total: total / 100 }
}
