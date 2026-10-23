import { normalizeText } from '@/utils/search.js'
import { canonicalCategory } from '@/modules/categories/catalog.js'
import { shortDescription } from '@/utils/description.js'

/**
 * KPIs da visão Pessoal (funções puras, sem Vue). Só entra o que de fato se moveu (status 'paid').
 * Entradas = type 'in' sem transfer; Saídas = type 'out' sem transfer; transferências ficam à parte;
 * type null fica fora das três contas. Somas em centavos (inteiros) para não acumular erro de ponto flutuante.
 */
export const NO_CATEGORY = '__none__'
export const NO_CATEGORY_LABEL = 'Sem categoria'

const cents = (n) => Math.round((Number(n) || 0) * 100)
const reais = (c) => c / 100
const monthOf = (e) => (e.dueDate ? String(e.dueDate).slice(0, 7) : null)
const isPaid = (e) => e.status === 'paid'
const isIn = (e) => e.type === 'in' && !e.transfer
const isOut = (e) => e.type === 'out' && !e.transfer

const paidInMonth = (entries, month) => entries.filter(e => isPaid(e) && monthOf(e) === month)

/** Meses (AAAA-MM) com lançamentos pagos, do mais recente para o mais antigo. */
export function availableMonths(entries) {
  const set = new Set()
  for (const e of entries) {
    const m = isPaid(e) ? monthOf(e) : null
    if (m && /^\d{4}-\d{2}$/.test(m)) set.add(m)
  }
  return [...set].sort().reverse()
}

export function monthSummary(entries, month) {
  let entradas = 0
  let saidas = 0
  let transferencias = 0
  let transferCount = 0
  let untypedCount = 0
  const list = paidInMonth(entries, month)
  for (const e of list) {
    if (e.transfer) {
      transferencias += cents(e.forecast)
      transferCount++
    } else if (isIn(e)) entradas += cents(e.forecast)
    else if (isOut(e)) saidas += cents(e.forecast)
    else untypedCount++
  }
  return {
    entradas: reais(entradas),
    saidas: reais(saidas),
    saldo: reais(entradas - saidas),
    transferencias: reais(transferencias),
    transferCount,
    untypedCount,
    count: list.length
  }
}

/** 'AAAA-MM' deslocado em `delta` meses. */
export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const idx = y * 12 + (m - 1) + delta
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

/** Últimos n meses até endMonth, em ordem cronológica; meses sem dados valem 0. */
export function monthlySeries(entries, endMonth, n = 12) {
  const months = Array.from({ length: n }, (_, i) => shiftMonth(endMonth, i - (n - 1)))
  const acc = new Map(months.map(m => [m, { entradas: 0, saidas: 0 }]))
  for (const e of entries) {
    const bucket = isPaid(e) && !e.transfer ? acc.get(monthOf(e)) : null
    if (!bucket) continue
    if (isIn(e)) bucket.entradas += cents(e.forecast)
    else if (isOut(e)) bucket.saidas += cents(e.forecast)
  }
  return months.map(month => ({ month, entradas: reais(acc.get(month).entradas), saidas: reais(acc.get(month).saidas) }))
}

function topExpenses(entries, month, n, keyOf) {
  const saidas = paidInMonth(entries, month).filter(isOut)
  const total = saidas.reduce((s, e) => s + cents(e.forecast), 0)
  const groups = new Map()
  for (const e of saidas) {
    const { key, name } = keyOf(e)
    const g = groups.get(key) || { key, name, total: 0, count: 0 }
    g.total += cents(e.forecast)
    g.count++
    groups.set(key, g)
  }
  return [...groups.values()]
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, n)
    .map(g => ({ key: g.key, name: g.name, total: reais(g.total), count: g.count, share: total ? Math.round((g.total / total) * 1000) / 10 : 0 }))
}

/**
 * Maiores gastos do mês por categoria; categoria nula = "Sem categoria" (key '__none__'). share = % das Saídas.
 * "mercado" (coluna do banco) e "Mercado" (catálogo) são a mesma categoria: agrupa sem acento/caixa e mostra o nome do catálogo.
 */
export function topExpensesByCategory(entries, month, n = 5) {
  return topExpenses(entries, month, n, (e) => {
    const category = (e.category || '').trim()
    if (!category) return { key: NO_CATEGORY, name: NO_CATEGORY_LABEL }
    const name = canonicalCategory(category)
    return { key: normalizeText(name), name }
  })
}

const INSTALLMENT_SUFFIX = /\s*-\s*parcela\s+\d+\/\d+\s*$/i

/** Maiores gastos do mês por descrição (sem acento/caixa e sem o sufixo " - Parcela N/M"). */
export function topExpensesByDescription(entries, month, n = 5) {
  return topExpenses(entries, month, n, (e) => {
    // CPF mascarado e dados da conta saem do nome exibido (e do agrupamento)
    const name = shortDescription(String(e.description || '')).replace(INSTALLMENT_SUFFIX, '').replace(/\s+/g, ' ').trim()
    return { key: normalizeText(name) || '—', name: name || '—' }
  })
}

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** 'outubro/2026' */
export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]}/${y}`
}

/** 'out/2026' */
export function monthShortLabel(month) {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_ABBR[m - 1]}/${y}`
}

/** 'out' (só o mês, para o eixo do gráfico) */
export function monthAbbr(month) {
  return MONTH_ABBR[Number(month.split('-')[1]) - 1]
}
