<template>
  <div role="tablist" aria-label="Visão do dashboard" data-testid="view-toggle" class="mx-auto grid w-full max-w-sm grid-cols-2 rounded-2xl bg-white/5 p-1">
    <button
      v-for="v in views"
      :key="v.id"
      type="button"
      role="tab"
      :data-testid="`view-toggle-${v.id}`"
      :aria-selected="modelValue === v.id"
      class="min-h-[44px] rounded-xl px-3 text-sm font-medium transition-colors"
      :class="modelValue === v.id ? 'bg-brand-600/40 text-white ring-1 ring-brand-500/60' : 'text-slate-400 hover:text-white'"
      @click="$emit('update:modelValue', v.id)"
    >{{ v.label }}</button>
  </div>
</template>

<script setup>
defineProps({ modelValue: { type: String, required: true } })
defineEmits(['update:modelValue'])

const views = [
  { id: 'personal', label: 'Pessoal' },
  { id: 'bills', label: 'Contas a pagar' }
]
</script>
