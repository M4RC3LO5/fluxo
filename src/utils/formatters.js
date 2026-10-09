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

export function parseDate(dateStr) {
  if (!dateStr) return null
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
  return new Date().toISOString().slice(0, 10)
}
