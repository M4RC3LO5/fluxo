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
        class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
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

        <!-- Busca -->
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
          </svg>
          <input
            data-testid="filter-search"
            v-model="financeStore.filters.search"
            type="text"
            placeholder="Buscar em qualquer campo..."
            class="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
          />
        </div>

        <!-- Status -->
        <select
          data-testid="filter-status"
          v-model="financeStore.filters.status"
          class="bg-white/5 border border-white/10 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-white [&>option]:bg-slate-800"
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
          class="bg-white/5 border border-white/10 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-white [&>option]:bg-slate-800"
        >
          <option value="">Todos os responsáveis</option>
          <option v-for="r in responsaveis" :key="r" :value="r">{{ r }}</option>
        </select>

        <!-- Centro de custo -->
        <select
          data-testid="filter-center"
          v-model="financeStore.filters.center"
          class="bg-white/5 border border-white/10 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-white [&>option]:bg-slate-800"
        >
          <option value="">Todos os centros</option>
          <option v-for="c in centros" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <!-- Limpar filtros -->
      <div v-if="hasActiveFilters" class="mt-3 flex justify-end">
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

    <!-- Tabela -->
    <div class="glass-card overflow-hidden">

      <!-- Estado vazio -->
      <div v-if="financeStore.totalEntries === 0" class="p-16 text-center">
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
      <div v-else-if="filteredEntries.length === 0" class="p-12 text-center">
        <p class="text-slate-400">Nenhum lançamento encontrado para os filtros aplicados.</p>
        <button @click="clearFilters" class="mt-3 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          Limpar filtros
        </button>
      </div>

      <!-- Tabela com dados -->
      <div v-else class="overflow-x-auto">
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
                  :class="entry.type === 'receita' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'"
                  class="text-xs px-2 py-1 rounded-lg font-medium"
                >
                  {{ entry.type === 'receita' ? 'Receita' : 'Despesa' }}
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

    <!-- Modal de detalhe -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="selectedEntry" data-testid="lanc-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="selectedEntry = null"></div>
          <div class="relative bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">

            <!-- Header do modal -->
            <div class="flex items-start justify-between mb-5">
              <div class="flex-1 min-w-0 pr-3">
                <h2 class="text-white font-semibold text-lg leading-snug">{{ selectedEntry.description }}</h2>
                <p class="text-slate-400 text-sm mt-0.5">{{ formatDate(selectedEntry.dueDate) }}</p>
              </div>
              <button data-testid="lanc-modal-close" aria-label="Fechar" @click="selectedEntry = null" class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <!-- Status badge -->
            <div class="mb-5">
              <span :class="statusClass(selectedEntry)" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium">
                <span class="w-2 h-2 rounded-full" :class="statusDotClass(selectedEntry)"></span>
                {{ statusLabel(selectedEntry) }}
              </span>
            </div>

            <!-- Grid de campos -->
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-white/5 rounded-xl p-3">
                <p class="text-slate-500 text-xs mb-1">Valor Previsto</p>
                <p class="text-white font-mono font-semibold">{{ formatCurrency(selectedEntry.forecast) }}</p>
              </div>
              <div class="bg-white/5 rounded-xl p-3">
                <p class="text-slate-500 text-xs mb-1">Valor Pago</p>
                <p class="font-mono font-semibold" :class="selectedEntry.paid > 0 ? 'text-emerald-400' : 'text-slate-600'">
                  {{ selectedEntry.paid > 0 ? formatCurrency(selectedEntry.paid) : '—' }}
                </p>
              </div>
              <div class="bg-white/5 rounded-xl p-3">
                <p class="text-slate-500 text-xs mb-1">Responsável</p>
                <p class="text-slate-200 text-sm font-medium">{{ selectedEntry.responsible || '—' }}</p>
              </div>
              <div class="bg-white/5 rounded-xl p-3">
                <p class="text-slate-500 text-xs mb-1">Pagador</p>
                <p class="text-slate-200 text-sm font-medium">{{ selectedEntry.payer || '—' }}</p>
              </div>
              <div class="bg-white/5 rounded-xl p-3">
                <p class="text-slate-500 text-xs mb-1">Centro de Custo</p>
                <p class="text-slate-200 text-sm font-medium">{{ selectedEntry.center || '—' }}</p>
              </div>
              <div class="bg-white/5 rounded-xl p-3">
                <p class="text-slate-500 text-xs mb-1">Tipo</p>
                <p class="text-sm font-medium" :class="selectedEntry.type === 'receita' ? 'text-emerald-400' : 'text-rose-400'">
                  {{ selectedEntry.type === 'receita' ? 'Receita' : 'Despesa' }}
                </p>
              </div>
            </div>

            <!-- Observações -->
            <div v-if="selectedEntry.notes" class="mt-3 bg-white/5 rounded-xl p-3">
              <p class="text-slate-500 text-xs mb-1">Observações</p>
              <p class="text-slate-300 text-sm">{{ selectedEntry.notes }}</p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { useFinanceStore } from '@/stores/financeStore'

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

const TODAY = new Date().toISOString().slice(0, 10)

function statusLabel(e) {
  if (e.status === 'paid') return 'Pago'
  if (e.dueDate && e.dueDate < TODAY) return 'Vencido'
  return 'Pendente'
}

function statusClass(e) {
  if (e.status === 'paid') return 'bg-emerald-500/15 text-emerald-400'
  if (e.dueDate && e.dueDate < TODAY) return 'bg-rose-500/15 text-rose-400'
  return 'bg-amber-500/15 text-amber-400'
}

function statusDotClass(e) {
  if (e.status === 'paid') return 'bg-emerald-400'
  if (e.dueDate && e.dueDate < TODAY) return 'bg-rose-400'
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
