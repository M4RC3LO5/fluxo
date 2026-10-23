<template>
  <div class="flex flex-col gap-8 pb-10 pt-14 md:block md:space-y-10" data-testid="pf-dashboard">
    <div class="text-center space-y-2">
      <h1 class="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Dashboard</h1>
      <p class="text-sm text-slate-400 max-w-2xl mx-auto">O que entrou, o que saiu e o que sobrou no mês</p>
    </div>

    <!-- seletor de visão (Pessoal | Contas a pagar), vindo da página -->
    <slot />

    <template v-if="months.length > 0">
      <!-- a) Seletor de mês -->
      <section class="flex items-center justify-center gap-2" aria-label="Mês">
        <button type="button" data-testid="pf-month-prev" aria-label="Mês anterior" :disabled="!canPrev" @click="shift(1)"
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-xl text-slate-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">‹</button>
        <p data-testid="pf-month-label" class="min-w-[10rem] text-center text-lg font-bold text-white">{{ monthLabel(selected) }}</p>
        <button type="button" data-testid="pf-month-next" aria-label="Próximo mês" :disabled="!canNext" @click="shift(-1)"
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-xl text-slate-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">›</button>
      </section>

      <!-- b) Entradas, Saídas e Saldo -->
      <section>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-6">
          <div data-testid="pf-kpi-in" role="button" tabindex="0" title="Ver as entradas do mês"
            class="kpi-card min-w-0 cursor-pointer p-4 flex flex-col items-center text-center transition-all hover:scale-[1.02] active:scale-[0.98]"
            style="--kpi-color: #10b981"
            @click="openLancamentos({ kind: 'in' })" @keydown.enter.prevent="openLancamentos({ kind: 'in' })" @keydown.space.prevent="openLancamentos({ kind: 'in' })">
            <span class="mb-2 text-3xl">📈</span>
            <p class="whitespace-nowrap text-xl font-bold tracking-tight text-emerald-400 md:text-2xl">{{ formatCurrency(summary.entradas) }}</p>
            <p class="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:text-xs">Entradas</p>
          </div>
          <div data-testid="pf-kpi-out" role="button" tabindex="0" title="Ver as saídas do mês"
            class="kpi-card min-w-0 cursor-pointer p-4 flex flex-col items-center text-center transition-all hover:scale-[1.02] active:scale-[0.98]"
            style="--kpi-color: #ef4444"
            @click="openLancamentos({ kind: 'out' })" @keydown.enter.prevent="openLancamentos({ kind: 'out' })" @keydown.space.prevent="openLancamentos({ kind: 'out' })">
            <span class="mb-2 text-3xl">📉</span>
            <p class="whitespace-nowrap text-xl font-bold tracking-tight text-rose-400 md:text-2xl">{{ formatCurrency(summary.saidas) }}</p>
            <p class="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:text-xs">Saídas</p>
          </div>
          <div data-testid="pf-kpi-balance" class="kpi-card min-w-0 p-4 flex flex-col items-center text-center"
            :style="{ '--kpi-color': summary.saldo >= 0 ? '#10b981' : '#ef4444' }">
            <span class="mb-2 text-3xl">⚖️</span>
            <p class="whitespace-nowrap text-xl font-bold tracking-tight md:text-2xl" :class="summary.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ formatCurrency(summary.saldo) }}</p>
            <p class="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:text-xs">Saldo</p>
          </div>
        </div>
      </section>

      <!-- c) Transferências (informativo) e lançamentos sem tipo -->
      <section class="space-y-2">
        <div data-testid="pf-transfers" role="button" tabindex="0" title="Ver as transferências do mês"
          class="glass-card flex min-h-[44px] cursor-pointer flex-wrap items-center justify-between gap-2 border-l-4 border-l-sky-500 p-4 transition-colors hover:bg-white/[0.06]"
          @click="openLancamentos({ kind: 'transfer' })" @keydown.enter.prevent="openLancamentos({ kind: 'transfer' })" @keydown.space.prevent="openLancamentos({ kind: 'transfer' })">
          <p class="text-sm text-slate-300"><span class="font-semibold text-sky-300">Transferências:</span> <span class="font-mono font-bold text-white">{{ formatCurrency(summary.transferencias) }}</span> <span class="text-slate-400">({{ summary.transferCount }})</span></p>
          <p class="text-xs text-slate-500">não entram nas contas</p>
        </div>
        <p v-if="summary.untypedCount > 0" data-testid="pf-untyped" class="text-center text-xs text-amber-300">
          {{ summary.untypedCount }} {{ summary.untypedCount === 1 ? 'lançamento sem tipo' : 'lançamentos sem tipo' }}
        </p>
      </section>

      <!-- d) Entradas × Saídas dos 12 meses -->
      <section>
        <h2 class="mb-4 text-center text-xs font-bold uppercase tracking-widest text-slate-500 md:mb-6">Entradas × Saídas (12 meses)</h2>
        <div class="glass-card p-3 sm:p-5">
          <PfMonthlyChart :series="series" :selected="selected" @select="selectMonth" />
        </div>
      </section>

      <!-- e) Maiores gastos -->
      <section class="contents md:block">
        <h2 class="mb-4 text-center text-xs font-bold uppercase tracking-widest text-slate-500 md:mb-8">Maiores gastos do mês</h2>
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 md:gap-8">
          <div class="glass-card p-5 sm:p-6" data-testid="pf-rank-category">
            <h3 class="mb-4 flex items-center gap-2 text-sm font-semibold text-white"><span>🏷️</span> Maiores gastos por categoria</h3>
            <p v-if="byCategory.length === 0" class="py-4 text-center text-sm text-slate-500">Sem saídas neste mês.</p>
            <div class="space-y-1">
              <div v-for="item in byCategory" :key="item.key" data-testid="pf-rank-row" role="button" tabindex="0"
                class="min-h-[44px] cursor-pointer rounded-xl p-2 transition-colors hover:bg-white/[0.04]"
                @click="openLancamentos({ kind: 'out', category: item.key })"
                @keydown.enter.prevent="openLancamentos({ kind: 'out', category: item.key })"
                @keydown.space.prevent="openLancamentos({ kind: 'out', category: item.key })">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-white">{{ item.name }}</p>
                    <p class="text-xs text-slate-500">{{ item.count }} {{ item.count === 1 ? 'lançamento' : 'lançamentos' }} · {{ formatPct(item.share) }}</p>
                  </div>
                  <p class="ml-2 whitespace-nowrap font-mono text-sm font-bold text-rose-400">{{ formatCurrency(item.total) }}</p>
                </div>
                <div class="mt-2 h-1 overflow-hidden rounded-full bg-white/5"><div class="h-full rounded-full bg-rose-500/70" :style="{ width: `${Math.min(100, item.share)}%` }"></div></div>
              </div>
            </div>
          </div>

          <div class="glass-card p-5 sm:p-6" data-testid="pf-rank-description">
            <h3 class="mb-4 flex items-center gap-2 text-sm font-semibold text-white"><span>🧾</span> Maiores gastos por descrição</h3>
            <p v-if="byDescription.length === 0" class="py-4 text-center text-sm text-slate-500">Sem saídas neste mês.</p>
            <div class="space-y-1">
              <div v-for="item in byDescription" :key="item.key" data-testid="pf-rank-row" role="button" tabindex="0"
                class="min-h-[44px] cursor-pointer rounded-xl p-2 transition-colors hover:bg-white/[0.04]"
                @click="openLancamentos({ kind: 'out', search: item.name })"
                @keydown.enter.prevent="openLancamentos({ kind: 'out', search: item.name })"
                @keydown.space.prevent="openLancamentos({ kind: 'out', search: item.name })">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-white">{{ item.name }}</p>
                    <p class="text-xs text-slate-500">{{ item.count }} {{ item.count === 1 ? 'lançamento' : 'lançamentos' }} · {{ formatPct(item.share) }}</p>
                  </div>
                  <p class="ml-2 whitespace-nowrap font-mono text-sm font-bold text-rose-400">{{ formatCurrency(item.total) }}</p>
                </div>
                <div class="mt-2 h-1 overflow-hidden rounded-full bg-white/5"><div class="h-full rounded-full bg-rose-500/70" :style="{ width: `${Math.min(100, item.share)}%` }"></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <div v-else data-testid="pf-no-paid" class="glass-card flex flex-col items-center justify-center py-16 text-center">
      <span class="mb-4 text-5xl">🗓️</span>
      <h3 class="mb-2 text-lg font-semibold text-white">Nenhum lançamento pago para mostrar</h3>
      <p class="max-w-md text-sm text-slate-400">A visão Pessoal considera só o dinheiro que de fato se moveu. Veja os pendentes em “Contas a pagar”.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { useFinanceStore } from '@/stores/financeStore.js'
