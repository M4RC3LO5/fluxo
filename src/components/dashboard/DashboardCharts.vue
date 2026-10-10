<template>
  <div class="grid grid-cols-1 gap-8 lg:grid-cols-2 my-6">
    <div class="glass-card p-5 sm:p-6 flex flex-col">
      <h3 class="text-sm font-semibold text-white mb-4">📊 Comparativo Previsto vs Pago</h3>
      <div class="relative w-full h-[280px]">
        <canvas ref="barChartCanvas"></canvas>
      </div>
    </div>
    <div class="glass-card p-5 sm:p-6 flex flex-col">
      <h3 class="text-sm font-semibold text-white mb-4">👤 Distribuição por Responsável</h3>
      <div class="relative w-full h-[280px]">
        <canvas ref="pieChartCanvas"></canvas>
      </div>
    </div>
    <div class="glass-card p-5 sm:p-6 flex flex-col">
      <h3 class="text-sm font-semibold text-white mb-4">💳 Distribuição por Pagador</h3>
      <div class="relative w-full h-[280px]">
        <canvas ref="payerChartCanvas"></canvas>
      </div>
    </div>
    <div class="glass-card p-5 sm:p-6 flex flex-col">
      <h3 class="text-sm font-semibold text-white mb-4">📈 Evolução dos Vencimentos</h3>
      <div class="relative w-full h-[280px]">
        <canvas ref="timelineChartCanvas"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { useFinanceStore } from '@/stores/financeStore.js'

Chart.register(...registerables, ChartDataLabels)

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
