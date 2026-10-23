import { describe, it, expect } from 'vitest'
import {
  containsHolderName, hasTransferKeyword, markByHolderName, pairTransfers, detectOwnTransfers, undoTransfer, markTransferManual,
  transferSourceOf, TRANSFER_CATEGORY
} from '@/modules/transfers/ownTransfers.js'

const HOLDER = 'MARINA EXEMPLO SANTOS PEREIRA'
const TRUNC = 'MARINA EXEMPLO SANTOS PER' // 25 caracteres, como o banco trunca

let n = 0
const e = (o = {}) => ({
  id: `e${++n}`, description: 'X', dueDate: '2026-09-10', forecast: 100, type: 'out', account: 'nubank-conta',
  transfer: false, transferSource: null, pairedWith: null, category: null, categorySource: null, ...o
})
const pix = (o = {}) => e({ description: 'Transferência enviada pelo Pix - FULANO DE TAL', ...o })
const pixIn = (o = {}) => e({ description: 'Pix recebido Fulano de Tal', type: 'in', account: 'mercadopago-conta', ...o })

describe('palavra-chave', () => {
  it.each(['Transferência enviada pelo Pix', 'PIX RECEBIDO', 'TED para Fulano', 'DOC enviado', 'Transf entre contas', 'Transferencia'])('%s', (d) => {
    expect(hasTransferKeyword(d)).toBe(true)
  })
  it.each(['Compra no débito', 'Documento fiscal', 'Pixel Store', 'Tedx Talks', 'Padaria'])('%s não', (d) => {
    expect(hasTransferKeyword(d)).toBe(false)
  })
})

describe('nome do titular por prefixo', () => {
  it('nome inteiro casa', () => expect(containsHolderName(`Pix - ${HOLDER} - banco`, HOLDER)).toBe(true))
  it('nome truncado em 25 caracteres casa', () => {
    expect(containsHolderName(`PIX RECEBIDO - ${TRUNC}`, HOLDER)).toBe(true)
    expect(containsHolderName(`Pix - ${TRUNC} - •••.123.456-•• - BANCO`, HOLDER)).toBe(true)
  })
  it('sem acento, caixa ou espaços repetidos', () => {
    expect(containsHolderName('pix  Mãrina   exemplo santos pereira', 'Marina Exemplo Santos Pereira')).toBe(true)
    expect(containsHolderName('pix  marína   EXEMPLO santos', HOLDER)).toBe(true)
  })
  it('exatamente 10 caracteres em comum casam; 9 não', () => {
    expect(containsHolderName('Pix - MARINA EXEM', HOLDER)).toBe(true) // "marina exem" = 11
    expect(containsHolderName('Pix - MARINA EXE', HOLDER)).toBe(true) // "marina exe" = 10
    expect(containsHolderName('Pix - MARINA EX', HOLDER)).toBe(false) // 9
    expect(containsHolderName('Pix - MARINA', HOLDER)).toBe(false)
  })
  it('só a partir do INÍCIO do nome', () => {
    expect(containsHolderName('Pix - EXEMPLO SANTOS PEREIRA', HOLDER)).toBe(false)
    expect(containsHolderName('Pix - SANTOS PEREIRA', HOLDER)).toBe(false)
  })
  it('outra pessoa com o mesmo começo não casa', () => {
    expect(containsHolderName('Pix - MARINA EXEMPLO SANTOS FILHO', HOLDER)).toBe(false)
    expect(containsHolderName('Pix - MARINA EXEMPLO SANTOSA', HOLDER)).toBe(false)
  })
  it('nome do titular curto demais (< 10) nunca casa', () => {
    expect(containsHolderName('Pix - ANA MARIA', 'Ana Maria')).toBe(false)
  })
})

