<template>
  <div class="min-h-screen bg-surface-900">
    <AppTopbar />
    <AppSidebar />
    <main class="transition-all duration-300" :class="sidebarOpen ? 'ml-64' : 'ml-16'">
      <div class="px-6 py-8 max-w-screen-2xl mx-auto">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const sidebarOpen = ref(true)
provide('sidebarOpen', sidebarOpen)
</script>
