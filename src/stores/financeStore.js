import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { KEYS, load, save, debounced } from '@/modules/persistence/storage.js'
import { today } from '@/utils/formatters.js'
import { buildSearchIndex, matches, normalizeText } from '@/utils/search.js'
import { dedupKey } from '@/modules/importers/dedup.js'
import { applyRules as applyCategoryRules, recalculateRuleCategories } from '@/modules/categories/rules.js'
import { isTransferCategory } from '@/modules/categories/catalog.js'
import { detectOwnTransfers, undoTransfer, markTransferManual } from '@/modules/transfers/ownTransfers.js'

export const useFinanceStore = defineStore('finance', () => {
  const entries = ref([])
  const showDataLabels = ref(false)
  // month 'AAAA-MM' | ''; kind 'in' | 'out' | 'transfer' | ''; category '' | nome | '__none__' (Sem categoria)
  const defaultFilters = () => ({ status: 'all', alert: '', search: '', responsible: '', center: '', month: '', kind: '', category: '' })
  const filters = ref(defaultFilters())
  function resetFilters() { filters.value = defaultFilters() }

  // estado de tela do Dashboard (não persiste): visão ('personal' | 'bills') e mês selecionado da visão Pessoal
  const dashboardView = ref('personal')
  const pfMonth = ref('')

  // ─── Totals ───────────────────────────────────────────────────────────
  const totalEntries = computed(() => entries.value.length)

  const totalForecast = computed(() =>
    entries.value.reduce((s, e) => s + (e.forecast || 0), 0))

  const totalPaid = computed(() =>
    entries.value.filter(e => e.status === 'paid').reduce((s, e) => s + (e.forecast || 0), 0))

  const totalPending = computed(() => {
    const t = today()
    return entries.value
      .filter(e => e.status !== 'paid' && (!e.dueDate || e.dueDate >= t))
      .reduce((s, e) => s + (e.forecast || 0), 0)
  })

  const overdueUnpaid = computed(() => {
    const t = today()
    return entries.value
      .filter(e => e.status !== 'paid' && e.dueDate && e.dueDate < t)
      .reduce((s, e) => s + (e.forecast || 0), 0)
  })

  const forecastVsPaidDiff = computed(() => totalForecast.value - totalPaid.value)

  const paidCount    = computed(() => entries.value.filter(e => e.status === 'paid').length)
  const pendingCount = computed(() => {
    const t = today()
    return entries.value.filter(e => e.status !== 'paid' && (!e.dueDate || e.dueDate >= t)).length
  })

  // ─── Rankings ─────────────────────────────────────────────────────────
  const totalByResponsible = computed(() => {
    const map = {}
    entries.value.forEach(e => {
      const k = e.responsible || 'Sem responsável'
      if (!map[k]) map[k] = { name: k, forecast: 0, paid: 0, count: 0 }
      map[k].forecast += e.forecast || 0
      if (e.status === 'paid') map[k].paid += e.forecast || 0
      map[k].count++
    })
    return Object.values(map).sort((a, b) => b.forecast - a.forecast)
  })

  const totalByPayer = computed(() => {
    const map = {}
    entries.value.filter(e => e.status === 'paid').forEach(e => {
      const k = e.payer || e.responsible || 'Desconhecido'
      if (!map[k]) map[k] = { name: k, total: 0, count: 0 }
      map[k].total += e.forecast || 0
      map[k].count++
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  })

  const totalByCenter = computed(() => {
    const map = {}
    entries.value.forEach(e => {
      const k = e.center || 'Sem centro'
      if (!map[k]) map[k] = { name: k, forecast: 0, paid: 0 }
      map[k].forecast += e.forecast || 0
      if (e.status === 'paid') map[k].paid += e.forecast || 0
    })
    return Object.values(map).sort((a, b) => b.forecast - a.forecast)
  })

  const upcomingDue = computed(() => {
    const t = today()
    return entries.value
      .filter(e => e.status !== 'paid' && e.dueDate && e.dueDate >= t)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  })

  // ─── Filtered entries ─────────────────────────────────────────────────
  const filteredEntries = computed(() => {
    const { status, search, responsible, center, month, kind, category } = filters.value
    const t = today()
    return entries.value.filter(e => {
      if (month && !(e.dueDate && e.dueDate.slice(0, 7) === month)) return false
      if (kind === 'transfer' && !e.transfer) return false
      if ((kind === 'in' || kind === 'out') && (e.transfer || e.type !== kind)) return false
      if (category === '__none__' && e.category) return false
      if (category && category !== '__none__' && normalizeText(e.category) !== normalizeText(category)) return false
      if (status === 'paid'    && e.status !== 'paid') return false
      if (status === 'pending' && (e.status === 'paid' || (e.dueDate && e.dueDate < t))) return false
      if (status === 'overdue' && (e.status === 'paid' || !e.dueDate || e.dueDate >= t)) return false
      if (responsible && e.responsible !== responsible) return false
      if (center && e.center !== center) return false
      if (search && !matches(buildSearchIndex(e, t), search)) return false
      return true
    })
  })

  // ─── Actions ──────────────────────────────────────────────────────────
  const persist = debounced(() => save(KEYS.entries, entries.value))
  watch(entries, persist, { deep: true })

  // soma ao livro-caixa. Duplicata por contagem: cada ocorrência já existente de uma chave "cancela" um
  // lançamento novo com a mesma chave (existente 1× + arquivo 2× → entra 1); repetição só dentro do lote entra.
  // Grava na hora, sem esperar o debounce; resolve { added, skipped } depois de gravar.
  function addEntries(list) {
    const available = new Map()
    for (const e of entries.value) {
      const key = dedupKey(e)
      available.set(key, (available.get(key) || 0) + 1)
    }
    const fresh = list.filter(e => {
      const key = dedupKey(e)
      const n = available.get(key) || 0
      if (n === 0) return true
      available.set(key, n - 1)
      return false
    })
    entries.value = [...entries.value, ...fresh]
    return persist.flush().then(() => ({ added: fresh.length, skipped: list.length - fresh.length }))
  }

  /**
   * Escolha manual de categoria: vira categorySource 'manual' e nenhuma regra mexe mais nele.
   * Categoria de "Não é gasto" (Pagamento de fatura, Transferência entre contas, Investimentos) também marca
   * transfer true (transferSource 'manual'): o lançamento sai de Entradas/Saídas. Escolher uma categoria comum
   * num lançamento que era transferência (manual/regra) devolve-o a Entrada/Saída.
   */
  function setEntryCategory(id, category) {
    const entry = entries.value.find(e => e.id === id)
    if (!entry) return Promise.resolve(false)
    if (isTransferCategory(category)) {
      if (entry.type === 'in' || entry.type === 'out') {
        entry.transfer = true
        entry.transferSource = 'manual'
        entry.pairedWith = null
      }
    } else if (entry.transfer && ['manual', 'rule'].includes(entry.transferSource)) {
      entry.transfer = false
      entry.transferSource = 'manual'
      entry.pairedWith = null
    }
    entry.category = category
    entry.categorySource = 'manual'
    return persist.flush().then(() => true)
  }

  /** Reaplica as regras a todos os lançamentos elegíveis (nunca bank, manual ou transferência). Devolve quantos mudaram. */
  function applyRules(rules) {
    // no lugar: o detalhe aberto acompanha
    return saved(syncTransfers(applyCategoryRules(entries.value, rules)))
  }

  // aplica no lugar o que as funções puras de transferência mudaram (assim o detalhe aberto acompanha)
  const TRANSFER_FIELDS = ['transfer', 'transferSource', 'pairedWith', 'category', 'categorySource']
  function syncTransfers(next) {
    let changed = 0
    next.forEach((n, i) => {
      const current = entries.value[i]
      if (n === current) return
      for (const f of TRANSFER_FIELDS) current[f] = n[f] ?? null
      changed++
    })
    return changed
  }
  const saved = (changed) => (changed > 0 ? persist.flush().then(() => changed) : Promise.resolve(0))

  /** Depois de remover uma regra: o que veio de regra ('rule') é recalculado e pode ficar sem categoria. Devolve quantos mudaram. */
  function recalculateRules(rules) {
    return saved(syncTransfers(recalculateRuleCategories(entries.value, rules)))
  }

  /** Transferências entre contas próprias: nome do titular + pareamento, em todos os lançamentos (idempotente). */
  function applyOwnTransfers(holderNames) {
    return saved(syncTransfers(detectOwnTransfers(entries.value, holderNames)))
  }
  /** "Não é transferência": volta a Entrada/Saída, fica 'manual' e desfaz o par nos dois lados. */
  function undoOwnTransfer(id) {
    return saved(syncTransfers(undoTransfer(entries.value, id)))
  }
  /** "Marcar como transferência entre contas" (Pix/TED em Entrada/Saída). */
  function markOwnTransfer(id) {
    return saved(syncTransfers(markTransferManual(entries.value, id)))
  }

  /** Troca o nome de uma categoria própria nos lançamentos. Devolve quantos mudaram. */
  function renameCategory(oldName, newName) {
    const key = normalizeText(oldName)
    let changed = 0
    for (const e of entries.value) {
      if (e.category && normalizeText(e.category) === key) { e.category = newName; changed++ }
    }
    return saved(changed).then(() => changed)
  }

  /** Quantos lançamentos usam a categoria (sem acento/caixa). */
  function countByCategory(name) {
    const key = normalizeText(name)
    return entries.value.reduce((n, e) => n + (e.category && normalizeText(e.category) === key ? 1 : 0), 0)
  }

  function removeByImport(importId) {
    entries.value = entries.value.filter(e => e.importId !== importId)
    return persist.flush()
  }

  async function hydrate() {
    const saved = await load(KEYS.entries)
    if (Array.isArray(saved)) entries.value = saved
  }

  return {
    entries, showDataLabels, filters, resetFilters, dashboardView, pfMonth,
    totalEntries, totalForecast, totalPaid, totalPending, overdueUnpaid,
    forecastVsPaidDiff, paidCount, pendingCount,
    totalByResponsible, totalByPayer, totalByCenter, upcomingDue,
    filteredEntries,
    addEntries, removeByImport, setEntryCategory, renameCategory, countByCategory, applyRules, recalculateRules, applyOwnTransfers, undoOwnTransfer, markOwnTransfer, hydrate
  }
})
