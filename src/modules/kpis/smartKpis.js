import { toLocalISODate } from '@/utils/formatters.js'

export function getSmartAlerts(entries) {
  const alerts = []

  // Duplicatas (mesma descrição + mesmo valor + mesmo vencimento)
  const seen = {}
  entries.forEach(e => {
    const key = `${e.description}|${e.forecast}|${e.dueDate}`
    seen[key] = (seen[key] || 0) + 1
  })
  const dupes = Object.values(seen).filter(v => v > 1).reduce((s, v) => s + (v - 1), 0)
  if (dupes > 0) {
    alerts.push({ id: 'dupes', icon: '🔁', label: 'Possíveis Duplicatas', count: dupes, severity: 'warning' })
  }

  // Sem data de vencimento
  const missingDate = entries.filter(e => !e.dueDate).length
  if (missingDate > 0) {
    alerts.push({ id: 'missing_date', icon: '📅', label: 'Sem Data de Vencimento', count: missingDate, severity: 'info' })
  }

  // Vencidos não pagos
  const today = toLocalISODate(new Date())
  const overdue = entries.filter(e => e.status !== 'paid' && e.dueDate && e.dueDate < today).length
  if (overdue > 0) {
    alerts.push({ id: 'overdue', icon: '🚨', label: 'Vencidos Não Pagos', count: overdue, severity: 'danger' })
  }

  return alerts
}
