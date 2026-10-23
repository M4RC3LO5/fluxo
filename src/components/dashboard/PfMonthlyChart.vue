<template>
  <div data-testid="pf-chart" class="relative h-64 md:h-72" :data-bars="barsJson">
    <canvas ref="canvas" role="img" aria-label="Entradas e saídas dos últimos 12 meses"></canvas>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import { monthAbbr } from '@/modules/kpis/pfKpis.js'

Chart.register(...registerables)

const props = defineProps({
  series: { type: Array, required: true }, // [{ month, entradas, saidas }]
  selected: { type: String, default: '' }
})
const emit = defineEmits(['select'])

const canvas = ref(null)
const bars = ref([]) // posição (px, relativa ao canvas) de cada mês: ajuda os testes e o toque
const barsJson = computed(() => JSON.stringify(bars.value))
let chart = null

const IN = '#10b981'
const OUT = '#ef4444'

function colorFor(base) {
  // o mês selecionado fica cheio; os demais, esmaecidos
  return (ctx) => (props.series[ctx.dataIndex]?.month === props.selected ? base : `${base}66`)
}

function readBars() {
  if (!chart) return
  const meta = chart.getDatasetMeta(0)
  bars.value = props.series.map((s, i) => ({ month: s.month, x: Math.round(meta.data[i]?.x ?? 0), y: Math.round(chart.chartArea.bottom - 10) }))
}

function build() {
  if (chart) chart.destroy()
  chart = new Chart(canvas.value, {
    type: 'bar',
    data: {
      labels: props.series.map(s => monthAbbr(s.month)),
      datasets: [
        { label: 'Entradas', data: props.series.map(s => s.entradas), backgroundColor: colorFor(IN), borderColor: IN, borderWidth: 1, borderRadius: 4 },
        { label: 'Saídas', data: props.series.map(s => s.saidas), backgroundColor: colorFor(OUT), borderColor: OUT, borderWidth: 1, borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0, onComplete: readBars },
      interaction: { mode: 'index', intersect: false },
      onClick: (evt, _els, c) => {
        const hit = c.getElementsAtEventForMode(evt, 'index', { intersect: false }, true)[0]
        if (hit) emit('select', props.series[hit.index].month)
      },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 10 } }, position: 'top' },
        datalabels: { display: false }, // o plugin é registrado globalmente pelos outros gráficos
        tooltip: {
          callbacks: {
            title: (items) => props.series[items[0].dataIndex].month,
            label: (item) => `${item.dataset.label}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.raw)}`
          }
        }
      },
      scales: {
        y: { ticks: { color: '#64748b', callback: (v) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v) }, grid: { color: '#ffffff08' } },
        x: { ticks: { color: '#64748b' }, grid: { display: false } }
      }
    }
  })
  readBars()
}

onMounted(build)
watch(() => props.series, build, { deep: true })
watch(() => props.selected, () => { chart?.update(); readBars() })
onUnmounted(() => { chart?.destroy(); chart = null })
</script>
