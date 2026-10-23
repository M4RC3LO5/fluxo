<template>
  <div class="space-y-8 pb-10 pt-14" data-testid="cm-page">
    <div class="space-y-2 text-center">
      <h1 class="text-3xl font-extrabold tracking-tight text-white md:text-4xl">Compromissos</h1>
      <p class="mx-auto max-w-2xl text-sm text-slate-400">O que já está comprometido todo mês: assinaturas, parcelas e custos do banco.</p>
    </div>

    <div v-if="financeStore.totalEntries === 0" class="glass-card flex flex-col items-center py-14 text-center" data-testid="cm-empty">
      <span class="mb-3 text-5xl">📅</span>
      <h2 class="text-lg font-semibold text-white">Nenhum dado importado ainda</h2>
      <p class="mt-1 max-w-md text-sm text-slate-400">Importe seus extratos para ver o que se repete todo mês.</p>
      <router-link to="/importacoes" class="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-500">📥 Importar</router-link>
    </div>

    <template v-else>
      <!-- Comprometido por mês + próximos 12 meses -->
      <section class="glass-card mx-auto max-w-3xl space-y-4 p-5 sm:p-6">
        <div class="text-center">
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Comprometido por mês</p>
          <p data-testid="cm-total" class="mt-1 text-3xl font-extrabold tracking-tight text-white">{{ formatCurrency(overview.nextMonthTotal) }}</p>
          <p v-if="overview.nextMonth" data-testid="cm-total-detail" class="mt-1 text-xs text-slate-400">
            {{ monthLabel(overview.nextMonth.month) }}: recorrentes {{ formatCurrency(overview.nextMonth.recurring) }} + parcelas {{ formatCurrency(overview.nextMonth.installments) }}
          </p>
        </div>
        <CommitmentsChart v-if="overview.schedule.length" :schedule="overview.schedule" />
      </section>

      <!-- Assinaturas e recorrentes -->
      <section class="mx-auto max-w-3xl space-y-3" data-testid="cm-recurring">
        <h2 class="text-center text-xs font-bold uppercase tracking-widest text-slate-500">Assinaturas e recorrentes</h2>
        <p v-if="!overview.recurringActive.length" data-testid="cm-recurring-empty" class="glass-card p-5 text-center text-sm text-slate-400">Nenhuma assinatura ou gasto fixo encontrado nos seus extratos.</p>
        <ul class="space-y-2">
          <li v-for="r in overview.recurringActive" :key="r.key" data-testid="cm-recurring-item" class="glass-card flex items-center gap-2 p-3 sm:p-4">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-white">{{ r.name }}</p>
              <p class="mt-0.5 text-xs text-slate-400">
                <span data-testid="cm-monthly">{{ formatCurrency(r.monthlyCost) }}/mês</span> ·
                <span data-testid="cm-annual">{{ formatCurrency(r.annualCost) }}/ano</span> ·
                <span data-testid="cm-months">{{ r.months.length }} {{ r.months.length === 1 ? 'mês' : 'meses' }}</span>
              </p>
            </div>
            <button type="button" data-testid="cm-not-recurring" :aria-label="`Não é recorrente: ${r.name}`"
              class="min-h-[44px] shrink-0 rounded-xl px-3 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              @click="settings.ignoreRecurring(r.key)">Não é recorrente</button>
          </li>
        </ul>

        <div v-if="overview.recurringInactive.length">
          <button type="button" data-testid="cm-inactive-toggle" :aria-expanded="showInactive"
            class="flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
            @click="showInactive = !showInactive">
            <span>Parados ({{ overview.recurringInactive.length }})</span>
            <span aria-hidden="true">{{ showInactive ? '▲' : '▼' }}</span>
          </button>
          <ul v-if="showInactive" class="mt-1 space-y-2" data-testid="cm-inactive-list">
            <li v-for="r in overview.recurringInactive" :key="r.key" data-testid="cm-inactive-item" class="glass-card flex items-center gap-2 p-3 opacity-80">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-slate-200">{{ r.name }}</p>
                <p class="mt-0.5 text-xs text-slate-500">parou em {{ stoppedIn(r.lastDate) }} · era {{ formatCurrency(r.monthlyCost) }}/mês</p>
              </div>
              <button type="button" data-testid="cm-not-recurring" :aria-label="`Não é recorrente: ${r.name}`"
                class="min-h-[44px] shrink-0 rounded-xl px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
                @click="settings.ignoreRecurring(r.key)">Não é recorrente</button>
            </li>
          </ul>
        </div>
      </section>

      <!-- Parcelas em aberto -->
      <section class="mx-auto max-w-3xl space-y-3" data-testid="cm-installments">
        <h2 class="text-center text-xs font-bold uppercase tracking-widest text-slate-500">Parcelas em aberto</h2>
        <p v-if="!overview.installments.length" data-testid="cm-installments-empty" class="glass-card p-5 text-center text-sm text-slate-400">Nenhum parcelamento em aberto.</p>
        <ul class="space-y-2">
          <li v-for="p in overview.installments" :key="`${p.key}|${p.total}|${p.amount}`" data-testid="cm-installment-item" class="glass-card p-3 sm:p-4">
            <p class="truncate text-sm font-semibold text-white">{{ p.name }}</p>
            <p data-testid="cm-installment-text" class="mt-0.5 text-xs text-slate-300">
              {{ p.current }}/{{ p.total }} · {{ p.remaining === 1 ? 'falta 1' : `faltam ${p.remaining}` }} · {{ formatCurrency(p.remainingTotal) }} até {{ monthShortLabel(p.endMonth) }}
            </p>
            <p class="mt-0.5 text-[11px] text-slate-500">{{ formatCurrency(p.amount) }} por mês</p>
          </li>
        </ul>
      </section>

      <!-- Custos bancários -->
      <section class="mx-auto max-w-3xl space-y-3" data-testid="cm-bank">
        <h2 class="text-center text-xs font-bold uppercase tracking-widest text-slate-500">Custos bancários (12 meses)</h2>
        <ul class="glass-card divide-y divide-white/5 overflow-hidden">
          <li v-for="row in bankRows" :key="row.id">
            <button type="button" :data-testid="`cm-bank-${row.id}`" class="flex min-h-[48px] w-full items-center justify-between px-4 text-left text-sm transition-colors hover:bg-white/[0.06]"
              @click="openLancamentos(row.category)">
              <span class="text-slate-200">{{ row.label }}</span>
              <span class="font-mono font-semibold text-rose-300">{{ formatCurrency(row.value) }}</span>
            </button>
          </li>
          <li class="flex min-h-[48px] items-center justify-between px-4 text-sm" data-testid="cm-bank-total">
            <span class="font-semibold text-white">Total</span>
            <span class="font-mono font-bold text-white">{{ formatCurrency(overview.bank.total) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFinanceStore } from '@/stores/financeStore.js'
import { useSettingsStore } from '@/stores/settingsStore.js'
import CommitmentsChart from '@/components/dashboard/CommitmentsChart.vue'
import { commitmentsOverview } from '@/modules/commitments/index.js'
import { monthLabel, monthShortLabel } from '@/modules/kpis/pfKpis.js'
import { formatCurrency } from '@/utils/formatters.js'

const financeStore = useFinanceStore()
const settings = useSettingsStore()
const router = useRouter()

const overview = computed(() => commitmentsOverview(financeStore.entries, settings.ignoredRecurring))
const showInactive = ref(false)

const stoppedIn = (iso) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`

const bankRows = computed(() => [
  { id: 'iof', label: 'IOF', category: 'IOF', value: overview.value.bank.iof },
  { id: 'encargos', label: 'Encargos', category: 'Encargos', value: overview.value.bank.encargos },
  { id: 'tarifas', label: 'Tarifas bancárias', category: 'Tarifas bancárias', value: overview.value.bank.tarifas }
])

/** Abre os lançamentos da categoria (o filtro de categoria vale para todo o período). */
function openLancamentos(category) {
  financeStore.resetFilters()
  financeStore.filters.category = category
  router.push({ path: '/lancamentos' })
}
</script>
