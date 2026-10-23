import { normalizeText } from '@/utils/search.js'

/** Catálogo de categorias. `kind`: 'out' (saída), 'in' (entrada) ou 'transfer'. */
export const CATALOG = [
  // Saídas
  { name: 'Alimentação', icon: '🍽️', kind: 'out' },
  { name: 'Mercado', icon: '🛒', kind: 'out' },
  { name: 'Transporte', icon: '🚌', kind: 'out' },
  { name: 'Combustível', icon: '⛽', kind: 'out' },
  { name: 'Pedágio e estacionamento', icon: '🅿️', kind: 'out' },
  { name: 'Moradia', icon: '🏠', kind: 'out' },
  { name: 'Contas da casa', icon: '💡', kind: 'out' },
  { name: 'Saúde', icon: '💊', kind: 'out' },
  { name: 'Educação', icon: '🎓', kind: 'out' },
  { name: 'Lazer', icon: '🎭', kind: 'out' },
  { name: 'Compras', icon: '🛍️', kind: 'out' },
  { name: 'Assinaturas', icon: '🔁', kind: 'out' },
  { name: 'Cuidados pessoais', icon: '💈', kind: 'out' },
  { name: 'Pets', icon: '🐾', kind: 'out' },
  { name: 'Impostos e taxas', icon: '🧾', kind: 'out' },
  { name: 'Financiamento imobiliário', icon: '🏦', kind: 'out' },
  { name: 'Encargos', icon: '⚠️', kind: 'out' },
  { name: 'Tarifas bancárias', icon: '🏧', kind: 'out' },
  { name: 'IOF', icon: '📑', kind: 'out' },
  { name: 'Outros gastos', icon: '📦', kind: 'out' },
  // Entradas
  { name: 'Salário', icon: '💼', kind: 'in' },
  { name: 'Rendimentos', icon: '📈', kind: 'in' },
  { name: 'Estorno', icon: '↩️', kind: 'in' },
  { name: 'Reembolso', icon: '💸', kind: 'in' },
  { name: 'Outras entradas', icon: '➕', kind: 'in' },
  // Transferências
  { name: 'Transferência entre contas', icon: '🔄', kind: 'transfer' },
  { name: 'Pagamento de fatura', icon: '💳', kind: 'transfer' },
  { name: 'Investimentos', icon: '🪙', kind: 'transfer' },
  { name: 'Saldo anterior', icon: '⏮️', kind: 'transfer' }
]

const key = (name) => normalizeText(name).replace(/\s+/g, ' ').trim()
const BY_KEY = new Map(CATALOG.map(c => [key(c.name), c]))

/** Categoria do catálogo pelo nome (sem acento/caixa), ou null se for uma categoria de fora (ex.: coluna do banco). */
export function findCategory(name) {
  return name ? BY_KEY.get(key(name)) || null : null
}

/** Nome canônico do catálogo quando existir ("mercado" → "Mercado"); senão o próprio nome. */
export function canonicalCategory(name) {
  return findCategory(name)?.name ?? name
}

/** Categorias que o usuário pode escolher para um lançamento: pelo tipo (in/out); sem tipo, Entradas e Saídas. */
export function categoriesFor(type) {
  return CATALOG.filter(c => (type === 'in' ? c.kind === 'in' : type === 'out' ? c.kind === 'out' : c.kind !== 'transfer'))
}
