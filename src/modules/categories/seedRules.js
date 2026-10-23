/**
 * Regras genéricas de comércio (origin 'seed'). Os patterns já estão na forma normalizada (sem acento, minúsculo)
 * e valem EXATAMENTE como escritos: o espaço no fim de "dia ", "tim ", "superm " e "hosp " é de propósito.
 */
const SEEDS = {
  'Alimentação': ['ifd*', 'ifood', 'restaurante', 'lanchonete', 'pizzaria', 'burger', 'mc donalds', 'bobs', 'kfc', 'padaria',
    'panificadora', 'sorveteria', 'acai', 'esfiharia', 'lanches', 'bar e rest', 'outback', 'sushi'],
  'Mercado': ['carrefour', 'sonda', 'mini extra', 'supermercado', 'superm ', "sam's", 'atacadao', 'assai', 'pao de acucar', 'dia '],
  'Combustível': ['posto', 'autoposto', 'auto posto', 'rodoposto', 'shell', 'ipiranga'],
  'Pedágio e estacionamento': ['nutag', 'sem parar', 'conectcar', 'veloe', 'estacionamento', 'estac', 'park', 'autoban', 'rodovias'],
  'Transporte': ['uber', '99app', '99 ride', 'uberrides'],
  'Assinaturas': ['netflix', 'spotify', 'google one', 'youtube', 'youtubepremium', 'amazon prime', 'amazonprimebr', 'amazon music',
    'openai', 'chatgpt', 'anthropic', 'claude', 'steamgames', 'playstation', 'hostgator', 'supabase'],
  'Saúde': ['drogasil', 'drogaria', 'droga raia', 'raia drogasil', 'farma', 'rdsaude', 'hosp '],
  'Compras': ['amazon', 'amazonmktplc', 'shopee', 'mercadolivre', 'aliexpress', 'shein', 'magalu', 'americanas', 'decathlon', 'kalunga'],
  'Contas da casa': ['vivo', 'claro', 'tim ', 'sabesp', 'enel', 'comgas'],
  'Cuidados pessoais': ['barbearia', 'salao', 'cinco a sec'],
  'Impostos e taxas': ['ipva', 'licenciamento', 'iptu', 'darf']
}

export const SEED_RULES = Object.entries(SEEDS).flatMap(([category, patterns]) =>
  patterns.map((pattern, i) => ({
    id: `seed:${category}:${i}`,
    pattern,
    category,
    origin: 'seed',
    createdAt: 0
  })))
