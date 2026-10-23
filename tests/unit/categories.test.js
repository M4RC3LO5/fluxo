import { describe, it, expect } from 'vitest'
import { CATALOG, findCategory, canonicalCategory, categoriesFor } from '@/modules/categories/catalog.js'
import { SEED_RULES } from '@/modules/categories/seedRules.js'
import { normalizeForMatch, matchRule, applyRules, countChanges, categorySourceOf, isRuleEligible } from '@/modules/categories/rules.js'
import { classifyNubank } from '@/modules/importers/nubankRules.js'
import { classifyMercadoPago } from '@/modules/importers/mercadoPagoRules.js'
import { classifySantander } from '@/modules/importers/santanderRules.js'
import { normalizeEntry } from '@/modules/importers/normalize.js'
import { shortDescription } from '@/utils/description.js'

let n = 0
const e = (o) => ({ id: `e${++n}`, description: 'X', type: 'out', transfer: false, category: null, categorySource: null, ...o })
const user = (pattern, category, extra = {}) => ({ id: `u-${pattern}`, pattern, category, origin: 'user', createdAt: '2026-10-01', ...extra })
const categoriaDe = (description, rules = SEED_RULES) => matchRule(e({ description }), rules)?.category ?? null

describe('normalizeForMatch', () => {
  it('sem acento, minúsculo e com espaços colapsados', () => {
    expect(normalizeForMatch('  Padaria   AÇAÍ  Já ')).toBe('padaria acai ja')
  })
  it('remove o sufixo " - Parcela N/M" (qualquer caixa)', () => {
    expect(normalizeForMatch('Ifd*Lima Esfiharia e P - Parcela 1/2')).toBe('ifd*lima esfiharia e p')
    expect(normalizeForMatch('Netflix - PARCELA 10/12')).toBe('netflix')
  })
  it('só o sufixo no fim; "parcela" no meio fica', () => {
    expect(normalizeForMatch('Parcela do carro - 2')).toBe('parcela do carro - 2')
  })
  it('tolera nulo', () => expect(normalizeForMatch(null)).toBe(''))
})

describe('prioridade das regras', () => {
  it('regra do usuário vence a seed, mesmo com pattern mais curto', () => {
    const rules = [...SEED_RULES, user('posto', 'Lazer')]
    expect(categoriaDe('Posto Shell Centro', rules)).toBe('Lazer') // seed "shell" e "posto" empatam, mas a do usuário vence
    expect(categoriaDe('Auto Posto Silva', [...SEED_RULES, user('silva', 'Pets')])).toBe('Pets') // vence "auto posto" (mais longo, seed)
  })
  it('entre regras do mesmo tipo, vence o pattern mais longo', () => {
    expect(categoriaDe('Amazon Prime Video')).toBe('Assinaturas') // "amazon prime" > "amazon" (Compras)
    expect(categoriaDe('Amazon Marketplace Livros')).toBe('Compras')
    expect(categoriaDe('AmazonPrimeBR')).toBe('Assinaturas')
    expect(categoriaDe('Cafe', [user('cafe', 'Lazer'), user('cafe', 'Pets')])).toBe('Lazer') // empate: a primeira
    expect(categoriaDe('Loja Padaria Doce', [user('padaria', 'Lazer'), user('padaria doce', 'Pets')])).toBe('Pets')
  })
  it('entre usuário e seed, o usuário vence mesmo se o pattern da seed for mais longo', () => {
    expect(categoriaDe('Pao de Acucar Pompeia', [...SEED_RULES, user('pompeia', 'Lazer')])).toBe('Lazer')
  })
  it('sem match → null', () => expect(categoriaDe('Loja Desconhecida')).toBeNull())
})

