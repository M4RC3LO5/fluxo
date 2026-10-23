// Gera PDFs SINTÉTICOS (dados inventados) imitando o "EXTRATO CONSOLIDADO INTELIGENTE" do Santander,
// com as coordenadas (pt, y de cima para baixo do pdfjs) do layout real.
// Uso: node tests/fixtures/scripts/make-santander-pdf.mjs
import PDFDocument from 'pdfkit'
import { createWriteStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOLDER = 'MARINA EXEMPLO SANTOS PEREIRA'
const HOLDER_TRUNC = HOLDER.slice(0, 25) // o banco trunca o nome em 25 caracteres: "MARINA EXEMPLO SANTOS PER"
const SALDO_INICIAL = 737.55

// [data (só no 1º do dia), linhas da descrição, Nº documento, valor, imprime saldo?]
const MOVES = [
  ['02/01', ['DEBITO AUT. TELEFONE CELULAR', 'VIVO MOVEL-SP'], '-', -156, true],
  ['05/01', ['PIX ENVIADO OPEN FINANCE', HOLDER_TRUNC], '-', -581.55, false],
  [null, ['REMUNERACAO APLICACAO AUTOMATICA'], '-', 0.02, true],
  ['08/01', ['PIX RECEBIDO', 'CARLOS TERCEIRO LIMA'], '-', 1200, false],
  [null, ['TARIFA MENSAL PACOTE', 'SERVICOS'], '-', -38.9, true, { cruza: true }], // a 2ª linha cai na página 3
  ['12/01', ['IOF OPERACAO CREDITO', 'CONTRATO 0098'], '-', -4.3, false],
  [null, ['JUROS CHEQUE ESPECIAL'], '-', -12.75, true],
  ['20/01', ['PIX RECEBIDO', HOLDER_TRUNC], '-', 3226, false],
  [null, ['PAGAMENTO IPVA-CANAIS', 'INTERNET LICENCIAMENTO EL'], '-', -3325.35, false],
  [null, ['PIX RECEBIDO', 'ANA CLIENTE SILVA'], '-', 99.33, true],
  ['30/01', ['OPERACOES CREDITO IMOBILIARIO', 'PREST CR IM'], '512701', -2655.88, false],
  [null, ['PIX RECEBIDO', HOLDER_TRUNC], '-', 2655.88, true]
]
const PAGE2_MOVES = 5

const fmt = (n) => Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const signed = (n) => fmt(n) + (n < 0 ? '-' : '') // sinal NO FIM

function build(file, { debitosImpressos } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: 'Extrato sintético', CreationDate: new Date('2026-10-22T12:00:00Z') } })
  doc.pipe(createWriteStream(join(OUT, file)))
  // y = baseline como o pdfjs informa (de cima para baixo); pdfkit posiciona pelo topo
  const t = (str, x, y, size = 8, font = 'Helvetica') => doc.font(font).fontSize(size).text(str, x, y - size * 0.7222, { lineBreak: false })
  const right = (str, xr, y, size = 8) => t(str, xr - doc.font('Helvetica').fontSize(size).widthOfString(str), y, size)

  const creditos = MOVES.filter(m => m[3] > 0).reduce((s, m) => s + Math.round(m[3] * 100), 0) / 100
  const debitos = MOVES.filter(m => m[3] < 0).reduce((s, m) => s + Math.round(m[3] * 100), 0) / 100
  const saldoFinal = Math.round((SALDO_INICIAL * 100) + creditos * 100 + debitos * 100) / 100

  const pageFrame = (n, total) => {
    t('EXTRATO CONSOLIDADO INTELIGENTE', 421, 27, 8, 'Helvetica-Bold')
    t('janeiro/2026', 511, 36, 8)
    t('Extrato_PF_A4_Inteligente_000000', 34, 815, 7)
    t(`Pagina: ${n}/${total}`, 520, 823, 7)
  }
  const tableHeader = (y) => {
    t('Data', 34, y, 8, 'Helvetica-Bold'); t('Descrição', 65, y, 8, 'Helvetica-Bold'); t('Nº Documento', 298, y, 8, 'Helvetica-Bold')
    t('Movimento (R$)', 408, y, 8, 'Helvetica-Bold'); t('Saldo (R$)', 508, y, 8, 'Helvetica-Bold')
  }
  const row = (y, [data, lines, nDoc, valor, comSaldo], saldo) => {
    if (data) t(data, 34, y) // a data só aparece no 1º movimento do dia
    lines.forEach((l, i) => t(l, 65, y + 9 * i)) // descrição: linha da âncora + linhas logo abaixo (~9 pt)
    t(nDoc, nDoc === '-' ? 312 : 300, y)
    right(signed(valor), 462, y)
    if (comSaldo) right(signed(saldo), 545, y) // o saldo só aparece no último movimento do dia
  }

  // ─ página 1: só propaganda
  pageFrame(1, 3)
  t('Santander Exemplo Sempre ao seu lado', 34, 200, 14, 'Helvetica-Bold')
  t('Conheça nossos produtos e serviços. Ofertas sujeitas à análise de crédito.', 34, 230, 9)
  t('Movimentação do mês disponível nas próximas páginas.', 34, 250, 9)

  // ─ página 2: Resumo + início da movimentação
  doc.addPage(); pageFrame(2, 3)
  t('Resumo - janeiro/2026', 34, 290, 10, 'Helvetica-Bold')
  t('Nome', 34, 316, 8); t(HOLDER, 34, 325, 8)
  const linhaResumo = (rotulo, valor, y, indent = 34) => { t(rotulo, indent, y); right(fmt(valor), 410, y) }
  linhaResumo('Saldo de Conta Corrente em 31/12', SALDO_INICIAL, 345)
  linhaResumo('Total de Créditos', creditos, 357)
  linhaResumo('Depósitos / Transferências', creditos - 0.02, 369, 50)
  linhaResumo('Outros Créditos', 0.02, 381, 50)
  linhaResumo('Total de Débitos', debitosImpressos ?? -debitos, 393)
  linhaResumo('Saques / Pagamentos', -debitos, 405, 50)
  linhaResumo('Saldo de Conta Corrente em 31/01', saldoFinal, 417)
  t('Conta Corrente', 34, 450, 10, 'Helvetica-Bold')
  t('Movimentação', 34, 465, 9, 'Helvetica-Bold')
  tableHeader(485)
  t('SALDO EM 31/12', 65, 500, 8, 'Helvetica-Bold'); right(fmt(SALDO_INICIAL), 545, 500)

  let saldo = SALDO_INICIAL
  let y = 515
  MOVES.forEach((m, i) => {
    saldo = Math.round((saldo + m[3]) * 100) / 100
    if (i === PAGE2_MOVES) {
      // a tabela continua na página 3, com o cabeçalho repetido; a 2ª linha da tarifa fica logo abaixo dele
      doc.addPage(); pageFrame(3, 3)
      tableHeader(60)
      t(MOVES[PAGE2_MOVES - 1][1][1], 65, 78)
      y = 96
    }
    const [data, lines, nDoc, valor, comSaldo] = m
    if (i === PAGE2_MOVES - 1) {
      // movimento no pé da página 2: só a 1ª linha da descrição fica nela
      const yBaixo = 790
      if (data) t(data, 34, yBaixo)
      t(lines[0], 65, yBaixo); t(nDoc, 312, yBaixo); right(signed(valor), 462, yBaixo); if (comSaldo) right(signed(saldo), 545, yBaixo)
      return
    }
    row(y, m, saldo)
    y += 9 * Math.max(1, lines.length) + 5
  })
  t('SALDO EM 31/01', 65, y, 8, 'Helvetica-Bold'); right(fmt(saldoFinal), 545, y)
  y += 40

  // ─ seções que devem ser ignoradas (página 3)
  t('Saldos por Período', 34, y, 10, 'Helvetica-Bold'); y += 14
  t('01/01 a 31/01', 65, y); right(fmt(SALDO_INICIAL), 462, y); y += 30
  t('Débito Automático em Conta Corrente', 34, y, 10, 'Helvetica-Bold'); y += 14 // repete um movimento: não pode duplicar
  tableHeader(y); y += 12
  t('02/01', 34, y); t('DEBITO AUT. TELEFONE CELULAR', 65, y); t('-', 312, y); right('156,00-', 462, y); y += 9
  t('VIVO MOVEL-SP', 65, y); y += 30
  t('Poupança', 34, y, 10, 'Helvetica-Bold'); y += 14 // sem movimentos
  t('SALDO ANTERIOR', 65, y); right('0,00', 545, y); y += 9
  t('SALDO ATUAL', 65, y); right('0,00', 545, y); y += 30
  t('Pacote de Serviços', 34, y, 10, 'Helvetica-Bold'); y += 14
  t('Pacote Exemplo Plus - tarifa mensal', 65, y); right('38,90', 462, y)
  doc.end()
  return { creditos, debitos, saldoFinal }
}

console.log(build('santander_extrato.pdf'))
build('santander_totais_errados.pdf', { debitosImpressos: 6718.78 })
