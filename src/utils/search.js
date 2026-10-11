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

/** Todas as grafias de uma data ISO que o usuário pode digitar: dd/mm/aaaa, dd/mm/aa, dd/mm, aaaa-mm-dd, d/m/aaaa, d/m */
function dateForms(iso) {
  if (!iso) return []
  const [y, m, d] = iso.slice(0, 10).split('-')
  const [dn, mn] = [String(Number(d)), String(Number(m))]
  return [`${d}/${m}/${y}`, `${d}/${m}/${y.slice(2)}`, `${d}/${m}`, `${y}-${m}-${d}`, `${dn}/${mn}/${y}`, `${dn}/${mn}`]
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
    dateForms(entry.dueDate).join(' '),
    ...money(entry.forecast),
    ...(entry.paid ? money(entry.paid) : []) // pago zerado/ausente fica fora do índice
  ].filter(Boolean).join(' | '))) + ' '
}

/**
 * Espaços são significativos: "conta" ≠ "conta ". Só colapsa espaços múltiplos em um.
 * Termo vazio ou só de espaços casa tudo.
 */
export function matches(index, term) {
  const q = collapseSpaces(normalizeText(term))
  if (!q.trim()) return true
  // "5/11/2026" não pode casar o fim de "15/11/2026": termo que começa com um único dígito
  // seguido de "/" só vale no começo de um token (início do índice, após espaço ou "|")
  if (/^\d\//.test(q)) return new RegExp('(^|[ |])' + q.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')).test(index)
  return index.includes(q)
}
