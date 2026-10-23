<template>
  <div class="space-y-6 pb-10 pt-14">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-white">Lançamentos</h1>
        <p data-testid="lanc-count" class="text-slate-400 text-sm mt-1">
          {{ filteredEntries.length }} de {{ financeStore.totalEntries }} registros
        </p>
      </div>
      <button
        @click="$router.push('/importacoes')"
        class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 min-h-[44px] md:min-h-0 rounded-xl transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        Importar
      </button>
    </div>

    <!-- Filtros -->
    <div class="glass-card p-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

        <!-- Busca (+ botão Filtros no celular) -->
        <div class="flex gap-2">
        <div class="relative min-w-0 flex-1">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
          </svg>
          <input
            ref="searchInput"
            data-testid="filter-search"
            v-model="financeStore.filters.search"
            type="text"
            placeholder="Buscar em qualquer campo..."
            class="w-full min-h-[44px] md:min-h-0 bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm rounded-xl pl-9 pr-11 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            v-if="financeStore.filters.search"
            type="button"
            data-testid="search-clear"
            aria-label="Limpar busca"
            @click="clearSearch"
            class="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-colors hover:text-white active:bg-white/10"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <button
          type="button"
          data-testid="filters-button"
          @click="filterSheetOpen = true"
          class="md:hidden min-h-[44px] shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition-colors active:bg-white/10"
        >{{ filtersLabel }}</button>
        </div>

        <!-- Status -->
        <select
          data-testid="filter-status"
          v-model="financeStore.filters.status"
          class="hidden md:block bg-white/5 border border-white/10 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-white [&>option]:bg-slate-800"
        >
          <option value="all">Todos os status</option>
          <option value="paid">Pago</option>
          <option value="pending">Pendente</option>
          <option value="overdue">Vencido</option>
        </select>

        <!-- Responsável -->
        <select
          data-testid="filter-responsible"
          v-model="financeStore.filters.responsible"
          class="hidden md:block bg-white/5 border border-white/10 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-white [&>option]:bg-slate-800"
        >
          <option value="">Todos os responsáveis</option>
          <option v-for="r in responsaveis" :key="r" :value="r">{{ r }}</option>
        </select>

        <!-- Centro de custo -->
        <select
          data-testid="filter-center"
          v-model="financeStore.filters.center"
          class="hidden md:block bg-white/5 border border-white/10 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-white [&>option]:bg-slate-800"
        >
          <option value="">Todos os centros</option>
          <option v-for="c in centros" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <!-- Limpar filtros -->
      <div v-if="hasActiveFilters" class="mt-3 hidden md:flex justify-end">
        <button
          data-testid="filter-clear"
          @click="clearFilters"
          class="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
          Limpar filtros
        </button>
      </div>
    </div>

    <!-- Chips de status (celular) -->
    <div v-if="financeStore.totalEntries > 0" class="md:hidden -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar por status">
      <button
        v-for="chip in statusChips"
        :key="chip.value"
        type="button"
        data-testid="status-chip"
        :aria-pressed="financeStore.filters.status === chip.value"
        @click="financeStore.filters.status = chip.value"
        class="min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-medium transition-colors"
        :class="financeStore.filters.status === chip.value
          ? 'border-indigo-500 bg-indigo-600/30 text-white'
          : 'border-white/10 bg-white/5 text-slate-300'"
      >{{ chip.label }}</button>
    </div>

    <!-- Filtros vindos do Dashboard (mês, tipo, categoria): chips removíveis -->
    <div v-if="activeChips.length" class="flex flex-wrap items-center gap-2" data-testid="filter-chips">
      <button
        v-for="chip in activeChips"
        :key="chip.key"
        type="button"
        data-testid="filter-chip"
        :aria-label="`Remover filtro ${chip.label}`"
        @click="removeChip(chip.key)"
        class="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-brand-500/40 bg-brand-600/20 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-600/30 md:min-h-0 md:py-1.5"
      >{{ chip.label }} <span aria-hidden="true" class="text-slate-300">×</span></button>
      <button type="button" data-testid="filter-chips-clear" @click="clearChips"
        class="min-h-[44px] rounded-full px-3 text-sm font-medium text-brand-300 hover:bg-white/5 md:min-h-0 md:py-1.5">Limpar</button>
    </div>

    <!-- Lista -->
    <div>

      <!-- Estado vazio -->
      <div v-if="financeStore.totalEntries === 0" class="glass-card p-16 text-center">
        <div class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <p class="text-slate-300 font-medium mb-1">Nenhum dado importado</p>
        <p class="text-slate-500 text-sm mb-4">Importe uma planilha para começar a analisar seus lançamentos.</p>
        <button
          @click="$router.push('/importacoes')"
          class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
        >
          Ir para Importações
        </button>
      </div>

      <!-- Sem resultados com filtro ativo -->
      <div v-else-if="filteredEntries.length === 0" class="glass-card p-12 text-center">
        <p class="text-slate-400">Nenhum lançamento encontrado para os filtros aplicados.</p>
        <button @click="clearFilters" class="mt-3 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          Limpar filtros
        </button>
      </div>

      <!-- Cards (celular) -->
      <div v-else class="md:hidden space-y-3" data-testid="lanc-cards">
        <p data-testid="lanc-summary" class="text-sm text-slate-400">
          {{ filteredEntries.length }} {{ filteredEntries.length === 1 ? 'lançamento' : 'lançamentos' }} · Previsto
          <span class="font-mono font-medium text-slate-200">{{ formatCurrency(totalForecastFiltered) }}</span>
        </p>
        <template v-if="groups">
          <section v-for="g in groups" :key="g.key" data-testid="lanc-group" class="space-y-2">
            <h3 data-testid="lanc-group-header" class="pt-2 text-xs font-bold uppercase tracking-widest text-slate-500">{{ g.label }}</h3>
            <LancamentoCard v-for="entry in g.items" :key="entry.id" :entry="entry" @open="openDetail" />
          </section>
        </template>
        <div v-else class="space-y-2">
          <LancamentoCard v-for="entry in sortedEntries" :key="entry.id" :entry="entry" @open="openDetail" />
        </div>
      </div>

      <!-- Tabela com dados (desktop) -->
      <div v-if="filteredEntries.length > 0" class="hidden md:block glass-card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-white/10">
              <th
                v-for="col in columns"
                :key="col.key"
                @click="col.sortable && toggleSort(col.key)"
                class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap"
                :class="col.sortable ? 'cursor-pointer hover:text-slate-200 select-none' : ''"
              >
                <span class="flex items-center gap-1">
                  {{ col.label }}
                  <span v-if="col.sortable" class="text-slate-600">
                    <svg v-if="sort.key === col.key && sort.dir === 'asc'" class="w-3 h-3 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5H7z"/></svg>
                    <svg v-else-if="sort.key === col.key && sort.dir === 'desc'" class="w-3 h-3 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5H7z"/></svg>
                    <svg v-else class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5H7zm0-2l5-5 5 5H7z" opacity=".4"/></svg>
                  </span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              data-testid="lanc-row"
              v-for="(entry, idx) in sortedEntries"
              :key="entry.id"
              @click="openDetail(entry)"
              class="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
              :class="idx % 2 === 0 ? '' : 'bg-white/[0.02]'"
            >
              <!-- Vencimento -->
              <td class="px-4 py-3 text-slate-300 whitespace-nowrap font-mono text-xs">
                {{ formatDate(entry.dueDate) }}
              </td>

              <!-- Descrição -->
              <td class="px-4 py-3">
                <div class="text-slate-200 font-medium truncate max-w-[220px]">{{ entry.description }}</div>
                <div v-if="entry.notes" class="text-slate-500 text-xs truncate max-w-[220px] mt-0.5">{{ entry.notes }}</div>
              </td>

              <!-- Status -->
              <td class="px-4 py-3 whitespace-nowrap">
                <span :class="statusClass(entry)" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium">
                  <span class="w-1.5 h-1.5 rounded-full" :class="statusDotClass(entry)"></span>
                  {{ statusLabel(entry) }}
                </span>
              </td>

              <!-- Valor previsto -->
              <td class="px-4 py-3 text-slate-200 text-right whitespace-nowrap font-mono">
                {{ formatCurrency(entry.forecast) }}
              </td>

              <!-- Valor pago -->
              <td class="px-4 py-3 text-right whitespace-nowrap font-mono">
                <span :class="entry.paid > 0 ? 'text-emerald-400' : 'text-slate-600'">
                  {{ entry.paid > 0 ? formatCurrency(entry.paid) : '—' }}
                </span>
              </td>

              <!-- Responsável -->
              <td class="px-4 py-3 text-slate-400 whitespace-nowrap">
                {{ entry.responsible || '—' }}
              </td>

              <!-- Centro de custo -->
              <td class="px-4 py-3 whitespace-nowrap">
                <span v-if="entry.center" class="bg-white/5 text-slate-400 text-xs px-2 py-1 rounded-lg">
                  {{ entry.center }}
                </span>
                <span v-else class="text-slate-600">—</span>
              </td>

              <!-- Tipo -->
              <td class="px-4 py-3 whitespace-nowrap">
                <span
                  data-testid="type-badge"
                  :class="typeBadge(entry).cls"
                  class="text-xs px-2 py-1 rounded-lg font-medium"
                >
                  {{ typeBadge(entry).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Totais do rodapé -->
        <div class="border-t border-white/10 px-4 py-3 flex items-center justify-between bg-white/[0.02]">
          <span class="text-slate-500 text-xs">
            {{ filteredEntries.length }} lançamento{{ filteredEntries.length !== 1 ? 's' : '' }}
          </span>
          <div class="flex items-center gap-6 text-xs">
            <div class="text-slate-400">
              Previsto: <span data-testid="lanc-footer-forecast" class="text-slate-200 font-mono font-medium">{{ formatCurrency(totalForecastFiltered) }}</span>
            </div>
            <div class="text-slate-400">
              Pago: <span class="text-emerald-400 font-mono font-medium">{{ formatCurrency(totalPaidFiltered) }}</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>

    <!-- Painel de filtros (celular) -->
    <LancamentosFilterSheet
      v-model:open="filterSheetOpen"
      :responsaveis="responsaveis"
      :centros="centros"
      :responsible="financeStore.filters.responsible"
      :center="financeStore.filters.center"
      :sort="sortValue"
      @apply="applySheet"
    />

    <!-- Detalhe: painel inferior no celular -->
    <BottomSheet
      v-if="!isDesktop"
      :open="!!selectedEntry"
      :title="selectedEntry?.description || ''"
      :subtitle="selectedEntry ? formatDate(selectedEntry.dueDate) : ''"
      @close="selectedEntry = null"
    >
      <LancamentoDetail v-if="selectedEntry" :entry="selectedEntry" :show-header="false" />
    </BottomSheet>

    <!-- Detalhe: modal central no desktop -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="selectedEntry && isDesktop" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="selectedEntry = null"></div>
          <div class="relative bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <LancamentoDetail :entry="selectedEntry" @close="selectedEntry = null" />
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { useFinanceStore } from '@/stores/financeStore'
import { today } from '@/utils/formatters.js'
import { monthShortLabel, NO_CATEGORY, NO_CATEGORY_LABEL } from '@/modules/kpis/pfKpis.js'
import { typeBadge } from '@/utils/entryType.js'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import LancamentoCard from '@/components/lancamentos/LancamentoCard.vue'
import LancamentoDetail from '@/components/lancamentos/LancamentoDetail.vue'
import LancamentosFilterSheet from '@/components/lancamentos/LancamentosFilterSheet.vue'

const financeStore = useFinanceStore()

// ─── Filtered entries do store ────────────────────────────────────────────────
const filteredEntries = computed(() => financeStore.filteredEntries)

// ─── Opções de filtro dinâmicas ───────────────────────────────────────────────
const responsaveis = computed(() => {
  const s = new Set(financeStore.entries.map(e => e.responsible).filter(Boolean))
  return [...s].sort()
})

const centros = computed(() => {
  const s = new Set(financeStore.entries.map(e => e.center).filter(Boolean))
  return [...s].sort()
})

const hasActiveFilters = computed(() => {
  const f = financeStore.filters
  return f.status !== 'all' || f.search || f.responsible || f.center
})

const searchInput = ref(null)
function clearSearch() {
  financeStore.filters.search = ''
  searchInput.value?.focus()
}

// ─── Chips dos filtros vindos do Dashboard ────────────────────────────────────
const KIND_LABELS = { in: 'Entradas', out: 'Saídas', transfer: 'Transferências' }
const activeChips = computed(() => {
  const { month, kind, category } = financeStore.filters
  const chips = []
  if (month) chips.push({ key: 'month', label: monthShortLabel(month) })
  if (kind) chips.push({ key: 'kind', label: KIND_LABELS[kind] || kind })
  if (category) chips.push({ key: 'category', label: `Categoria: ${category === NO_CATEGORY ? NO_CATEGORY_LABEL : category}` })
  return chips
})
function removeChip(key) { financeStore.filters[key] = '' }
function clearChips() {
  financeStore.filters.month = ''
  financeStore.filters.kind = ''
  financeStore.filters.category = ''
}

function clearFilters() {
  financeStore.filters.status = 'all'
  financeStore.filters.search = ''
  financeStore.filters.responsible = ''
  financeStore.filters.center = ''
}

// ─── Colunas ─────────────────────────────────────────────────────────────────
const columns = [
  { key: 'dueDate',     label: 'Vencimento',  sortable: true  },
  { key: 'description', label: 'Descrição',   sortable: false },
  { key: 'status',      label: 'Status',      sortable: true  },
  { key: 'forecast',    label: 'Previsto',    sortable: true  },
  { key: 'paid',        label: 'Pago',        sortable: true  },
  { key: 'responsible', label: 'Responsável', sortable: true  },
  { key: 'center',      label: 'Centro',      sortable: true  },
  { key: 'type',        label: 'Tipo',        sortable: true  },
]

// ─── Ordenação ────────────────────────────────────────────────────────────────
const sort = ref({ key: 'dueDate', dir: 'asc' })

function toggleSort(key) {
  if (sort.value.key === key) {
    sort.value.dir = sort.value.dir === 'asc' ? 'desc' : 'asc'
  } else {
    sort.value.key = key
    sort.value.dir = 'asc'
  }
}

const sortedEntries = computed(() => {
  const arr = [...filteredEntries.value]
  const { key, dir } = sort.value
  arr.sort((a, b) => {
    const av = a[key] ?? ''
    const bv = b[key] ?? ''
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
  return arr
})

// ─── Totais filtrados ─────────────────────────────────────────────────────────
const totalForecastFiltered = computed(() =>
  filteredEntries.value.reduce((s, e) => s + (e.forecast || 0), 0)
)
const totalPaidFiltered = computed(() =>
  filteredEntries.value.filter(e => e.status === 'paid').reduce((s, e) => s + (e.forecast || 0), 0)
)

// ─── Celular: chips, painel de filtros, grupos por mês ───────────────────────
const statusChips = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'overdue', label: 'Vencido' },
  { value: 'paid', label: 'Pago' },
]
const filterSheetOpen = ref(false)
const sortValue = computed(() => `${sort.value.key}:${sort.value.dir}`)
const DEFAULT_SORT = 'dueDate:asc'
// tudo que está fora do padrão no painel: responsável, centro e ordenação diferente de "Vencimento ↑"
const activeSheetFilters = computed(() =>
  (financeStore.filters.responsible ? 1 : 0) +
  (financeStore.filters.center ? 1 : 0) +
  (sortValue.value !== DEFAULT_SORT ? 1 : 0))
const filtersLabel = computed(() => activeSheetFilters.value ? `Filtros (${activeSheetFilters.value})` : 'Filtros')

function applySheet({ responsible, center, sort: sortStr }) {
  financeStore.filters.responsible = responsible
  financeStore.filters.center = center
  const [key, dir] = sortStr.split(':')
  sort.value = { key, dir }
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
// agrupa por mês só quando ordenado por vencimento (a lista já vem ordenada por ele)
const groups = computed(() => {
  if (sort.value.key !== 'dueDate') return null
  const out = []
  for (const e of sortedEntries.value) {
    const k = e.dueDate ? e.dueDate.slice(0, 7) : ''
    let g = out[out.length - 1]
    if (!g || g.key !== k) {
      g = { key: k, label: k ? `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}` : 'Sem vencimento', items: [] }
      out.push(g)
    }
    g.items.push(e)
  }
  return out
})

// tela >= md usa modal central; abaixo, painel inferior
const mql = window.matchMedia('(min-width: 768px)')
const isDesktop = ref(mql.matches)
const onMqlChange = e => { isDesktop.value = e.matches }
mql.addEventListener('change', onMqlChange)
onUnmounted(() => mql.removeEventListener('change', onMqlChange))

// ─── Modal de detalhe ─────────────────────────────────────────────────────────
const selectedEntry = ref(null)
function openDetail(entry) { selectedEntry.value = entry }

// Esc fecha o modal; o listener só existe enquanto o modal está aberto
function onKeydown(e) {
  if (e.key === 'Escape') selectedEntry.value = null
}
watch(selectedEntry, (entry) => {
  if (entry) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// ─── Formatadores ─────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—'
  try {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  } catch { return d }
}

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}


function statusLabel(e) {
  if (e.status === 'paid') return 'Pago'
  if (e.dueDate && e.dueDate < today()) return 'Vencido'
  return 'Pendente'
}

function statusClass(e) {
  if (e.status === 'paid') return 'bg-emerald-500/15 text-emerald-400'
  if (e.dueDate && e.dueDate < today()) return 'bg-rose-500/15 text-rose-400'
  return 'bg-amber-500/15 text-amber-400'
}

function statusDotClass(e) {
  if (e.status === 'paid') return 'bg-emerald-400'
  if (e.dueDate && e.dueDate < today()) return 'bg-rose-400'
  return 'bg-amber-400'
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}
</style>
