<template>
  <div data-testid="cm-chart" class="relative h-64 md:h-72">
    <canvas ref="canvas" role="img" aria-label="Compromissos dos próximos 12 meses: parcelas e recorrentes"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import { monthAbbr } from '@/modules/kpis/pfKpis.js'

Chart.register(...registerables)

const props = defineProps({ schedule: { type: Array, required: true } }) // [{ month, installments, recurring, total }]

const canvas = ref(null)
let chart = null

const money = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function build() {
  if (chart) chart.destroy()
  chart = new Chart(canvas.value, {
    type: 'bar',
    data: {
      labels: props.schedule.map(s => monthAbbr(s.month)),
      datasets: [
        { label: 'Parcelas', data: props.schedule.map(s => s.installments), backgroundColor: '#f59e0b', borderRadius: 4, stack: 'c' },
        { label: 'Recorrentes', data: props.schedule.map(s => s.recurring), backgroundColor: '#38bdf8', borderRadius: 4, stack: 'c' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 10 } }, position: 'top' },
        datalabels: { display: false }, // o plugin é registrado globalmente pelos outros gráficos
        tooltip: {
          callbacks: {
            title: (items) => props.schedule[items[0].dataIndex].month,
            label: (item) => `${item.dataset.label}: ${money(item.raw)}`,
            footer: (items) => `Total: ${money(props.schedule[items[0].dataIndex].total)}`
          }
        }
      },
      scales: {
        x: { stacked: true, ticks: { color: '#64748b' }, grid: { display: false } },
        y: { stacked: true, ticks: { color: '#64748b', callback: (v) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v) }, grid: { color: '#ffffff08' } }
      }
    }
  })
}

onMounted(build)
watch(() => props.schedule, build, { deep: true })
onUnmounted(() => { chart?.destroy(); chart = null })
</script>
