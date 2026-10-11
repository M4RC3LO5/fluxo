const brNumber = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** minúsculas e sem acentos (NFD + remoção de diacríticos) */
export function normalizeText(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function collapseSpaces(s) {
  return s.replace(/\s+/g, ' ')
}

/** Rótulo de status calculado, mesma regra da tela: pago / vencido (venceu antes de hoje) / pendente */
export function statusLabel(entry, today) {
  if (entry.status === 'paid') return 'pago'
  if (entry.dueDate && entry.dueDate < today) return 'vencido'
  return 'pendente'
}

function formatDueDate(d) {
  if (!d) return ''
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

/** Texto único e normalizado com tudo que o usuário enxerga (ou digitaria) de um lançamento. */
export function buildSearchIndex(entry, today) {
  const money = v => (v == null ? [] : [brNumber.format(v), String(v)])
  // espaços nas bordas: permite buscar "conta " (fim de campo) e " conta" (início de campo)
  return ' ' + collapseSpaces(normalizeText([
    entry.description,
    entry.payer,
    entry.responsible,
    entry.center,
    entry.notes,
    entry.type === 'receita' ? 'receita' : 'despesa',
    statusLabel(entry, today),
    formatDueDate(entry.dueDate),
    ...money(entry.forecast),
    ...money(entry.paid)
  ].filter(Boolean).join(' | '))) + ' '
}

/**
 * Espaços são significativos: "conta" ≠ "conta ". Só colapsa espaços múltiplos em um.
 * Termo vazio ou só de espaços casa tudo.
 */
export function matches(index, term) {
  const q = collapseSpaces(normalizeText(term))
  return !q.trim() || index.includes(q)
}
