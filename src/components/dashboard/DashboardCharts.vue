<template>
  <div class="my-4 md:my-6">
  <div
    class="relative touch-pan-y"
    data-testid="chart-swipe-area"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="swipeStart = null"
  >
    <!-- celular: botão de olho (mostrar/ocultar valores) no canto superior direito do gráfico -->
    <button
      type="button"
      data-testid="chart-values-toggle"
      :aria-pressed="financeStore.showDataLabels"
      :aria-label="financeStore.showDataLabels ? 'Ocultar valores' : 'Mostrar valores'"
      @click="financeStore.showDataLabels = !financeStore.showDataLabels"
      class="absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-center rounded-xl transition-colors md:hidden"
      :class="financeStore.showDataLabels ? 'bg-brand-500/20 text-brand-400' : 'text-slate-400 active:bg-white/10'"
    >
      <svg v-if="financeStore.showDataLabels" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
      <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.9 17.9A10.4 10.4 0 0112 19C5.6 19 2 12 2 12a18 18 0 014.1-5M9.9 5.2A9.7 9.7 0 0112 5c6.4 0 10 7 10 7a18 18 0 01-2.2 3.2M3 3l18 18"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>
    </button>
    <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
    <div class="glass-card p-5 max-md:pt-12 sm:p-6 flex-col" :class="tab === 'bar' ? 'flex' : 'max-md:hidden md:flex'">
      <h3 class="max-md:hidden text-sm font-semibold text-white mb-4">📊 Comparativo Previsto vs Pago</h3>
      <div class="relative w-full h-[240px] md:h-[280px]">
        <canvas ref="barChartCanvas" data-testid="chart-bar"></canvas>
      </div>
    </div>
    <div class="glass-card p-5 max-md:pt-12 sm:p-6 flex-col" :class="tab === 'doughnut' ? 'flex' : 'max-md:hidden md:flex'">
      <h3 class="max-md:hidden text-sm font-semibold text-white mb-4">👤 Distribuição por Responsável</h3>
      <div class="relative w-full h-[240px] md:h-[280px]">
        <canvas ref="pieChartCanvas" data-testid="chart-doughnut"></canvas>
      </div>
    </div>
    <div class="glass-card p-5 max-md:pt-12 sm:p-6 flex-col" :class="tab === 'payer' ? 'flex' : 'max-md:hidden md:flex'">
      <h3 class="max-md:hidden text-sm font-semibold text-white mb-4">💳 Distribuição por Pagador</h3>
      <div class="relative w-full h-[240px] md:h-[280px]">
        <canvas ref="payerChartCanvas" data-testid="chart-payer"></canvas>
      </div>
    </div>
    <div class="glass-card p-5 max-md:pt-12 sm:p-6 flex-col" :class="tab === 'line' ? 'flex' : 'max-md:hidden md:flex'">
      <h3 class="max-md:hidden text-sm font-semibold text-white mb-4">📈 Evolução dos Vencimentos</h3>
      <div class="relative w-full h-[240px] md:h-[280px]">
        <canvas ref="timelineChartCanvas" data-testid="chart-line"></canvas>
      </div>
    </div>
      </div>
  </div>
  <!-- indicador de página (celular) -->
  <div data-testid="chart-dots" class="mt-3 flex justify-center gap-2 md:hidden" aria-hidden="true">
    <span
      v-for="(id, i) in TAB_ORDER"
      :key="id"
      class="h-2 rounded-full transition-all duration-200"
      :class="tab === id ? 'w-5 bg-brand-500' : 'w-2 bg-white/20'"
      :data-active="tab === id"
    ></span>
  </div>
</div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { useFinanceStore } from '@/stores/financeStore.js'

Chart.register(...registerables, ChartDataLabels)

const props = defineProps({
  // visão ativa no celular (< md): só o gráfico da visão é exibido; no desktop os 4 aparecem
  tab: { type: String, default: 'bar' }
})
const emit = defineEmits(['update:tab'])

// ─── Swipe horizontal (celular): anterior/próximo ────────────────────────
// touch-action: pan-y deixa a rolagem vertical com o navegador; só gestos horizontais chegam aqui.
const TAB_ORDER = ['bar', 'doughnut', 'payer', 'line']
const SWIPE_MIN = 50
let swipeStart = null
const isDesktopView = () => window.matchMedia('(min-width: 768px)').matches

function onPointerDown(e) {
  if (isDesktopView() || e.target.closest('button')) return
  swipeStart = { x: e.clientX, y: e.clientY }
}
function onPointerUp(e) {
  if (!swipeStart) return
  const dx = e.clientX - swipeStart.x
  const dy = e.clientY - swipeStart.y
  swipeStart = null
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return // curto demais ou mais vertical que horizontal
  const i = TAB_ORDER.indexOf(props.tab) + (dx < 0 ? 1 : -1)
  if (i >= 0 && i < TAB_ORDER.length) emit('update:tab', TAB_ORDER[i])
}

