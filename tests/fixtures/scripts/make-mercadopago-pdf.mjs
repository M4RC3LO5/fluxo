// Gera PDFs SINTÉTICOS (dados inventados) imitando o layout do "EXTRATO DE CONTA" do Mercado Pago.
// Uso: node tests/fixtures/scripts/make-mercadopago-pdf.mjs
import PDFDocument from 'pdfkit'
import { createWriteStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOLDER = 'Marina Exemplo Santos'

// [data, linhas da descrição, id, valor]. A linha com data/ID/valor/saldo é a do meio das linhas
// (acima, na mesma linha, abaixo). `cruza` = o início da descrição fica no fim da página anterior.
const MOVES = [
  ['02-10-2026', ['Rendimentos'], '100000000001', 0.43],
  ['03-10-2026', ['Pix recebido Marina Exemplo Santos'], '100000000002', 2500],
  ['03-10-2026', ['Pix recebido Carlos Terceiro Lima'], '100000000003', 1200],
  ['04-10-2026', ['Dinheiro retirado Reserva Viagem'], '100000000004', 500],
  ['05-10-2026', ['Pagamento de fatura'], '100000000005', -1834.56],
  ['06-10-2026', ['Pagamento com Pix', 'Padaria Pao Quente', 'Ltda Filial 02'], '100000000006', -45.9],
  ['07-10-2026', ['Dinheiro reservado Reserva Viagem'], '100000000007', -400],
  ['08-10-2026', ['Pix enviado Joao Prestador Servicos'], '100000000008', -350],
  ['09-10-2026', ['Pagamento com Pix Restaurante', 'Sabor da Serra Unidade Centro', 'Mesa 12'], '100000000009', -87.4, { cruza: true }],
  ['10-10-2026', ['Compra Mercado Livre', 'Fone de ouvido'], '100000000010', -129.9],
  ['11-10-2026', ['Pix recebido Ana Cliente Silva'], '100000000011', 800],
  ['12-10-2026', ['Rendimentos'], '100000000012', 0.61]
]
const PAGE1_ROWS = 8
const SALDO_INICIAL = 0.08
const ROW_H = 62

const brl = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function build(file, { saldoFinalImpresso } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: 'Extrato sintético', CreationDate: new Date('2026-10-22T12:00:00Z') } })
  doc.pipe(createWriteStream(join(OUT, file)))
  const t = (str, x, y, size = 8, font = 'Helvetica') => doc.font(font).fontSize(size).text(str, x, y, { lineBreak: false })

  const entradas = MOVES.filter(m => m[3] > 0).reduce((s, m) => s + m[3], 0)
  const saidas = MOVES.filter(m => m[3] < 0).reduce((s, m) => s + m[3], 0)
  const saldoFinal = SALDO_INICIAL + entradas + saidas

  const COL = { data: 40, desc: 110, id: 340, valor: 430, saldo: 500 }
  const tableHeader = (y) => {
    t('Data', COL.data, y, 8, 'Helvetica-Bold'); t('Descrição', COL.desc, y, 8, 'Helvetica-Bold')
    t('ID da operação', COL.id, y, 8, 'Helvetica-Bold'); t('Valor', COL.valor, y, 8, 'Helvetica-Bold'); t('Saldo', COL.saldo, y, 8, 'Helvetica-Bold')
  }
  const footer = (n) => {
    t('Data de geração: 22-10-2026 12:00:00', 40, 790)
    t('Em caso de dúvidas, fale com o SAC: 0800 000 0000. Ouvidoria: 0800 000 0001.', 40, 800)
    t('Mercado Pago Instituição de Pagamento Ltda. CNPJ 00.000.000/0001-00', 40, 810)
    t(`${n}/2`, 520, 822)
  }

  // página 1: cabeçalho do documento
  t('EXTRATO DE CONTA', 40, 40, 14, 'Helvetica-Bold'); t('Mercado Pago', 440, 42, 10, 'Helvetica-Bold')
  t(HOLDER, 44.3, 62, 9); t('CPF/CNPJ: 000.000.000-00', 44.3, 72, 9); t('Agência: 0001   Conta: 00000000-0', 44.3, 82, 9)
  t('Periodo:', 44.3, 92, 9); t('De 01-10-2026 al 31-10-2026', 88.1, 92, 9)
  // totais como no PDF real: rótulo e valor em itens separados; Saldo inicial à esquerda, Entradas e Saidas
  // empilhadas no meio, Saldo final à direita. Alturas (y do pdfjs, de cima p/ baixo): 113,3 / 106,8 / 119,8 / 114,3.
  // `top` = y do pdfjs - 6,5 (ascendente da Helvetica 9).
  const par = (rotulo, valor, xRotulo, xValor, yPdfjs) => { t(rotulo, xRotulo, yPdfjs - 6.5, 9); t(valor, xValor, yPdfjs - 6.5, 9) }
  par('Saldo inicial:', brl(SALDO_INICIAL), 44.3, 98.1, 113.3)
  par('Entradas:', brl(entradas), 178.3, 216.6, 106.8)
  par('Saidas:', brl(saidas), 178.3, 209.3, 119.8)
  par('Saldo final:', brl(saldoFinalImpresso ?? saldoFinal), 326.7, 375.6, 114.3)
  t('DETALHE DOS MOVIMENTOS', 40, 205, 10, 'Helvetica-Bold')
  tableHeader(225)
  footer(1)

  let saldo = SALDO_INICIAL
  let y0 = 250
  let slot = 0
  MOVES.forEach(([d, lines, id, valor], i) => {
    let ls = lines
    // 1 linha: na âncora; 2: acima + âncora; 3: acima + âncora + abaixo (centralizadas na âncora)
    let offs = lines.length === 1 ? [0] : lines.length === 2 ? [-10, 0] : [-10, 0, 10]
    if (i === PAGE1_ROWS) {
      // a descrição cruza a página: a linha acima da âncora fica no fim da página 1; o restante, no topo da 2
      t(lines[0], COL.desc, 250 + ROW_H * PAGE1_ROWS - 10)
      doc.addPage()
      footer(2); tableHeader(60)
      y0 = 95; slot = 0
      ls = lines.slice(1)
      offs = [0, 10]
    }
    const y = y0 + ROW_H * slot++
    saldo = Math.round((saldo + valor) * 100) / 100
    ls.forEach((l, k) => t(l, COL.desc, y + offs[k]))
    t(d, COL.data, y); t(id, COL.id, y); t(brl(valor), COL.valor, y); t(brl(saldo), COL.saldo, y)
  })
  doc.end()
  return { entradas, saidas, saldoFinal }
}

// PDFs auxiliares para os testes de detecção da fonte
function simples(file, linhas) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { CreationDate: new Date('2026-10-22T12:00:00Z') } })
  doc.pipe(createWriteStream(join(OUT, file)))
  linhas.forEach((l, i) => doc.font('Helvetica').fontSize(10).text(l, 40, 40 + i * 14, { lineBreak: false }))
  if (!linhas.length) doc.rect(40, 40, 200, 100).stroke() // só desenho: simula um PDF escaneado, sem texto
  doc.end()
}

console.log(build('mercadopago_extrato.pdf'))
build('mercadopago_totais_errados.pdf', { saldoFinalImpresso: 9999.99 })
simples('pdf_outro_banco.pdf', ['Banco Exemplo S.A.', 'EXTRATO DE CONTA', 'Titular: Fulano de Tal', 'Sem relação com o Mercado Pago? Não: este é outro emissor.'.replace('Mercado Pago', 'emissor')])
simples('pdf_santander.pdf', ['Banco Santander (Brasil) S.A.', 'EXTRATO CONSOLIDADO INTELIGENTE', 'Titular: Fulano de Tal'])
simples('pdf_sem_texto.pdf', [])
