import { normalizeText } from '@/utils/search.js'
import { merchantKey, isMerchantIof } from './merchant.js'
import { shortDescription } from '@/utils/description.js'
import { cents, reais, median, monthOf, latestDate, daysBetween } from './dates.js'

/**
 * Recorrentes (assinaturas, contas fixas): Saídas pagas, sem transferência e sem parcela, fora do gasto frequente
 * (pedágio, combustível, alimentação, mercado) e dos custos bancários (IOF, encargos, tarifas).
 */
const FREQUENT = ['Pedágio e estacionamento', 'Combustível', 'Alimentação', 'Mercado']
const BANK_COSTS = ['IOF', 'Encargos', 'Tarifas bancárias']
const EXCLUDED = new Set([...FREQUENT, ...BANK_COSTS].map(c => normalizeText(c)))

const MIN_MONTHS = 3
const MAX_SPREAD = 0.15 // (maior − menor) / mediana
const MERGE_TOLERANCE = 0.05 // medianas parecidas para fundir nomes do mesmo comércio
const ACTIVE_DAYS = 45
const INSTALLMENT_SUFFIX = /\s*-\s*parcela\s+\d+\/\d+\s*$/i

// 1º "token" do comércio: a sequência inicial de letras, com pelo menos 4 (netflix.com → netflix)
const firstToken = (key) => /^[a-z]{4,}/.exec(key)?.[0] ?? null

const isCandidate = (e) =>
  e.status === 'paid' && e.type === 'out' && !e.transfer && !e.installment && !EXCLUDED.has(normalizeText(e.category || ''))

const mode = (values) => {
  const counts = new Map()
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
}

/** Une grupos do mesmo comércio escrito de formas diferentes: mesmo 1º token e medianas até 5% distintas. */
function mergeGroups(groups) {
  const parent = new Map(groups.map(g => [g.key, g.key]))
  const find = (k) => (parent.get(k) === k ? k : find(parent.get(k)))
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i], b = groups[j]
      const token = firstToken(a.key)
      if (!token || token !== firstToken(b.key)) continue
      const ma = median(a.entries.map(e => cents(e.forecast)))
      const mb = median(b.entries.map(e => cents(e.forecast)))
      if (Math.abs(ma - mb) / Math.max(ma, mb) <= MERGE_TOLERANCE) parent.set(find(a.key), find(b.key))
    }
  }
  const merged = new Map()
  for (const g of groups) {
    const root = find(g.key)
    const m = merged.get(root) || { keys: [], entries: [] }
    m.keys.push(g.key)
    m.entries.push(...g.entries)
    merged.set(root, m)
  }
  return [...merged.values()]
}

/**
 * Recorrentes ordenados: ativos primeiro, depois pelo custo mensal.
 * Recorrente = aparece em >= 3 meses, no máximo 1 ocorrência por mês (na mediana) e valores com variação <= 15%.
 * monthlyCost = mediana do valor + mediana do IOF do comércio (IOF de "X" do mesmo mês). active = visto nos últimos 45 dias.
 */
export function recurring(entries, { asOf } = {}) {
  const reference = asOf || latestDate(entries)

  // IOF por comércio e mês (centavos)
  const iof = new Map()
  for (const e of entries) {
    if (e.status !== 'paid' || e.type !== 'out' || e.transfer || !isMerchantIof(e)) continue
    const id = `${merchantKey(e.description)}|${monthOf(e.dueDate)}`
    iof.set(id, (iof.get(id) || 0) + cents(e.forecast))
  }

  const byKey = new Map()
  for (const e of entries) {
    if (!isCandidate(e) || isMerchantIof(e)) continue
    const key = merchantKey(e.description)
    if (!key || !e.dueDate) continue
    if (!byKey.has(key)) byKey.set(key, { key, entries: [] })
    byKey.get(key).entries.push(e)
  }

  const result = []
  for (const group of mergeGroups([...byKey.values()])) {
    const list = group.entries
    const amounts = list.map(e => cents(e.forecast))
    const med = median(amounts)
    const perMonth = new Map()
    for (const e of list) perMonth.set(monthOf(e.dueDate), (perMonth.get(monthOf(e.dueDate)) || 0) + 1)
    const months = [...perMonth.keys()].sort()

    if (months.length < MIN_MONTHS || med <= 0) continue
    if (median([...perMonth.values()]) > 1) continue
    if ((Math.max(...amounts) - Math.min(...amounts)) / med > MAX_SPREAD) continue

    const iofMedian = median(months.map(m => group.keys.reduce((s, k) => s + (iof.get(`${k}|${m}`) || 0), 0)))
    const monthlyCents = med + iofMedian
    const sorted = [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const last = sorted[sorted.length - 1]
    const lastDate = last.dueDate
    // chave do grupo = a grafia mais frequente (empate: ordem alfabética)
    const counts = new Map()
    for (const e of list) counts.set(merchantKey(e.description), (counts.get(merchantKey(e.description)) || 0) + 1)
    const key = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]

    result.push({
      key,
      name: shortDescription(last.description).replace(INSTALLMENT_SUFFIX, '').replace(/\s+/g, ' ').trim(),
      category: mode(list.map(e => e.category)),
      monthlyCost: reais(monthlyCents),
      annualCost: reais(monthlyCents * 12),
      months,
      lastDate,
      active: reference ? daysBetween(lastDate, reference) <= ACTIVE_DAYS : true
    })
  }
  return result.sort((a, b) => Number(b.active) - Number(a.active) || b.monthlyCost - a.monthlyCost || a.name.localeCompare(b.name, 'pt-BR'))
}
