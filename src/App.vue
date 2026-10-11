<template>
  <div class="min-h-screen bg-surface-900">
    <AppTopbar />
    <AppSidebar />
    <!-- mobile: sem margem lateral, espaço inferior = barra (4rem) + safe area; md+: margem da sidebar -->
    <main
      class="px-4 pb-[calc(4rem+env(safe-area-inset-bottom)+1.5rem)] md:px-0 md:pb-0 md:transition-all md:duration-300"
      :class="sidebarOpen ? 'md:ml-64' : 'md:ml-16'"
    >
      <div class="py-8 md:px-6 max-w-screen-2xl mx-auto">
        <router-view />
      </div>
    </main>
    <AppBottomNav />
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppBottomNav from '@/components/layout/AppBottomNav.vue'

const sidebarOpen = ref(true)
provide('sidebarOpen', sidebarOpen)
</script>
