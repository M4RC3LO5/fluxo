import { test, expect } from '@playwright/test'
import { importFixture } from './helpers/importFixture.js'
import { waitAppReady } from './helpers/appReady.js'
import { showBills } from './helpers/dashboard.js'
import { abrirLancamentos, rows } from './helpers/lancamentos.js'

const kpis = page => page.getByTestId('kpi-card').allInnerTexts()
const history = page => page.getByText('Histórico de Importações')

test('Dados sobrevivem ao recarregar', async ({ page }) => {
  await importFixture(page)
  await page.getByRole('link', { name: 'Ver Dashboard' }).click()
  await showBills(page) // o Dashboard abre na visão Pessoal
  const antes = await kpis(page)

  await page.reload()
  await showBills(page) // a visão escolhida não persiste: volta para Pessoal
  expect(await kpis(page)).toEqual(antes)

  // histórico de versões (hoje exibido em Importações)
  await page.goto('/importacoes')
  await expect(history(page)).toBeVisible()
  await expect(page.getByText('fluxo_exemplo').first()).toBeVisible()
  await expect(page.getByText('+15')).toBeVisible()
})

test('Recarregar logo após importar não perde dados', async ({ page }) => {
  await importFixture(page) // volta quando a mensagem de resultado aparece
  await page.reload() // sem espera: a mensagem só aparece depois da gravação
  await waitAppReady(page)
  await abrirLancamentos(page)
  await expect(page.getByText('15 de 15 registros')).toBeVisible()
  await expect(rows(page)).toHaveCount(15)
})

test('Remover versão persiste', async ({ page }) => {
  await importFixture(page)
  await page.getByRole('button', { name: 'Remover importação' }).click()
  await page.getByTestId('confirm-remove').click()
  await expect(page.getByRole('dialog')).toBeHidden() // o sheet fecha depois da gravação
  await expect(history(page)).toBeHidden()

  await page.reload()
  await expect(page.getByTestId('source-card-xlsx')).toBeVisible()
  await expect(history(page)).toBeHidden()
  await page.goto('/lancamentos')
  await expect(page.getByText('0 de 0 registros')).toBeVisible()
  await page.goto('/dashboard')
  await waitAppReady(page)
  await expect(page.getByTestId('metric-card')).toHaveCount(0) // métricas só aparecem com lançamentos
})

test('Primeira abertura sem dados', async ({ page }) => {
  const problemas = []
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) problemas.push(m.text()) })
  page.on('pageerror', e => problemas.push(e.message))

  await page.goto('/dashboard')
  await waitAppReady(page)
  await expect(page.getByTestId('metric-card')).toHaveCount(0) // métricas só aparecem com lançamentos
  await page.goto('/lancamentos')
  await expect(page.getByText('0 de 0 registros')).toBeVisible()
  expect(problemas).toEqual([])
})
