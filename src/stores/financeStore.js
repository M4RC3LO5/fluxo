import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { KEYS, load, save, debounced } from '@/modules/persistence/storage.js'
import { today } from '@/utils/formatters.js'
import { buildSearchIndex, matches } from '@/utils/search.js'

export const useFinanceStore = defineStore('finance', () => {
  const entries = ref([])
  const showDataLabels = ref(false)
  const filters = ref({ status: 'all', alert: '', search: '', responsible: '', center: '' })

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
    const { status, search, responsible, center } = filters.value
    const t = today()
    return entries.value.filter(e => {
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
  function setEntries(data) {
    entries.value = data
  }

  const persist = debounced(() => save(KEYS.entries, entries.value))
  watch(entries, persist, { deep: true })

  // limpar grava na hora, sem esperar o debounce
  function clearEntries() {
    entries.value = []
    return persist.flush()
  }

  async function hydrate() {
    const saved = await load(KEYS.entries)
    if (Array.isArray(saved)) entries.value = saved
  }

  return {
    entries, showDataLabels, filters,
    totalEntries, totalForecast, totalPaid, totalPending, overdueUnpaid,
    forecastVsPaidDiff, paidCount, pendingCount,
    totalByResponsible, totalByPayer, totalByCenter, upcomingDue,
    filteredEntries,
    setEntries, clearEntries, hydrate
  }
})
