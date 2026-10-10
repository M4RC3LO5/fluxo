<template>
  <div class="space-y-10 pb-10 pt-14">
    <div class="text-center space-y-2">
      <h1 class="text-4xl font-extrabold text-white tracking-tight">Dashboard</h1>
      <p class="text-sm text-slate-400 max-w-2xl mx-auto">Visão estratégica e análise em tempo real do seu desempenho financeiro</p>
    </div>

    <!-- Primary KPIs -->
    <section>
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="kpi in kpis"
          :key="kpi.label"
          class="kpi-card cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all group p-4 sm:p-5 flex flex-col items-center text-center relative"
          :style="{ '--kpi-color': kpi.color }"
          @click="openDrillDown(kpi.type)"
          :title="kpi.tooltip"
        >
          <div class="relative mb-3">
            <span class="text-4xl transition-transform group-hover:scale-110 block">{{ kpi.icon }}</span>
          </div>
          <p class="text-2xl font-bold text-white tracking-tight">{{ kpi.value }}</p>
          <p class="mt-1 text-xs text-slate-400 font-semibold uppercase tracking-wider">{{ kpi.label }}</p>
          <span class="mt-3 text-[9px] text-slate-500 font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Ver Detalhes →</span>
        </div>
      </div>
    </section>

    <template v-if="financeStore.totalEntries > 0">
      <!-- Secondary KPIs -->
      <section>
        <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 text-center">Métricas de Performance</h2>
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="kpi in secondaryKpis"
            :key="kpi.label"
            class="glass-card cursor-pointer p-4 sm:p-5 flex flex-col items-center text-center hover:bg-white/[0.08] hover:scale-[1.02] active:scale-[0.98] transition-all group"
            @click="openDrillDown(kpi.type)"
          >
            <span class="text-2xl mb-3 block opacity-30 group-hover:opacity-100 transition-opacity">{{ kpi.icon }}</span>
            <p class="text-xl font-bold text-white tracking-tight">{{ kpi.value }}</p>
            <p class="mt-1 text-xs text-slate-400 font-medium uppercase tracking-tight">{{ kpi.label }}</p>
          </div>
        </div>
      </section>

      <!-- Smart Alerts -->
      <section v-if="smartAlerts.length > 0">
        <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 text-center">Alertas Inteligentes</h2>
        <div class="flex flex-wrap justify-center gap-4">
          <div
            v-for="alert in smartAlerts"
            :key="alert.id"
            @click="openDrillDown(alert.id)"
            class="glass-card cursor-pointer p-4 sm:p-5 flex items-center gap-4 hover:scale-[1.05] active:scale-[0.95] transition-all group border-l-4"
            :class="{
              'border-l-emerald-500': alert.severity === 'success',
              'border-l-amber-500': alert.severity === 'warning',
              'border-l-red-500': alert.severity === 'danger',
              'border-l-brand-500': alert.severity === 'info'
            }"
          >
            <span class="text-2xl group-hover:rotate-12 transition-transform">{{ alert.icon }}</span>
            <div class="text-left">
              <p class="text-lg font-bold text-white">{{ alert.count }}</p>
              <p class="text-[10px] text-slate-400 font-semibold uppercase tracking-tight">{{ alert.label }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Charts -->
      <section>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest flex-1 text-center ml-24">Análise de Tendências</h2>
          <button
            @click="financeStore.showDataLabels = !financeStore.showDataLabels"
            class="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-2 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
          >
            <span class="text-xs font-semibold text-slate-300 group-hover:text-white">Valores nos Gráficos</span>
            <div class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              :class="financeStore.showDataLabels ? 'bg-brand-500' : 'bg-slate-600'">
              <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm"
                :class="financeStore.showDataLabels ? 'translate-x-4' : 'translate-x-0.5'"></span>
            </div>
          </button>
        </div>
        <DashboardCharts />
      </section>

      <!-- Breakdowns -->
      <section>
        <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-8 text-center">Detalhamento e Rankings</h2>
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div class="glass-card p-5 sm:p-6">
            <h3 class="text-sm font-semibold text-white mb-6 flex items-center gap-2"><span>👤</span> Maiores Responsáveis</h3>
            <div class="space-y-4">
              <div v-for="item in topResponsibles" :key="item.name"
                class="flex items-center justify-between group cursor-pointer hover:bg-white/[0.04] p-2 rounded-xl transition-colors"
                @click="openDrillDown('responsible', item.name)">
                <div class="flex items-center gap-4 min-w-0">
                  <div class="h-10 w-10 shrink-0 rounded-xl bg-brand-600/10 border border-brand-500/10 flex items-center justify-center text-sm font-bold text-brand-400">
                    {{ item.name.charAt(0) }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-white truncate">{{ item.name }}</p>
                    <p class="text-xs text-slate-500">{{ item.count }} lançamento(s)</p>
                  </div>
                </div>
                <p class="text-sm font-mono font-bold text-emerald-400 whitespace-nowrap ml-4">{{ formatCurrency(item.forecast) }}</p>
              </div>
            </div>
          </div>

          <div class="glass-card p-5 sm:p-6">
            <h3 class="text-sm font-semibold text-white mb-6 flex items-center gap-2"><span>📅</span> Próximos Vencimentos</h3>
            <div class="space-y-3">
              <div v-for="entry in financeStore.upcomingDue.slice(0, 6)" :key="entry.id"
                @click="openDrillDown('search', entry.description)"
                class="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3 hover:bg-white/[0.04] cursor-pointer transition-colors">
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-white truncate">{{ entry.description || '—' }}</p>
                  <p class="text-[10px] text-slate-500 mt-1">{{ formatDate(entry.dueDate) }} · {{ entry.responsible }}</p>
                </div>
                <p class="text-xs font-mono font-bold text-amber-400 whitespace-nowrap ml-4">{{ formatCurrency(entry.forecast) }}</p>
              </div>
            </div>
          </div>

          <div class="glass-card p-5 sm:p-6">
            <h3 class="text-sm font-semibold text-white mb-6 flex items-center gap-2"><span>💳</span> Maiores Pagadores</h3>
            <div class="space-y-4">
              <div v-for="item in topPayers" :key="item.name"
                class="flex items-center justify-between group cursor-pointer hover:bg-white/[0.04] p-2 rounded-xl transition-colors"
                @click="openDrillDown('payer', item.name)">
                <div class="flex items-center gap-4 min-w-0">
                  <div class="h-10 w-10 shrink-0 rounded-xl bg-emerald-600/10 border border-emerald-500/10 flex items-center justify-center text-sm font-bold text-emerald-400">
                    {{ item.name.charAt(0) }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-white truncate">{{ item.name }}</p>
                    <p class="text-xs text-slate-500">{{ item.count }} pagamento(s)</p>
                  </div>
                </div>
                <p class="text-sm font-mono font-bold text-emerald-400 whitespace-nowrap ml-4">{{ formatCurrency(item.total) }}</p>
              </div>
            </div>
          </div>

          <div class="glass-card p-5 sm:p-6">
            <h3 class="text-sm font-semibold text-white mb-6 flex items-center gap-2"><span>🏢</span> Centros Financeiros</h3>
            <div class="space-y-3">
              <div v-for="center in financeStore.totalByCenter.slice(0, 6)" :key="center.name"
                @click="openDrillDown('center', center.name)"
                class="flex items-center justify-between border-b border-white/[0.03] pb-3 last:border-0 cursor-pointer hover:bg-white/[0.02] px-2 py-2 rounded-xl transition-colors">
                <p class="text-sm font-medium text-white min-w-0 truncate mr-4">{{ center.name }}</p>
                <div class="flex items-center gap-4 text-xs shrink-0">
                  <div class="text-right">
                    <p class="text-[10px] text-slate-500 uppercase font-bold">Previsto</p>
                    <p class="text-white font-mono">{{ formatCurrency(center.forecast) }}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-[10px] text-slate-500 uppercase font-bold">Pago</p>
                    <p class="text-emerald-400 font-mono">{{ formatCurrency(center.paid) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <div v-else class="glass-card flex flex-col items-center justify-center py-20 text-center">
      <span class="text-6xl mb-4">📊</span>
      <h3 class="text-xl font-semibold text-white mb-2">Nenhum dado importado ainda</h3>
      <p class="text-sm text-slate-400 max-w-md mb-6">Importe uma planilha Excel (.xlsx) para visualizar seus dados financeiros.</p>
      <router-link to="/importacoes"
        class="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-500">
        📥 Importar Planilha
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFinanceStore } from '@/stores/financeStore.js'
import DashboardCharts from '@/components/dashboard/DashboardCharts.vue'
import { formatCurrency, formatDate } from '@/utils/formatters.js'
import { getSmartAlerts } from '@/modules/kpis/smartKpis.js'

const financeStore = useFinanceStore()
const router = useRouter()

function openDrillDown(type, value = null) {
  financeStore.filters = { status: 'all', alert: '', search: '', responsible: '', center: '' }
  if (['paid', 'pending', 'overdue'].includes(type)) financeStore.filters.status = type
  else if (type === 'responsible') financeStore.filters.responsible = value
  else if (type === 'payer' || type === 'search') financeStore.filters.search = value
  else if (type === 'center') financeStore.filters.center = value
  router.push({ path: '/lancamentos' })
}

const kpis = computed(() => [
  { type: 'forecast', icon: '💰', label: 'Total Previsto',   tooltip: 'Soma de todos os lançamentos.', value: formatCurrency(financeStore.totalForecast), color: '#3b82f6' },
  { type: 'paid',     icon: '✅', label: 'Total Pago',       tooltip: 'Lançamentos pagos.',            value: formatCurrency(financeStore.totalPaid),     color: '#10b981' },
  { type: 'pending',  icon: '⏳', label: 'Total Pendente',   tooltip: 'Não pagos, vencimento futuro.', value: formatCurrency(financeStore.totalPending),  color: '#f59e0b' },
  { type: 'overdue',  icon: '🚨', label: 'Vencido Não Pago', tooltip: 'Não pagos, já vencidos.',       value: formatCurrency(financeStore.overdueUnpaid), color: '#ef4444' },
])

const secondaryKpis = computed(() => [
  { type: 'all',     icon: '📋', label: 'Total de Lançamentos',     value: financeStore.totalEntries },
  { type: 'paid',    icon: '✔️', label: 'Pagos',                    value: financeStore.paidCount },
  { type: 'pending', icon: '⏱️', label: 'Pendentes',                value: financeStore.pendingCount },
  { type: 'all',     icon: '📊', label: 'Diferença Prev. vs Pago', value: formatCurrency(financeStore.forecastVsPaidDiff) },
])

const smartAlerts  = computed(() => getSmartAlerts(financeStore.entries))
const topResponsibles = computed(() => financeStore.totalByResponsible.slice(0, 5))
const topPayers       = computed(() => financeStore.totalByPayer.slice(0, 5))
</script>