describe('markByHolderName', () => {
  it('Pix/TED com o nome do titular vira transferência "name"', () => {
    const [r] = markByHolderName([e({ description: `Transferência enviada pelo Pix - ${TRUNC} - •••` })], [HOLDER])
    expect(r).toMatchObject({ transfer: true, transferSource: 'name', category: TRANSFER_CATEGORY, categorySource: 'rule', type: 'out' })
  })
  it('exige a palavra-chave', () => {
    const lista = [e({ description: `Compra ${HOLDER}` })]
    expect(markByHolderName(lista, [HOLDER])[0]).toBe(lista[0])
  })
  it('sem nomes configurados, nada muda', () => {
    const lista = [e({ description: `Pix ${HOLDER}` })]
    markByHolderName(lista, []).forEach((r, i) => expect(r).toBe(lista[i]))
  })
  it('vários nomes: qualquer um serve', () => {
    const [r] = markByHolderName([e({ description: 'Pix para SEGUNDO NOME COMPLETO' })], [HOLDER, 'Segundo Nome Completo'])
    expect(r.transfer).toBe(true)
  })
  it('"manual" nunca é alterado (nem quando o usuário disse que não é transferência)', () => {
    const lista = [e({ description: `Pix ${HOLDER}`, transferSource: 'manual', transfer: false }), e({ description: `Pix ${HOLDER}`, transferSource: 'manual', transfer: true })]
    markByHolderName(lista, [HOLDER]).forEach((r, i) => expect(r).toBe(lista[i]))
  })
  it('já transferência do banco não é tocada', () => {
    const lista = [e({ description: `Pix ${HOLDER}`, transfer: true, transferSource: 'bank', category: 'Pagamento de fatura', categorySource: 'bank' })]
    expect(markByHolderName(lista, [HOLDER])[0]).toBe(lista[0])
  })
  it('remover o nome desfaz o que era só "name"', () => {
    const marcados = markByHolderName([e({ description: `Pix ${HOLDER}` })], [HOLDER])
    const [r] = markByHolderName(marcados, [])
    expect(r).toMatchObject({ transfer: false, transferSource: null, category: null, categorySource: null })
  })
  it('o nome continuando na lista, a marcação fica', () => {
    const marcados = markByHolderName([e({ description: `Pix ${HOLDER}` })], [HOLDER])
    expect(markByHolderName(marcados, [HOLDER])[0]).toBe(marcados[0])
  })
})