const financeStore = useFinanceStore()
const barChartCanvas = ref(null)
const pieChartCanvas = ref(null)
const payerChartCanvas = ref(null)
const timelineChartCanvas = ref(null)
let barChart = null, pieChart = null, payerChart = null, timelineChart = null

const chartColors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316']

const datalabelsConfig = {
  display: (ctx) => financeStore.showDataLabels && ctx.dataset.data[ctx.dataIndex] > 0,
  color: '#ffffff',
  font: { size: 10, weight: 'bold' },
  formatter: (v) => new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(v)
}

function createCharts() {
  if (barChart) barChart.destroy()
  if (pieChart) pieChart.destroy()
  if (payerChart) payerChart.destroy()
  if (timelineChart) timelineChart.destroy()
  if (!barChartCanvas.value) return

  const topResp = financeStore.totalByResponsible.slice(0, 5)

  barChart = new Chart(barChartCanvas.value, {
    type: 'bar',
    data: {
      labels: topResp.map(r => r.name),
      datasets: [
        { label: 'Previsto', data: topResp.map(r => r.forecast), backgroundColor: '#3b82f680', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 6 },
        { label: 'Pago',     data: topResp.map(r => r.paid),    backgroundColor: '#10b98180', borderColor: '#10b981', borderWidth: 1, borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 10 } }, position: 'top' },
        datalabels: datalabelsConfig
      },
      scales: {
        y: { ticks: { color: '#64748b' }, grid: { color: '#ffffff08' } },
        x: { ticks: { color: '#64748b' }, grid: { display: false } }
      }
    }
  })

  pieChart = new Chart(pieChartCanvas.value, {
    type: 'doughnut',
    data: {
      labels: topResp.map(r => r.name),
      datasets: [{ data: topResp.map(r => r.forecast), backgroundColor: chartColors, borderColor: '#0f172a', borderWidth: 2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10, padding: 12 } },
        datalabels: { ...datalabelsConfig, formatter: v => v }
      }
    }
  })

  const topPayers = financeStore.totalByPayer.slice(0, 5)
  payerChart = new Chart(payerChartCanvas.value, {
    type: 'bar',
    data: {
      labels: topPayers.map(p => p.name),
      datasets: [{ label: 'Total Pago', data: topPayers.map(p => p.total), backgroundColor: '#10b98140', borderColor: '#10b981', borderWidth: 1, borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, datalabels: { ...datalabelsConfig, align: 'right', anchor: 'end' } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: '#ffffff08' } },
        y: { ticks: { color: '#64748b' }, grid: { display: false } }
      }
    }
  })

  const monthly = getMonthlyTrend()
  timelineChart = new Chart(timelineChartCanvas.value, {
    type: 'line',
    data: {
      labels: monthly.labels,
      datasets: [{ label: 'Valor Total', data: monthly.values, borderColor: '#3b82f6', backgroundColor: '#3b82f610', fill: true, tension: 0.4, pointBackgroundColor: '#3b82f6', pointRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, datalabels: { ...datalabelsConfig, align: 'top', anchor: 'end' } },
      scales: {
        y: { ticks: { color: '#64748b' }, grid: { color: '#ffffff08' } },
        x: { ticks: { color: '#64748b' }, grid: { display: false } }
      }
    }
  })
}

function getMonthlyTrend() {
  const map = {}
  financeStore.entries.forEach(e => {
    if (!e.dueDate) return
    const key = e.dueDate.slice(0, 7)
    map[key] = (map[key] || 0) + (e.forecast || 0)
  })
  const keys = Object.keys(map).sort()
  return {
    labels: keys.map(k => { const [y, m] = k.split('-'); return `${m}/${y.slice(2)}` }),
    values: keys.map(k => map[k])
  }
}

async function refreshCharts() {
  if (financeStore.totalEntries === 0) return
  await nextTick()
  createCharts()
}

onMounted(refreshCharts)
watch(() => financeStore.entries, refreshCharts)
// gráficos em contêiner oculto (display:none) ficam com tamanho 0; ao exibir a aba, recalcula o tamanho
watch(() => props.tab, async () => {
  await nextTick()
  ;[barChart, pieChart, payerChart, timelineChart].forEach(ch => ch?.resize())
})
watch(() => financeStore.showDataLabels, () => {
  if (barChart) barChart.update()
  if (pieChart) pieChart.update()
  if (payerChart) payerChart.update()
  if (timelineChart) timelineChart.update()
})
onUnmounted(() => {
  if (barChart) barChart.destroy()
  if (pieChart) pieChart.destroy()
  if (payerChart) payerChart.destroy()
  if (timelineChart) timelineChart.destroy()
})
</script>