describe('applyRules', () => {
  const rules = [...SEED_RULES, user('loja x', 'Lazer')]

  it('categoriza lançamentos sem categoria e marca a origem "rule"', () => {
    const [r] = applyRules([e({ description: 'Loja X Centro' })], rules)
    expect(r).toMatchObject({ category: 'Lazer', categorySource: 'rule' })
  })
  it('reavalia o que veio de regra', () => {
    const [r] = applyRules([e({ description: 'Loja X', category: 'Compras', categorySource: 'rule' })], rules)
    expect(r.category).toBe('Lazer')
  })
  it('NUNCA mexe em "bank", "manual" nem transferência', () => {
    const lista = [
      e({ description: 'Loja X', category: 'IOF', categorySource: 'bank' }),
      e({ description: 'Loja X', category: 'Pets', categorySource: 'manual' }),
      e({ description: 'Loja X', transfer: true }),
      e({ description: 'Loja X', category: 'Mercado' }) // sem origem + com categoria = "bank" (lançamento antigo)
    ]
    const r = applyRules(lista, rules)
    r.forEach((x, i) => expect(x).toBe(lista[i])) // os mesmos objetos, intocados
  })
  it('não muda a lista original e preserva os objetos que não mudaram', () => {
    const a = e({ description: 'Loja X' })
    const b = e({ description: 'Sem match' })
    const r = applyRules([a, b], rules)
    expect(a.category).toBeNull()
    expect(r[1]).toBe(b)
  })
  it('categoria de saída não vai para entrada', () => {
    const [r] = applyRules([e({ description: 'Pix recebido Posto Silva', type: 'in' })], SEED_RULES)
    expect(r.category).toBeNull()
  })
  it('countChanges conta o que mudaria', () => {
    const lista = [e({ description: 'Loja X 1' }), e({ description: 'Loja X 2' }), e({ description: 'Loja X 3', categorySource: 'manual', category: 'Pets' }), e({ description: 'Outra' })]
    expect(countChanges(lista, rules)).toBe(2)
  })
  it('categorySourceOf: lançamento antigo com categoria e sem origem é "bank"', () => {
    expect(categorySourceOf({ category: 'IOF' })).toBe('bank')
    expect(categorySourceOf({ category: null })).toBeNull()
    expect(categorySourceOf({ category: 'IOF', categorySource: 'manual' })).toBe('manual')
    expect(isRuleEligible({ category: 'IOF' })).toBe(false)
    expect(isRuleEligible({ category: null })).toBe(true)
  })
})

describe('catálogo', () => {
  const nomes = new Set(CATALOG.map(c => c.name))

  it('tem as categorias combinadas, por tipo', () => {
    expect(CATALOG.filter(c => c.kind === 'out')).toHaveLength(20)
    expect(CATALOG.filter(c => c.kind === 'in').map(c => c.name)).toEqual(['Salário', 'Rendimentos', 'Estorno', 'Reembolso', 'Outras entradas'])
    expect(CATALOG.filter(c => c.kind === 'transfer').map(c => c.name)).toEqual(['Transferência entre contas', 'Pagamento de fatura', 'Investimentos', 'Saldo anterior'])
    expect(CATALOG.every(c => c.icon)).toBe(true)
    expect(nomes.size).toBe(CATALOG.length)
  })

  it('toda categoria emitida pelos parsers existe no catálogo', () => {
    const emitidas = [
      ...['Pagamento recebido', 'Saldo em atraso', 'Multa de atraso', 'Juros de atraso', 'IOF de atraso', 'IOF de "Loja"', 'Estorno de "Loja"']
        .map(d => classifyNubank(d, 'cartao').category),
      ...['Resgate RDB', 'Aplicação RDB', 'Pagamento de fatura'].map(d => classifyNubank(d, 'conta').category),
      ...['Rendimentos', 'Dinheiro retirado Reserva', 'Pagamento de fatura'].map(d => classifyMercadoPago(d, 'Fulano de Tal').category),
      classifyMercadoPago('Pix recebido Fulano de Tal', 'Fulano de Tal').category,
      ...[['REMUNERACAO APLICACAO AUTOMATICA'], ['OPERACOES CREDITO IMOBILIARIO'], ['TARIFA MENSAL'], ['JUROS CHEQUE'], ['IOF OPERACAO'],
        ['PIX RECEBIDO', 'FULANO DE TAL SILVA']].map(l => classifySantander(l, 'FULANO DE TAL SILVA PEREIRA').category)
    ]
    expect(emitidas.every(Boolean)).toBe(true)
    expect(emitidas.filter(c => !nomes.has(c))).toEqual([])
  })

  it('toda regra seed aponta para uma categoria de saída do catálogo', () => {
    for (const r of SEED_RULES) expect(findCategory(r.category)?.kind, `${r.pattern} → ${r.category}`).toBe('out')
  })

  it('findCategory/canonicalCategory ignoram acento e caixa', () => {
    expect(findCategory('SAUDE').name).toBe('Saúde')
    expect(canonicalCategory('mercado')).toBe('Mercado')
    expect(canonicalCategory('restaurante')).toBe('restaurante') // fora do catálogo: fica como veio
    expect(findCategory(null)).toBeNull()
  })

  it('categoriesFor filtra pelo tipo do lançamento', () => {
    expect(categoriesFor('out').every(c => c.kind === 'out')).toBe(true)
    expect(categoriesFor('in').every(c => c.kind === 'in')).toBe(true)
    expect(categoriesFor(null).some(c => c.kind === 'transfer')).toBe(false)
    expect(categoriesFor(null)).toHaveLength(25)
  })
})

