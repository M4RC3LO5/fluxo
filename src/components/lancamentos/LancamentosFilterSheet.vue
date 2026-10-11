<template>
  <BottomSheet :open="open" title="Filtros" @close="$emit('update:open', false)">
    <div class="space-y-4">
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Responsável</span>
        <select data-testid="sheet-responsible" v-model="draft.responsible" :class="selectClass">
          <option value="">Todos os responsáveis</option>
          <option v-for="r in responsaveis" :key="r" :value="r">{{ r }}</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Centro de custo</span>
        <select data-testid="sheet-center" v-model="draft.center" :class="selectClass">
          <option value="">Todos os centros</option>
          <option v-for="c in centros" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Ordenação</span>
        <select data-testid="sheet-sort" v-model="draft.sort" :class="selectClass">
          <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <div class="flex gap-3 pt-2">
        <button
          type="button"
          data-testid="sheet-clear"
          class="min-h-[44px] flex-1 rounded-xl border border-white/10 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
          @click="clear"
        >Limpar</button>
        <button
          type="button"
          data-testid="sheet-apply"
          class="min-h-[44px] flex-1 rounded-xl bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          @click="apply"
        >Aplicar</button>
      </div>
    </div>
  </BottomSheet>
</template>

<script setup>
import { reactive, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  responsaveis: { type: Array, default: () => [] },
  centros: { type: Array, default: () => [] },
  responsible: { type: String, default: '' },
  center: { type: String, default: '' },
  sort: { type: String, default: 'dueDate:asc' }
})
const emit = defineEmits(['update:open', 'apply'])

const SORT_OPTIONS = [
  { value: 'dueDate:asc', label: 'Vencimento ↑' },
  { value: 'dueDate:desc', label: 'Vencimento ↓' },
  { value: 'forecast:desc', label: 'Maior valor' },
  { value: 'forecast:asc', label: 'Menor valor' }
]
const selectClass = 'min-h-[44px] w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none [&>option]:bg-slate-800'

// rascunho: só vale ao tocar em "Aplicar"
const draft = reactive({ responsible: '', center: '', sort: 'dueDate:asc' })
watch(() => props.open, (isOpen) => {
  if (isOpen) Object.assign(draft, { responsible: props.responsible, center: props.center, sort: props.sort })
}, { immediate: true })

function clear() {
  Object.assign(draft, { responsible: '', center: '', sort: 'dueDate:asc' })
}
function apply() {
  emit('apply', { ...draft })
  emit('update:open', false)
}
</script>
