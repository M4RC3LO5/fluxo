<template>
  <div class="space-y-8 pb-10 pt-14">

    <!-- Header -->
    <div class="text-center space-y-2">
      <h1 class="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Importações</h1>
      <p class="text-sm text-slate-400 max-w-2xl mx-auto">Importe planilhas Excel ou extratos bancários para análise financeira</p>
    </div>

    <!-- Fontes: cada card é a própria área de upload -->
    <section>
      <h2 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 text-center">Escolha a fonte e envie o arquivo</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="source in importSources"
          :key="source.id"
          :data-testid="`source-card-${source.id}`"
          :aria-disabled="!source.available"
          :aria-busy="importingId === source.id"
          :role="source.available ? 'button' : undefined"
          :tabindex="source.available ? 0 : undefined"
          class="glass-card relative flex min-h-[44px] flex-col items-center gap-3 border-2 border-dashed p-5 text-center transition-all"
          :class="[
            !source.available ? 'cursor-not-allowed opacity-50 border-transparent' :
            importingId ? 'pointer-events-none opacity-60 border-white/10' :
            dragOverId === source.id ? 'cursor-pointer border-brand-400 bg-brand-500/10 scale-[1.02]' :
            'cursor-pointer border-white/10 hover:border-white/25 active:scale-[0.98]'
          ]"
          @click="openPicker(source)"
          @keydown.enter.prevent="openPicker(source)"
          @keydown.space.prevent="openPicker(source)"
          @dragenter.prevent
          @dragover.prevent="onCardDragOver(source)"
          @dragleave="onCardDragLeave($event, source)"
          @drop.prevent.stop="onCardDrop($event, source)"
        >
          <input
            :ref="el => { if (el) inputRefs[source.id] = el }"
            :data-testid="`source-input-${source.id}`"
            type="file"
            class="hidden"
            :accept="source.ext"
            :disabled="!source.available"
            @click.stop
            @change="onInputChange($event, source)"
          />
          <span class="text-4xl">{{ source.icon }}</span>
          <div>
            <p class="text-sm font-bold text-white">{{ source.name }}</p>
            <p class="mt-1 text-[11px] text-slate-500">{{ source.description }}</p>
          </div>

          <span
            v-if="!source.available"
            class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-400"
          >Em breve</span>
          <template v-else-if="importingId === source.id">
            <span class="flex items-center gap-2 text-xs font-semibold text-brand-300">
              <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Importando...
            </span>
          </template>
          <template v-else>
            <span
              class="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
              :class="source.badge === 'CSV' ? 'bg-emerald-500/10 text-emerald-400' :
                      source.badge === 'XLSX' ? 'bg-brand-500/10 text-brand-400' :
                      'bg-amber-500/10 text-amber-400'"
            >{{ source.badge }}</span>
            <p class="text-xs font-medium text-slate-300 md:hidden">Toque para escolher o arquivo</p>
            <p class="hidden text-xs font-medium text-slate-300 md:block">Clique ou arraste o arquivo aqui</p>
          </template>
        </div>
      </div>
    </section>

    <!-- Erro -->
    <transition name="fade">
      <div v-if="importError" data-testid="import-error" role="alert"
        class="glass-card flex items-start gap-4 border-l-4 border-l-red-500 p-5">
        <span class="mt-0.5 text-2xl">❌</span>
        <p class="min-w-0 break-words text-sm font-medium text-white">{{ importError }}</p>
      </div>
    </transition>

    <!-- Resultado -->
    <transition name="fade">
      <div v-if="importResult" data-testid="import-result"
        class="glass-card space-y-4 border-l-4 border-l-emerald-500 p-5">
        <div class="flex items-start gap-4">
          <span class="mt-0.5 text-2xl">✅</span>
          <div class="min-w-0">
            <p class="text-sm font-bold text-white">{{ importResult.count }} registros importados com sucesso</p>
            <p class="mt-1 break-words text-xs text-slate-400">Versão: <span class="font-semibold text-slate-200">{{ importResult.versionName }}</span></p>
          </div>
        </div>
        <ul v-if="importResult.warnings.length" class="space-y-1 text-xs text-amber-300">
          <li v-for="(w, i) in importResult.warnings" :key="i" class="break-words">⚠️ {{ w }}</li>
        </ul>
        <div class="flex flex-col gap-3 sm:flex-row">
          <router-link to="/dashboard" class="flex min-h-[44px] items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-500">Ver Dashboard</router-link>
          <router-link to="/lancamentos" class="flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 px-5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5">Ver Lançamentos</router-link>
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
          class="glass-card p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 hover:bg-white/[0.03] transition-colors"
        >
          <div class="flex items-center gap-4 min-w-0">
            <span class="text-2xl shrink-0">{{ getSourceIcon(record.source) }}</span>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-white truncate">{{ record.versionName || record.fileName }}</p>
              <p class="text-[11px] text-slate-500 mt-0.5 break-words">
                {{ record.source?.toUpperCase() }} · {{ record.count }} registros · {{ formatImportDate(record.importedAt) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 sm:shrink-0">
            <button
              @click="activateVersion(record)"
              class="flex-1 sm:flex-none min-h-[44px] md:min-h-0 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
              :class="importStore.activeVersion?.id === record.id
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'"
            >
              {{ importStore.activeVersion?.id === record.id ? '✓ Ativa' : 'Ativar' }}
            </button>
            <button @click="removeRecord(record.id)" aria-label="Remover importação" class="flex h-11 w-11 md:h-auto md:w-auto items-center justify-center md:p-1.5 text-slate-600 hover:text-red-400 rounded-lg hover:bg-white/5 transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>

  <!-- Overlay de drag & drop na página (desktop); visual apenas, os cards abaixo continuam recebendo o drop -->
  <div
    v-if="pageDragging"
    data-testid="drop-overlay"
    class="pointer-events-none fixed inset-2 z-[70] hidden items-center justify-center rounded-2xl border-4 border-dashed border-brand-400 bg-brand-500/10 md:flex"
  >
    <span class="rounded-2xl bg-slate-900/90 px-6 py-3 text-lg font-bold text-white shadow-2xl">Solte para importar</span>
  </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useFinanceStore } from '@/stores/financeStore.js'
import { useImportStore } from '@/stores/importStore.js'
import { parseXlsx } from '@/modules/importers/xlsxImporter.js'

const financeStore = useFinanceStore()
const importStore  = useImportStore()

// ─── Fontes ──────────────────────────────────────────────────────────────
// available: parser implementado. Só xlsx por enquanto; as demais aparecem como "Em breve".
const importSources = [
  { id: 'xlsx',        icon: '📊', name: 'Planilha Excel', description: 'Arquivo .xlsx com lançamentos estruturados', badge: 'XLSX', ext: '.xlsx', available: true  },
  { id: 'nubank',      icon: '💜', name: 'Nubank',         description: 'Extrato CSV exportado do app Nubank',        badge: 'CSV',  ext: '.csv',  available: false },
  { id: 'mercadopago', icon: '💙', name: 'Mercado Pago',   description: 'Extrato CSV do Mercado Pago',                badge: 'CSV',  ext: '.csv',  available: false },
  { id: 'santander',   icon: '🔴', name: 'Santander',      description: 'Extrato PDF — processamento via IA',         badge: 'PDF',  ext: '.pdf',  available: false },
]
const parsers = { xlsx: parseXlsx }

const inputRefs = reactive({})
const importingId = ref(null)
const importResult = ref(null)
const importError = ref(null)

function extensionOf(file) {
  const m = /\.([^.]+)$/.exec(file.name)
  return m ? `.${m[1].toLowerCase()}` : ''
}

function openPicker(source) {
  if (!source.available || importingId.value) return
  inputRefs[source.id]?.click()
}

function onInputChange(e, source) {
  const file = e.target.files?.[0]
  e.target.value = '' // permite escolher o mesmo arquivo de novo
  if (file) processFile(source, file)
}

// ─── Importação (automática ao receber o arquivo) ────────────────────────
async function processFile(source, file) {
  if (importingId.value) return
  importResult.value = null
  importError.value = null

  if (!source.available) {
    importError.value = `A fonte ${source.name} ainda não está disponível.`
    return
  }
  const ext = extensionOf(file)
  if (ext !== source.ext) {
    importError.value = `Arquivo ${ext || 'sem extensão'} não é aceito pela fonte ${source.name}. Envie um ${source.ext}.`
    return
  }

  importingId.value = source.id
  try {
    const { entries, warnings } = await parsers[source.id](file)
    const versionName = file.name.replace(/\.[^.]+$/, '')
    financeStore.setEntries(entries)
    importStore.addImport({
      source:      source.id,
      fileName:    file.name,
      versionName,
      description: '', // edição de nome/descrição passa para a tela de Versões
      count:       entries.length,
    })
    importResult.value = { count: entries.length, versionName, warnings: warnings || [] }
  } catch (err) {
    importError.value = err.message || 'Não foi possível ler o arquivo. Verifique se está no formato correto.'
  } finally {
    importingId.value = null
  }
}

// ─── Drag & drop: sobre o card ───────────────────────────────────────────
const dragOverId = ref(null)

function onCardDragOver(source) {
  if (source.available) dragOverId.value = source.id
}
function onCardDragLeave(e, source) {
  if (!e.currentTarget.contains(e.relatedTarget) && dragOverId.value === source.id) dragOverId.value = null
}
function onCardDrop(e, source) {
  resetDrag()
  const file = e.dataTransfer?.files?.[0]
  if (file) processFile(source, file)
}

// ─── Drag & drop: em qualquer lugar da página (detecta a fonte pela extensão) ─
const pageDragging = ref(false)
let dragDepth = 0

const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files')
function resetDrag() {
  dragDepth = 0
  pageDragging.value = false
  dragOverId.value = null
}
function onWindowDragEnter(e) {
  if (!hasFiles(e)) return
  e.preventDefault()
  dragDepth++
  pageDragging.value = true
}
function onWindowDragOver(e) {
  if (hasFiles(e)) e.preventDefault() // sem isso o navegador não permite soltar (e abriria o arquivo)
}
function onWindowDragLeave(e) {
  if (!hasFiles(e)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) pageDragging.value = false
}
function onWindowDrop(e) {
  if (!hasFiles(e)) return
  e.preventDefault()
  resetDrag()
  const file = e.dataTransfer.files?.[0]
  if (!file) return

  importResult.value = null
  importError.value = null
  const ext = extensionOf(file)
  const candidates = importSources.filter(s => s.ext === ext)
  const available = candidates.find(s => s.available)
  if (available) return processFile(available, file)
  if (candidates.length) {
    const nomes = candidates.map(s => s.name).join(', ')
    importError.value = `Arquivos ${ext} pertencem a ${candidates.length > 1 ? 'fontes' : 'uma fonte'} que ainda não ${candidates.length > 1 ? 'estão disponíveis' : 'está disponível'} (${nomes}).`
  } else {
    importError.value = `Formato ${ext || 'sem extensão'} não reconhecido. Envie um arquivo .xlsx.`
  }
}

onMounted(() => {
  window.addEventListener('dragenter', onWindowDragEnter)
  window.addEventListener('dragover', onWindowDragOver)
  window.addEventListener('dragleave', onWindowDragLeave)
  window.addEventListener('drop', onWindowDrop)
})
onUnmounted(() => {
  window.removeEventListener('dragenter', onWindowDragEnter)
  window.removeEventListener('dragover', onWindowDragOver)
  window.removeEventListener('dragleave', onWindowDragLeave)
  window.removeEventListener('drop', onWindowDrop)
})

// ─── Histórico ───────────────────────────────────────────────────────────
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
