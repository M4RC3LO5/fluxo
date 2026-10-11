export function formatCurrency(value) {
  if (value == null || isNaN(value)) return 'R$ —'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** 'YYYY-MM-DD' no fuso local (toISOString converteria para UTC e viraria o dia à noite no Brasil) */
export function toLocalISODate(d) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(dateStr) {
  if (!dateStr) return null
  if (dateStr instanceof Date) return isNaN(dateStr) ? null : toLocalISODate(dateStr) // célula de data (cellDates)
  const clean = String(dateStr).trim()
  // ISO: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10)
  // BR: 15/01/2024
  if (/^\d{2}\/\d{2}\/\d{4}/.test(clean)) {
    const [d, m, y] = clean.split('/')
    return `${y}-${m}-${d}`
  }
  // Excel serial
  const serial = Number(clean)
  if (!isNaN(serial) && serial > 1000) {
    const date = new Date((serial - 25569) * 86400 * 1000)
    return date.toISOString().slice(0, 10)
  }
  return null
}

export function today() {
  return toLocalISODate(new Date())
}