import PfMonthlyChart from '@/components/dashboard/PfMonthlyChart.vue'
import { formatCurrency } from '@/utils/formatters.js'
import {
  availableMonths, monthSummary, monthlySeries, topExpensesByCategory, topExpensesByDescription, monthLabel
} from '@/modules/kpis/pfKpis.js'

const financeStore = useFinanceStore()
const router = useRouter()

const months = computed(() => availableMonths(financeStore.entries))

// mês escolhido (vive na store para sobreviver à ida e volta ao Lançamentos); padrão = o mais recente
watchEffect(() => {
  if (months.value.length && !months.value.includes(financeStore.pfMonth)) financeStore.pfMonth = months.value[0]
})
const selected = computed(() => (months.value.includes(financeStore.pfMonth) ? financeStore.pfMonth : months.value[0] || ''))
const index = computed(() => months.value.indexOf(selected.value))
const canPrev = computed(() => index.value < months.value.length - 1) // mais antigo
const canNext = computed(() => index.value > 0) // mais recente

function shift(delta) {
  const target = months.value[index.value + delta]
  if (target) financeStore.pfMonth = target
}
function selectMonth(month) {
  if (months.value.includes(month)) financeStore.pfMonth = month
  // clicar numa barra de mês sem lançamentos pagos não muda o mês
}

const summary = computed(() => monthSummary(financeStore.entries, selected.value))
const series = computed(() => monthlySeries(financeStore.entries, selected.value, 12))
const byCategory = computed(() => topExpensesByCategory(financeStore.entries, selected.value, 5))
const byDescription = computed(() => topExpensesByDescription(financeStore.entries, selected.value, 5))

const formatPct = (n) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

/** Abre a lista com os filtros do mês (só pagos, como nos totais) + os extras. */
function openLancamentos(extra) {
  financeStore.resetFilters()
  Object.assign(financeStore.filters, { status: 'paid', month: selected.value, ...extra })
  router.push({ path: '/lancamentos' })
}
</script>