describe('pairTransfers', () => {
  it('1 candidato de cada lado → pareia, os dois viram transferência "pair"', () => {
    const o = pix()
    const i = pixIn()
    const [ro, ri] = pairTransfers([o, i])
    expect(ro).toMatchObject({ transfer: true, transferSource: 'pair', pairedWith: i.id, category: TRANSFER_CATEGORY, categorySource: 'rule', type: 'out' })
    expect(ri).toMatchObject({ transfer: true, transferSource: 'pair', pairedWith: o.id, category: TRANSFER_CATEGORY, type: 'in' })
  })
  it('diferença de 1 dia pareia', () => {
    const r = pairTransfers([pix({ dueDate: '2026-09-10' }), pixIn({ dueDate: '2026-09-11' })])
    expect(r.every(x => x.transfer)).toBe(true)
    expect(pairTransfers([pix({ dueDate: '2026-09-10' }), pixIn({ dueDate: '2026-09-09' })]).every(x => x.transfer)).toBe(true)
  })
  it('virada de mês e de ano contam como 1 dia', () => {
    expect(pairTransfers([pix({ dueDate: '2026-09-30' }), pixIn({ dueDate: '2026-10-01' })]).every(x => x.transfer)).toBe(true)
    expect(pairTransfers([pix({ dueDate: '2025-12-31' }), pixIn({ dueDate: '2026-01-01' })]).every(x => x.transfer)).toBe(true)
  })
  it('2 candidatos NÃO pareia', () => {
    const lista = [pix(), pixIn(), pixIn({ description: 'Pix recebido Outro' })]
    pairTransfers(lista).forEach((r, i) => expect(r).toBe(lista[i]))
  })
  it('2 saídas para 1 entrada NÃO pareia (lado contrário)', () => {
    const lista = [pix(), pix({ description: 'Pix enviado Outro' }), pixIn()]
    pairTransfers(lista).forEach((r, i) => expect(r).toBe(lista[i]))
  })
  it('mesma conta NÃO pareia', () => {
    const lista = [pix(), pixIn({ account: 'nubank-conta' })]
    pairTransfers(lista).forEach((r, i) => expect(r).toBe(lista[i]))
  })
  it('2 dias de diferença NÃO pareia', () => {
    const lista = [pix({ dueDate: '2026-09-10' }), pixIn({ dueDate: '2026-09-12' })]
    pairTransfers(lista).forEach((r, i) => expect(r).toBe(lista[i]))
  })
  it('valor diferente em 1 centavo NÃO pareia', () => {
    const lista = [pix({ forecast: 1800.77 }), pixIn({ forecast: 1800.78 })]
    pairTransfers(lista).forEach((r, i) => expect(r).toBe(lista[i]))
  })
  it('valores em ponto flutuante que divergem só na máquina pareiam', () => {
    expect(pairTransfers([pix({ forecast: 0.1 + 0.2 }), pixIn({ forecast: 0.3 })]).every(x => x.transfer)).toBe(true)
  })
  it('a entrada precisa ser Pix/TED ou já transferência', () => {
    const naoPix = [pix(), pixIn({ description: 'Salário Empresa' })]
    pairTransfers(naoPix).forEach((r, i) => expect(r).toBe(naoPix[i]))
    const jaTransferencia = [pix(), pixIn({ description: 'Crédito', transfer: true, transferSource: 'bank' })]
    const [ro, ri] = pairTransfers(jaTransferencia)
    expect(ro).toMatchObject({ transfer: true, transferSource: 'pair', pairedWith: ri.id })
    expect(ri).toMatchObject({ transferSource: 'bank', pairedWith: ro.id }) // quem já era transferência só ganha o vínculo
  })
  it('a saída precisa ter palavra-chave de Pix/TED/transferência', () => {
    const lista = [e({ description: 'Compra no débito' }), pixIn()]
    pairTransfers(lista).forEach((r, i) => expect(r).toBe(lista[i]))
  })
  it('"manual" nunca é alterado: nem como saída nem como entrada', () => {
    const lista = [pix({ transferSource: 'manual' }), pixIn()]
    pairTransfers(lista).forEach((r, i) => expect(r).toBe(lista[i]))
    const lista2 = [pix(), pixIn({ transferSource: 'manual' })]
    pairTransfers(lista2).forEach((r, i) => expect(r).toBe(lista2[i]))
  })
  it('vários pares independentes pareiam cada um com o seu', () => {
    const o1 = pix({ forecast: 100 }), i1 = pixIn({ forecast: 100 })
    const o2 = pix({ forecast: 250, dueDate: '2026-09-20' }), i2 = pixIn({ forecast: 250, dueDate: '2026-09-20' })
    const r = pairTransfers([o1, o2, i1, i2])
    expect(r[0].pairedWith).toBe(i1.id)
    expect(r[1].pairedWith).toBe(i2.id)
  })
})

describe('idempotência', () => {
  it('rodar duas vezes dá o mesmo resultado (e a 2ª não muda nada)', () => {
    const lista = [
      e({ description: `Pix enviado - ${TRUNC} - banco` }),
      pix({ forecast: 1000, dueDate: '2026-09-12' }), pixIn({ forecast: 1000, dueDate: '2026-09-12' }),
      e({ description: 'Compra qualquer' })
    ]
    const um = detectOwnTransfers(lista, [HOLDER])
    const dois = detectOwnTransfers(um, [HOLDER])
    expect(dois).toEqual(um)
    dois.forEach((r, i) => expect(r).toBe(um[i])) // nenhum objeto novo
    expect(um.filter(x => x.transfer)).toHaveLength(3)
  })
})

