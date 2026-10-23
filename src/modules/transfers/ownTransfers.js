import { normalizeText } from '@/utils/search.js'

/**
 * Transferências entre contas PRÓPRIAS (funções puras). Um Pix para outra conta do titular não é gasto nem receita.
 * transferSource: 'bank' (o banco/parser já sabia) | 'name' (nome do titular) | 'pair' (par entre contas) | 'manual' | null.
 * Lançamento 'manual' nunca é alterado por detecção automática.
 */
export const TRANSFER_CATEGORY = 'Transferência entre contas'
const MIN_NAME_CHARS = 10 // o banco pode truncar o nome: pelo menos 10 caracteres em comum, desde o início do nome

const norm = (s) => normalizeText(s).replace(/\s+/g, ' ').trim()
const isAlnum = (ch) => ch !== undefined && /[a-z0-9]/.test(ch)
const KEYWORD = /\b(pix|ted|doc)\b|\btransf/

/** Pix/TED/DOC/transferência na descrição. */
export function hasTransferKeyword(description) {
  return KEYWORD.test(norm(description))
}

/** transfer true sem transferSource = 'bank' (lançamento antigo, sem migração). */
export function transferSourceOf(entry) {
  return entry.transferSource ?? (entry.transfer ? 'bank' : null)
}

/**
 * A descrição contém o nome do titular? Casa por PREFIXO do nome (pode vir truncado):
 * >= 10 caracteres em comum desde o início do nome, e o texto não pode seguir com OUTRA letra logo depois
 * ("Marina Exemplo Santos Filho" não é "Marina Exemplo Santos Pereira").
 */
export function containsHolderName(description, holderName) {
  const text = norm(description)
  const name = norm(holderName)
  if (name.length < MIN_NAME_CHARS) return false
  for (let i = text.indexOf(name[0]); i !== -1; i = text.indexOf(name[0], i + 1)) {
    if (i > 0 && isAlnum(text[i - 1])) continue // começa no início de uma palavra
    let l = 0
    while (l < name.length && text[i + l] === name[l]) l++
    if (l < MIN_NAME_CHARS) continue
    if (l === name.length || !isAlnum(text[i + l])) return true // nome inteiro, ou truncado onde o texto acabou
  }
  return false
}

const isOwnTransferMark = (e) => transferSourceOf(e) === 'manual'

// deixa de ser transferência automática (a categoria automática de transferência também sai)
function unmark(e) {
  const own = e.category === TRANSFER_CATEGORY && e.categorySource !== 'manual'
  return { ...e, transfer: false, transferSource: null, pairedWith: null, ...(own ? { category: null, categorySource: null } : {}) }
}

function markTransfer(entry, source, pairedWith = null) {
  return { ...entry, transfer: true, transferSource: source, pairedWith, category: TRANSFER_CATEGORY, categorySource: 'rule' }
}

/**
 * Pix/TED/transferência cuja descrição traz o nome do titular → transferência ('name').
 * Se um nome foi removido, o que só era transferência por causa dele ('name' que não casa mais) volta ao normal.
 */
export function markByHolderName(entries, holderNames) {
  const names = (holderNames || []).filter(Boolean)
  const matches = (e) => hasTransferKeyword(e.description) && names.some(n => containsHolderName(e.description, n))
  return entries.map(e => {
    if (isOwnTransferMark(e)) return e
    if (e.transfer) return transferSourceOf(e) === 'name' && !matches(e) ? unmark(e) : e
    return matches(e) ? markTransfer(e, 'name') : e
  })
}

const dayNumber = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : NaN
}
const cents = (n) => Math.round((Number(n) || 0) * 100)

/**
 * Pareia Pix/TED entre contas diferentes: uma saída e uma entrada de mesmo valor (em centavos), em OUTRA conta,
 * com 0 ou 1 dia de diferença. Só pareia se houver EXATAMENTE 1 candidato de cada lado.
 * A entrada precisa ser Pix/TED/transferência OU já ser transferência (por nome/banco).
 */
export function pairTransfers(entries) {
  const outs = entries.filter(e => e.type === 'out' && !e.transfer && !isOwnTransferMark(e) && !e.pairedWith && hasTransferKeyword(e.description))
  const ins = entries.filter(e => e.type === 'in' && !isOwnTransferMark(e) && !e.pairedWith && (e.transfer || hasTransferKeyword(e.description)))

  const compatible = (o, i) => o.account !== i.account && cents(o.forecast) === cents(i.forecast)
    && Math.abs(dayNumber(o.dueDate) - dayNumber(i.dueDate)) <= 1

  const pairs = new Map() // id da saída → entrada
  for (const o of outs) {
    const cands = ins.filter(i => compatible(o, i))
    if (cands.length !== 1) continue
    const back = outs.filter(x => compatible(x, cands[0]))
    if (back.length === 1) pairs.set(o.id, cands[0])
  }
  if (!pairs.size) return entries

  const partnerOf = new Map()
  for (const [outId, i] of pairs) { partnerOf.set(outId, i.id); partnerOf.set(i.id, outId) }
  return entries.map(e => {
    const partner = partnerOf.get(e.id)
    if (!partner) return e
    // quem já é transferência (banco/nome) só ganha o vínculo; os demais viram transferência 'pair'
    return e.transfer ? { ...e, pairedWith: partner } : markTransfer(e, 'pair', partner)
  })
}

/** Nome do titular + pareamento sobre todos os lançamentos. Idempotente. */
export function detectOwnTransfers(entries, holderNames) {
  return pairTransfers(markByHolderName(entries, holderNames))
}

const ownCategory = (e) => e.category === TRANSFER_CATEGORY && e.categorySource !== 'manual'
const revert = (e) => ({
  ...e, transfer: false, transferSource: 'manual', pairedWith: null,
  ...(ownCategory(e) ? { category: null, categorySource: null } : {})
})

/** "Não é transferência": volta a ser Entrada/Saída, vira 'manual' e, se estava pareado, desfaz o par nos dois. */
export function undoTransfer(entries, id) {
  const target = entries.find(e => e.id === id)
  if (!target || !target.transfer || transferSourceOf(target) === 'bank') return entries
  const partnerId = target.pairedWith
  return entries.map(e => {
    if (e.id === id) return revert(e)
    if (partnerId && e.id === partnerId) {
      // o par que só era transferência por causa do pareamento volta junto; os demais só perdem o vínculo
      return transferSourceOf(e) === 'pair' ? revert(e) : { ...e, pairedWith: null }
    }
    return e
  })
}

/** "Marcar como transferência entre contas" (só Pix/TED/transferência em Entrada/Saída). */
export function markTransferManual(entries, id) {
  return entries.map(e => {
    if (e.id !== id || e.transfer || (e.type !== 'in' && e.type !== 'out') || !hasTransferKeyword(e.description)) return e
    return { ...e, transfer: true, transferSource: 'manual', pairedWith: null, category: TRANSFER_CATEGORY, categorySource: 'manual' }
  })
}
