<template>
  <div class="space-y-8 pb-10 pt-14">

    <!-- Header -->
    <div class="text-center space-y-2">
      <h1 class="text-4xl font-extrabold text-white tracking-tight">Importações</h1>
      <p class="text-sm text-slate-400 max-w-2xl mx-auto">Importe planilhas Excel ou extratos bancários para análise financeira</p>
    </div>

    <!-- Import Cards -->
    <section>
      <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 text-center">Escolha a fonte de importação</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label
          v-for="source in importSources"
          :key="source.id"
          class="glass-card cursor-pointer p-5 flex flex-col items-center text-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all group border-2"
          :class="selectedSource === source.id ? 'border-brand-500/60' : 'border-transparent'"
          @click="selectSource(source.id)"
        >
          <span class="text-4xl group-hover:scale-110 transition-transform">{{ source.icon }}</span>
          <div>
            <p class="text-sm font-bold text-white">{{ source.name }}</p>
            <p class="text-[11px] text-slate-500 mt-1">{{ source.description }}</p>
          </div>
          <span
            class="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            :class="source.badge === 'CSV' ? 'bg-emerald-500/10 text-emerald-400' :
                    source.badge === 'XLSX' ? 'bg-brand-500/10 text-brand-400' :
                    'bg-amber-500/10 text-amber-400'"
          >{{ source.badge }}</span>
        </label>
      </div>
    </section>

    <!-- Drop Zone -->
    <section v-if="selectedSource">
      <div
        class="glass-card p-10 flex flex-col items-center justify-center gap-4 border-2 border-dashed transition-all cursor-pointer"
        :class="isDragging ? 'border-brand-400 bg-brand-500/5' : 'border-white/10 hover:border-white/20'"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <input ref="fileInputRef" type="file" class="hidden" :accept="acceptedExtensions" @change="handleFileChange" />

        <div v-if="!selectedFile">
          <div class="text-5xl mb-2 text-center">{{ isDragging ? '📂' : '📁' }}</div>
          <p class="text-white font-semibold text-center">Arraste o arquivo aqui</p>
          <p class="text-slate-500 text-xs text-center mt-1">ou clique para selecionar · {{ acceptedLabel }}</p>
        </div>

        <div v-else class="flex items-center gap-4 w-full max-w-md">
          <span class="text-3xl">{{ fileIcon }}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-white truncate">{{ selectedFile.name }}</p>
            <p class="text-xs text-slate-500">{{ formatFileSize(selectedFile.size) }}</p>
          </div>
          <button @click.stop="clearFile" class="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-white/5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </section>

    <!-- Import Options -->
    <section v-if="selectedFile" class="glass-card p-6 space-y-5">
      <h3 class="text-sm font-semibold text-white">⚙️ Opções de importação</h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 block">Nome da versão</label>
          <input
            v-model="importOptions.versionName"
            type="text"
            placeholder="Ex: Outubro 2026"
            class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50 focus:bg-white/[0.08] transition-all"
          />
        </div>
        <div>
          <label class="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 block">Descrição (opcional)</label>
          <input
            v-model="importOptions.description"
            type="text"
            placeholder="Ex: Fluxo de caixa mensal"
            class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50 focus:bg-white/[0.08] transition-all"
          />
        </div>
      </div>

      <!-- XLSX-specific: column mapping hint -->
      <div v-if="selectedSource === 'xlsx'" class="rounded-xl bg-brand-500/5 border border-brand-500/10 p-4">
        <p class="text-xs text-brand-300 font-semibold mb-1">📋 Mapeamento de colunas esperado</p>
        <p class="text-[11px] text-slate-400 leading-relaxed">
          Descrição · Responsável · Centro · Valor Total · Data Vencimento · Status (pago/pendente) · Pagador
        </p>
      </div>

      <div v-if="selectedSource !== 'xlsx'" class="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4">
        <p class="text-xs text-amber-300 font-semibold mb-1">⚠️ Em desenvolvimento</p>
        <p class="text-[11px] text-slate-400">Parser para {{ currentSource?.name }} será disponibilizado em breve.</p>
      </div>

      <!-- Action -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <button @click="clearFile" class="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all">
          Cancelar
        </button>
        <button
          @click="runImport"
          :disabled="isImporting || selectedSource !== 'xlsx'"
          class="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
          :class="isImporting || selectedSource !== 'xlsx'
            ? 'bg-white/5 text-slate-500 cursor-not-allowed'
            : 'bg-brand-600 text-white hover:bg-brand-500 hover:shadow-lg hover:shadow-brand-600/25'"
        >
          <svg v-if="isImporting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          <span>{{ isImporting ? 'Importando...' : '📥 Importar' }}</span>
        </button>
      </div>
    </section>

    <!-- Result feedback -->
    <transition name="fade">
      <div v-if="importResult" class="glass-card p-5 flex items-start gap-4 border-l-4"
        :class="importResult.success ? 'border-l-emerald-500' : 'border-l-red-500'">
        <span class="text-2xl mt-0.5">{{ importResult.success ? '✅' : '❌' }}</span>
        <div>
          <p class="text-sm font-bold text-white">{{ importResult.title }}</p>
          <p class="text-xs text-slate-400 mt-1">{{ importResult.message }}</p>
        </div>
      </div>
    </transition>

    <!-- Import History -->
    <section v-if="importStore.history.length > 0">
      <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 text-center">Histórico de Importações</h2>
      <div class="space-y-3">
        <div
          v-for="record in importStore.history"
          :key="record.id"
          class="glass-card p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors"
        >
          <div class="flex items-center gap-4 min-w-0">
            <span class="text-2xl shrink-0">{{ getSourceIcon(record.source) }}</span>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-white truncate">{{ record.versionName || record.fileName }}</p>
              <p class="text-[11px] text-slate-500 mt-0.5">
                {{ record.source?.toUpperCase() }} · {{ record.count }} registros · {{ formatImportDate(record.importedAt) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              @click="activateVersion(record)"
              class="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
              :class="importStore.activeVersion?.id === record.id
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'"
            >
              {{ importStore.activeVersion?.id === record.id ? '✓ Ativa' : 'Ativar' }}
            </button>
            <button @click="removeRecord(record.id)" class="p-1.5 text-slate-600 hover:text-red-400 rounded-lg hover:bg-white/5 transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useFinanceStore } from '@/stores/financeStore.js'
import { useImportStore } from '@/stores/importStore.js'
import { parseXlsx } from '@/modules/importers/xlsxImporter.js'

const financeStore = useFinanceStore()
const importStore  = useImportStore()

// ─── Sources ────────────────────────────────────────────────────────────
const importSources = [
  { id: 'xlsx',        icon: '📊', name: 'Planilha Excel',   description: 'Arquivo .xlsx com lançamentos estruturados', badge: 'XLSX' },
  { id: 'nubank',      icon: '💜', name: 'Nubank',           description: 'Extrato CSV exportado do app Nubank',        badge: 'CSV'  },
  { id: 'mercadopago', icon: '💙', name: 'Mercado Pago',     description: 'Extrato CSV do Mercado Pago',                badge: 'CSV'  },
  { id: 'santander',   icon: '🔴', name: 'Santander',        description: 'Extrato PDF — processamento via IA',         badge: 'PDF'  },
]

const selectedSource = ref(null)
const currentSource  = computed(() => importSources.find(s => s.id === selectedSource.value))

const acceptedExtensions = computed(() => {
  if (selectedSource.value === 'xlsx') return '.xlsx'
  if (selectedSource.value === 'santander') return '.pdf'
  return '.csv'
})

const acceptedLabel = computed(() => {
  if (selectedSource.value === 'xlsx') return 'XLSX até 10 MB'
  if (selectedSource.value === 'santander') return 'PDF até 5 MB'
  return 'CSV até 5 MB'
})

const fileIcon = computed(() => {
  if (selectedSource.value === 'xlsx') return '📊'
  if (selectedSource.value === 'santander') return '📄'
  return '📃'
})

// ─── File handling ───────────────────────────────────────────────────────
const fileInputRef = ref(null)
const selectedFile = ref(null)
const isDragging   = ref(false)

function selectSource(id) {
  selectedSource.value = id
  clearFile()
  importResult.value = null
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileChange(e) {
  const file = e.target.files?.[0]
  if (file) selectedFile.value = file
}

function handleDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) selectedFile.value = file
}

function clearFile() {
  selectedFile.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

// ─── Options ─────────────────────────────────────────────────────────────
const importOptions = ref({ versionName: '', description: '' })

// ─── Import ──────────────────────────────────────────────────────────────
const isImporting  = ref(false)
const importResult = ref(null)

async function runImport() {
  if (!selectedFile.value || selectedSource.value !== 'xlsx') return
  isImporting.value  = true
  importResult.value = null

  try {
    const entries = await parseXlsx(selectedFile.value)

    financeStore.setEntries(entries)
    importStore.addImport({
      source:      'xlsx',
      fileName:    selectedFile.value.name,
      versionName: importOptions.value.versionName || selectedFile.value.name.replace('.xlsx', ''),
      description: importOptions.value.description,
      count:       entries.length,
    })

    importResult.value = {
      success: true,
      title:   `${entries.length} registros importados com sucesso`,
      message: `Versão "${importOptions.value.versionName || selectedFile.value.name}" ativada.`,
    }

    clearFile()
    importOptions.value = { versionName: '', description: '' }

  } catch (err) {
    importResult.value = {
      success: false,
      title:   'Erro na importação',
      message: err.message || 'Verifique se o arquivo está no formato correto.',
    }
  } finally {
    isImporting.value = false
  }
}

// ─── History ─────────────────────────────────────────────────────────────
function getSourceIcon(source) {
  return importSources.find(s => s.id === source)?.icon || '📁'
}

function formatImportDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function activateVersion(record) {
  importStore.activeVersion = record
}

function removeRecord(id) {
  importStore.removeImport(id)
  if (financeStore.entries.length > 0 && !importStore.activeVersion) {
    financeStore.clearEntries()
  }
}
</script>
