const brNumber = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** minúsculas e sem acentos (NFD + remoção de diacríticos) */
export function normalizeText(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
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
  return normalizeText([
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
  ].filter(Boolean).join(' | '))
}

/** Termo vazio (após trim) casa tudo. */
export function matches(index, term) {
  const q = normalizeText(term).trim()
  return !q || index.includes(q)
}