describe('desfazer e marcar', () => {
  it('"Não é transferência" numa detecção por nome: volta a Saída, fica manual e não é remarcada', () => {
    const [marcado] = markByHolderName([e({ description: `Pix ${HOLDER}` })], [HOLDER])
    const [r] = undoTransfer([marcado], marcado.id)
    expect(r).toMatchObject({ transfer: false, transferSource: 'manual', type: 'out', category: null, categorySource: null })
    expect(detectOwnTransfers([r], [HOLDER])[0]).toBe(r)
  })
  it('desfazer um par desfaz os dois lados', () => {
    const [o, i] = pairTransfers([pix(), pixIn()])
    const [ro, ri] = undoTransfer([o, i], o.id)
    expect(ro).toMatchObject({ transfer: false, transferSource: 'manual', pairedWith: null })
    expect(ri).toMatchObject({ transfer: false, transferSource: 'manual', pairedWith: null, type: 'in' })
    expect(detectOwnTransfers([ro, ri], [])).toEqual([ro, ri]) // não volta a parear
  })
  it('se o outro lado já era transferência do banco, ele só perde o vínculo', () => {
    const [o, i] = pairTransfers([pix(), pixIn({ description: 'Crédito', transfer: true, transferSource: 'bank' })])
    const [ro, ri] = undoTransfer([o, i], o.id)
    expect(ro.transfer).toBe(false)
    expect(ri).toMatchObject({ transfer: true, transferSource: 'bank', pairedWith: null })
  })
  it('transferência do banco não pode ser desfeita', () => {
    const lista = [e({ transfer: true, transferSource: 'bank' })]
    expect(undoTransfer(lista, lista[0].id)).toBe(lista)
    const antigo = [e({ transfer: true, transferSource: null })] // sem transferSource = bank
    expect(undoTransfer(antigo, antigo[0].id)).toBe(antigo)
    expect(transferSourceOf(antigo[0])).toBe('bank')
  })
  it('marcar manualmente: só Entrada/Saída com Pix/TED; vira "manual"', () => {
    const terceiro = pix()
    const [r] = markTransferManual([terceiro], terceiro.id)
    expect(r).toMatchObject({ transfer: true, transferSource: 'manual', category: TRANSFER_CATEGORY, categorySource: 'manual' })
    const compra = [e({ description: 'Compra' })]
    expect(markTransferManual(compra, compra[0].id)).toEqual(compra)
    expect(markTransferManual([r], r.id)[0]).toBe(r)
  })
  it('a marcação manual nunca é alterada pela detecção', () => {
    const [r] = markTransferManual([pix({ description: `Pix ${HOLDER}` })], 'e' + n)
    const lista = [r]
    expect(detectOwnTransfers(lista, [HOLDER])[0]).toBe(r)
  })
  it('desfazer uma marcação manual também volta ao normal', () => {
    const t = pix()
    const [m] = markTransferManual([t], t.id)
    const [r] = undoTransfer([m], m.id)
    expect(r).toMatchObject({ transfer: false, transferSource: 'manual' })
  })
})


