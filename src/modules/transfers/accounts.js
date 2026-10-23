const LABELS = {
  'nubank-conta': 'Nubank',
  'nubank-cartao': 'Nubank (cartão)',
  'mercadopago-conta': 'Mercado Pago',
  'santander-cc': 'Santander'
}

/** Nome da conta para exibir ("mercadopago-conta" → "Mercado Pago"). */
export function accountLabel(account) {
  return LABELS[account] || account || 'outra conta'
}
