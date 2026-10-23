<template>
  <!-- Pessoal (padrão) | Contas a pagar. Sem lançamentos: o estado vazio de sempre (da visão Contas a pagar) -->
  <DashboardBills v-if="view === 'bills'">
    <DashboardViewToggle v-if="showToggle" v-model="financeStore.dashboardView" class="order-0" />
  </DashboardBills>
  <DashboardPersonal v-else>
    <DashboardViewToggle v-if="showToggle" v-model="financeStore.dashboardView" class="order-0" />
  </DashboardPersonal>
</template>

<script setup>
import { computed } from 'vue'
import { useFinanceStore } from '@/stores/financeStore.js'
import DashboardBills from '@/views/DashboardBills.vue'
import DashboardPersonal from '@/views/DashboardPersonal.vue'
import DashboardViewToggle from '@/components/dashboard/DashboardViewToggle.vue'

const financeStore = useFinanceStore()

// o controle só existe se houver lançamentos de planilha (contas a pagar); sem planilha, só a visão Pessoal
const hasSpreadsheet = computed(() => financeStore.entries.some(e => e.source === 'xlsx'))
const showToggle = computed(() => hasSpreadsheet.value)

const view = computed(() => {
  if (financeStore.totalEntries === 0) return 'bills' // estado vazio igual ao atual
  if (!hasSpreadsheet.value) return 'personal'
  return financeStore.dashboardView
})
</script>
