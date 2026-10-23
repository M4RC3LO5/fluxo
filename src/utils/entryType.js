/**
 * Selo do lançamento: transferência (entre contas próprias / pagamento de fatura) tem prioridade;
 * senão 'in' → Entrada, 'out' → Saída, null → neutro. `text` é a cor só do texto (tela de detalhe).
 */
export function typeBadge(entry) {
  if (entry?.transfer) return { label: 'Transferência', cls: 'bg-sky-500/10 text-sky-400', text: 'text-sky-400' }
  if (entry?.type === 'in') return { label: 'Entrada', cls: 'bg-emerald-500/10 text-emerald-400', text: 'text-emerald-400' }
  if (entry?.type === 'out') return { label: 'Saída', cls: 'bg-rose-500/10 text-rose-400', text: 'text-rose-400' }
  return { label: '—', cls: 'bg-white/5 text-slate-500', text: 'text-slate-500' }
}
