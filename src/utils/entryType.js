/** Selo do tipo do lançamento: 'in' → Entrada, 'out' → Saída, null → neutro. */
export function typeBadge(type) {
  if (type === 'in') return { label: 'Entrada', cls: 'bg-emerald-500/10 text-emerald-400' }
  if (type === 'out') return { label: 'Saída', cls: 'bg-rose-500/10 text-rose-400' }
  return { label: '—', cls: 'bg-white/5 text-slate-500' }
}