describe('pagamento de fatura (qualquer descrição, 0 a 5 dias)', () => {
  const recebido = (o = {}) => e({
    description: 'Pagamento recebido', type: 'in', account: 'nubank-cartao', forecast: 1234.56, dueDate: '2026-09-13',
    transfer: true, transferSource: 'bank', category: 'Pagamento de fatura', categorySource: 'bank', ...o
  })
  const saida = (o = {}) => e({ description: 'PAGAMENTO TITULO', type: 'out', account: 'santander-cc', forecast: 1234.56, dueDate: '2026-09-10', ...o })
  const porId = (list, x) => list.find(i => i.id === x.id)

  it('1 candidato de cada lado pareia: a saída vira transfer "pair" com a categoria da fatura', () => {
    const o = saida()
    const i = recebido()
    const r = pairTransfers([o, i])
    expect(porId(r, o)).toMatchObject({ transfer: true, transferSource: 'pair', category: 'Pagamento de fatura', pairedWith: i.id })
    expect(porId(r, i)).toMatchObject({ transferSource: 'bank', pairedWith: o.id })
  })

  it('a descrição não importa', () => {
    for (const description of ['PAGAMENTO TITULO', 'Boleto', 'Compra qualquer', 'DEB AUTOMATICO']) {
      const o = saida({ description })
      expect(porId(pairTransfers([o, recebido()]), o).transfer).toBe(true)
    }
  })

  it('0 a 5 dias pareiam, 6 não', () => {
    for (const d of ['2026-09-13', '2026-09-10', '2026-09-08', '2026-09-18']) {
      const o = saida({ dueDate: d })
      expect(porId(pairTransfers([o, recebido()]), o).transfer, d).toBe(true)
    }
    const longe = saida({ dueDate: '2026-09-07' }) // 6 dias antes
    const todos = [longe, recebido()]
    expect(pairTransfers(todos)).toBe(todos)
    const depois = saida({ dueDate: '2026-09-19' })
    expect(pairTransfers([depois, recebido()]).every(x => !x.pairedWith)).toBe(true)
  })

  it('1 centavo de diferença não pareia', () => {
    const lista = [saida({ forecast: 1234.55 }), recebido()]
    expect(pairTransfers(lista)).toBe(lista)
  })

  it('2 candidatos de qualquer lado não pareiam', () => {
    const duasSaidas = [saida(), saida({ dueDate: '2026-09-11' }), recebido()]
    expect(pairTransfers(duasSaidas)).toBe(duasSaidas)
    const duasEntradas = [saida(), recebido(), recebido({ dueDate: '2026-09-14' })]
    expect(pairTransfers(duasEntradas)).toBe(duasEntradas)
  })

  it('saída na própria conta do cartão não pareia', () => {
    const lista = [saida({ account: 'nubank-cartao' }), recebido()]
    expect(pairTransfers(lista)).toBe(lista)
  })

  it('só pareia com "Pagamento recebido" do banco (entrada comum não)', () => {
    const lista = [saida(), recebido({ transferSource: 'name', category: 'Transferência entre contas' }), recebido({ transfer: false, transferSource: null, category: 'Salário' })]
    expect(pairTransfers(lista)).toBe(lista)
  })

  it('"manual" fica intocado: transferência manual, "Não é transferência" e categoria escolhida', () => {
    for (const manual of [
      { transfer: true, transferSource: 'manual', category: 'Investimentos', categorySource: 'manual' },
      { transfer: false, transferSource: 'manual' },
      { category: 'Contas da casa', categorySource: 'manual' }
    ]) {
      const lista = [saida(manual), recebido()]
      expect(pairTransfers(lista)).toBe(lista)
    }
  })

  it('é idempotente e "Não é transferência" desfaz o par e não é refeito', () => {
    const o = saida()
    const i = recebido()
    const uma = detectOwnTransfers([o, i], [])
    expect(detectOwnTransfers(uma, [])).toEqual(uma)
    const desfeito = undoTransfer(uma, o.id)
    expect(porId(desfeito, o)).toMatchObject({ transfer: false, transferSource: 'manual', pairedWith: null, category: null })
    expect(porId(desfeito, i)).toMatchObject({ transferSource: 'bank', pairedWith: null })
    expect(detectOwnTransfers(desfeito, []).find(x => x.id === o.id).transfer).toBe(false)
  })

  it('mantém o pareamento de Pix/TED (0 a 1 dia)', () => {
    const o = pix({ forecast: 80 })
    const i = pixIn({ forecast: 80, dueDate: '2026-09-11' })
    expect(porId(pairTransfers([o, i]), o).transferSource).toBe('pair')
    const longe = pixIn({ forecast: 80, dueDate: '2026-09-13' })
    const lista = [o, longe]
    expect(pairTransfers(lista)).toBe(lista)
  })
})
