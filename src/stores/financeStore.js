import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { KEYS, load, save, debounced } from '@/modules/persistence/storage.js'
import { today } from '@/utils/formatters.js'
import { buildSearchIndex, matches, normalizeText } from '@/utils/search.js'
import { dedupKey } from '@/modules/importers/dedup.js'
import { applyRules as applyCategoryRules } from '@/modules/categories/rules.js'

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

  /** Escolha manual de categoria: vira categorySource 'manual' e nenhuma regra mexe mais nele. */
  function setEntryCategory(id, category) {
    const entry = entries.value.find(e => e.id === id)
    if (!entry) return Promise.resolve(false)
    entry.category = category
    entry.categorySource = 'manual'
    return persist.flush().then(() => true)
  }

  /** Reaplica as regras a todos os lançamentos elegíveis (nunca bank, manual ou transferência). Devolve quantos mudaram. */
  function applyRules(rules) {
    const next = applyCategoryRules(entries.value, rules)
    let changed = 0
    next.forEach((n, i) => {
      if (n !== entries.value[i]) {
        Object.assign(entries.value[i], { category: n.category, categorySource: n.categorySource }) // no lugar: o detalhe aberto acompanha
        changed++
      }
    })
    return persist.flush().then(() => changed)
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
    addEntries, removeByImport, setEntryCategory, applyRules, hydrate
  }
})