describe('regras seed: um exemplo real por grupo', () => {
  it.each([
    ['Ifd*Lima Esfiharia e P - Parcela 1/2', 'Alimentação'],
    ['NuTag*FUJ2I56', 'Pedágio e estacionamento'],
    ['Stilo Abc Auto Posto L', 'Combustível'],
    ['Openai *Chatgpt Subscr', 'Assinaturas'],
    ['PAGAMENTO IPVA-CANAIS - INTERNET LICENCIAMENTO EL', 'Impostos e taxas'],
    ['Carrefour Express 123', 'Mercado'],
    ['Superm Dia Pompeia', 'Mercado'],
    ['Uber *Trip Help.uber.com', 'Transporte'],
    ['Drogasil 1234', 'Saúde'],
    ['Raia Drogasil - Parcela 1/2', 'Saúde'],
    ['Droga Raia 22', 'Saúde'],
    ['Shopee Brasil', 'Compras'],
    ['Vivo Fibra 0800', 'Contas da casa'],
    ['Barbearia do Ze', 'Cuidados pessoais'],
    ['Padaria Sao Jose', 'Alimentação'],
    ['Netflix.com', 'Assinaturas'],
    ['Autoban Pedagio', 'Pedágio e estacionamento']
  ])('%s → %s', (descricao, categoria) => {
    expect(categoriaDe(descricao)).toBe(categoria)
  })

  it('falsos positivos conhecidos ficam sem categoria', () => {
    expect(categoriaDe('Mundo Encantado')).toBeNull() // não vira Mercado por "dia "
    expect(categoriaDe('Time Square')).toBeNull() // "tim " exige o espaço
    expect(categoriaDe('Pedagio')).toBeNull()
    expect(categoriaDe('Mercado Livre')).toBeNull() // só "mercadolivre", colado
    expect(categoriaDe('Aluguel Imobiliaria Centro')).toBeNull()
    expect(categoriaDe('Praia Mar')).toBeNull() // antes, o pattern "raia" casava com "Praia"
    expect(categoriaDe('Raiane Silva')).toBeNull()
  })

  it('o espaço dos patterns curtos é mantido como escrito', () => {
    const p = SEED_RULES.map(r => r.pattern)
    for (const exato of ['dia ', 'tim ', 'superm ', 'hosp ', 'raia drogasil', "sam's", 'ifd*']) expect(p).toContain(exato)
    expect(categoriaDe('Dia Supermercado Centro')).toBe('Mercado')
    expect(categoriaDe('Hosp Sao Luiz')).toBe('Saúde')
  })

  it('todas as seeds têm origin "seed" e id único', () => {
    expect(SEED_RULES.every(r => r.origin === 'seed')).toBe(true)
    expect(new Set(SEED_RULES.map(r => r.id)).size).toBe(SEED_RULES.length)
  })
})

describe('categorySource no modelo', () => {
  const base = { id: '1', dueDate: '2026-10-01', description: 'X', forecast: 1 }
  it('categoria que já vem do parser é "bank"', () => {
    expect(normalizeEntry({ ...base, category: 'IOF' }, { source: 'nubank' }).categorySource).toBe('bank')
  })
  it('sem categoria não há origem', () => {
    expect(normalizeEntry(base, { source: 'nubank' }).categorySource).toBeNull()
  })
  it('respeita uma origem válida e ignora lixo', () => {
    expect(normalizeEntry({ ...base, category: 'Lazer', categorySource: 'manual' }, { source: 'xlsx' }).categorySource).toBe('manual')
    expect(normalizeEntry({ ...base, category: 'Lazer', categorySource: 'xx' }, { source: 'xlsx' }).categorySource).toBe('bank')
  })
})

describe('shortDescription', () => {
  it('sem dados sensíveis, mantém tudo', () => {
    expect(shortDescription('Transferência recebida pelo Pix - Maria Souza')).toBe('Transferência recebida pelo Pix - Maria Souza')
    expect(shortDescription('Loja X - Parcela 2/10')).toBe('Loja X - Parcela 2/10')
  })
  it('corta no CPF mascarado: 1º trecho + nome', () => {
    expect(shortDescription('Transferência recebida pelo Pix - MARCELO NOGUEIRA - •••.123.456-•• - BANCO X (0001) Agência: 1234 Conta: 56789-0'))
      .toBe('Transferência recebida pelo Pix - MARCELO NOGUEIRA')
  })
  it('corta em Agência:/Conta: mesmo sem CPF mascarado', () => {
    expect(shortDescription('Pix enviado - JOAO LIMA - BANCO Y Agência: 1 Conta: 2')).toBe('Pix enviado - JOAO LIMA')
  })
  it('sem nome antes do trecho sensível, não mexe', () => {
    expect(shortDescription('Agência: 1 Conta: 2')).toBe('Agência: 1 Conta: 2')
    expect(shortDescription(null)).toBe('')
  })
})
