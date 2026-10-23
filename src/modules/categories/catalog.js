import { shallowRef } from 'vue'
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
  { name: 'Vestuário', icon: '👕', kind: 'out' },
  { name: 'Viagem', icon: '✈️', kind: 'out' },
  { name: 'Presentes', icon: '🎁', kind: 'out' },
  { name: 'Casa e decoração', icon: '🛋️', kind: 'out' },
  { name: 'Filhos', icon: '🧒', kind: 'out' },
  { name: 'Outros gastos', icon: '📦', kind: 'out' },
  // Entradas
  { name: 'Salário', icon: '💼', kind: 'in' },
  { name: 'Rendimentos', icon: '📈', kind: 'in' },
  { name: 'Estorno', icon: '↩️', kind: 'in' },
  { name: 'Reembolso', icon: '💸', kind: 'in' },
  { name: 'Restituição de impostos', icon: '🧾', kind: 'in' },
  { name: 'Vendas', icon: '🏷️', kind: 'in' },
  { name: 'Presentes recebidos', icon: '🎁', kind: 'in' },
  { name: 'Outras entradas', icon: '➕', kind: 'in' },
  // Transferências
  { name: 'Transferência entre contas', icon: '🔄', kind: 'transfer' },
  { name: 'Pagamento de fatura', icon: '💳', kind: 'transfer' },
  { name: 'Investimentos', icon: '🪙', kind: 'transfer' },
  { name: 'Saldo anterior', icon: '⏮️', kind: 'transfer' }
]

const key = (name) => normalizeText(name).replace(/\s+/g, ' ').trim()
const BY_KEY = new Map(CATALOG.map(c => [key(c.name), c]))

export const CUSTOM_ICON = '🏷️'

// categorias próprias do usuário ([{ name, kind: 'in' | 'out' }]); o settingsStore mantém isto em dia.
// shallowRef: telas e rankings que leem o catálogo reagem quando a lista muda
const custom = shallowRef([])
export function setCustomCategories(list) {
  custom.value = (list || []).map(c => ({ name: c.name, kind: c.kind === 'in' ? 'in' : 'out', icon: CUSTOM_ICON, custom: true }))
}
const customByKey = (k) => custom.value.find(c => key(c.name) === k) || null

/** Categoria (do catálogo ou própria) pelo nome (sem acento/caixa), ou null se for uma categoria de fora (ex.: coluna do banco). */
export function findCategory(name) {
  if (!name) return null
  const k = key(name)
  return BY_KEY.get(k) || customByKey(k)
}

/** Nome canônico do catálogo (ou da categoria própria) quando existir ("mercado" → "Mercado"); senão o próprio nome. */
export function canonicalCategory(name) {
  return findCategory(name)?.name ?? name
}

/** O nome já existe no catálogo padrão ou entre as categorias próprias (ignorando acento, caixa e espaços)? */
export function categoryNameTaken(name) {
  return !!findCategory(name)
}

/** Categorias que o usuário pode escolher para um lançamento: pelo tipo (in/out); sem tipo, Entradas e Saídas. Inclui as próprias. */
export function categoriesFor(type) {
  return [...CATALOG, ...custom.value].filter(c => (type === 'in' ? c.kind === 'in' : type === 'out' ? c.kind === 'out' : c.kind !== 'transfer'))
}

/** Seção "Não é gasto" do seletor: o lançamento sai de Entradas/Saídas. ("Saldo anterior" é só do parser.) */
export const NOT_EXPENSE = ['Pagamento de fatura', 'Transferência entre contas', 'Investimentos']
export const NOT_EXPENSE_HELP = { 'Pagamento de fatura': 'use quando as compras do cartão já estão importadas' }
export function notExpenseCategories() {
  return NOT_EXPENSE.map(n => findCategory(n))
}

/** A categoria é de "Não é gasto" (transferência)? */
export function isTransferCategory(name) {
  return findCategory(name)?.kind === 'transfer'
}
