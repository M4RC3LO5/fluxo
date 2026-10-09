# Fluxo

Plataforma web de gestão financeira para pessoas, profissionais liberais, autônomos e PMEs.

## Stack
- Vue 3 + Vite
- Tailwind CSS v4
- Pinia
- Chart.js
- Vue Router

## Setup

```bash
npm install
npm run dev
```

## Estrutura

```
src/
  assets/        # CSS global
  components/
    dashboard/   # DashboardCharts
    layout/      # AppTopbar, AppSidebar
    ui/          # Componentes reutilizáveis
  modules/
    kpis/        # Smart alerts e KPIs
  router/        # Vue Router
  stores/        # Pinia (financeStore, importStore)
  utils/         # formatters
  views/         # Pages
```
