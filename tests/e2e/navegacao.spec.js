import { test, expect } from '@playwright/test'
import { importFixture } from './helpers/importFixture.js'
import { waitAppReady } from './helpers/appReady.js'
import { showBills } from './helpers/dashboard.js'

const bottomNav = page => page.getByTestId('bottom-nav')
const items = page => page.getByTestId('bottom-nav-item')

test.describe('Celular', () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'cenário de celular'))

  test('Celular exibe barra inferior com 3 itens', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(bottomNav(page)).toBeVisible()
    await expect(items(page)).toHaveCount(3)
    const nomes = ['Dashboard', 'Lançamentos', 'Importar']
    for (const [i, nome] of nomes.entries()) await expect(items(page).nth(i)).toContainText(nome)
    await expect(page.getByTestId('sidebar')).toBeHidden()
  })

  for (const [item, rota] of [
    ['Lançamentos', '/lancamentos'], ['Importar', '/importacoes'], ['Dashboard', '/dashboard'],
  ]) {
    test(`Celular navega pela barra inferior: ${item}`, async ({ page }) => {
      await page.goto('/dashboard')
      await items(page).filter({ hasText: item }).tap()
      await expect(page).toHaveURL(new RegExp(`${rota}$`))
      await expect(items(page).filter({ hasText: item })).toHaveAttribute('aria-current', 'page')
    })
  }

  test('Itens da barra inferior têm área de toque adequada', async ({ page }) => {
    await page.goto('/dashboard')
    await waitAppReady(page)
    const boxes = await items(page).evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => [r.width, r.height]))
    expect(boxes).toHaveLength(3)
    for (const [w, h] of boxes) {
      expect(w).toBeGreaterThanOrEqual(44)
      expect(h).toBeGreaterThanOrEqual(44)
    }
  })

  for (const [pagina, rota] of [
    ['Dashboard', '/dashboard'], ['Lançamentos', '/lancamentos'], ['Importações', '/importacoes'],
  ]) {
    test(`Celular não tem rolagem horizontal: ${pagina}`, async ({ page }) => {
      if (pagina === 'Lançamentos') {
        await importFixture(page)
        await page.getByTestId('bottom-nav-item').filter({ hasText: pagina }).tap()
      } else {
        await page.goto(rota)
      }
      await waitAppReady(page)
      const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
      expect(sw).toBeLessThanOrEqual(iw)
    })
  }

  test('Conteúdo não fica escondido atrás da barra inferior', async ({ page }) => {
    await page.goto('/importacoes')
    await waitAppReady(page) // rola só com a página pronta
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const { lastBottom, navTop } = await page.evaluate(() => {
      const root = document.querySelector('main')
      const els = [...root.querySelectorAll('*')].filter(e => e.getBoundingClientRect().height > 0)
      const lastBottom = Math.max(...els.map(e => e.getBoundingClientRect().bottom))
      return { lastBottom, navTop: document.querySelector('[data-testid=bottom-nav]').getBoundingClientRect().top }
    })
    expect(lastBottom).toBeLessThanOrEqual(navTop)
  })

  test('Item ativo da barra inferior é enfatizado', async ({ page }) => {
    await page.goto('/lancamentos')
    const ativo = items(page).filter({ hasText: 'Lançamentos' })
    await expect(ativo).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[data-testid=bottom-nav-item][aria-current=page]')).toHaveCount(1)
    await expect(page.getByTestId('page-title')).toHaveText('Lançamentos')
    await expect(page).toHaveTitle('Lançamentos · Fluxo')
    // pílula só no item ativo (opacidade 1) e rótulo semibold; inativos sem pílula
    const pill = it => it.locator('.pill').evaluate(e => getComputedStyle(e).opacity)
    await expect.poll(() => pill(ativo)).toBe('1')
    await expect.poll(() => pill(items(page).filter({ hasText: 'Dashboard' }))).toBe('0')
    expect(await ativo.locator('.label').evaluate(e => getComputedStyle(e).fontWeight)).toBe('600')
  })

  // Dashboard com conteúdo (fixture importada) rolado até o fim; devolve a posição
  async function dashboardRolado(page) {
    await importFixture(page)
    await items(page).filter({ hasText: 'Dashboard' }).tap()
    await showBills(page) // o Dashboard abre na visão Pessoal
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const y = await page.evaluate(() => window.scrollY)
    expect(y).toBeGreaterThan(500)
    return y
  }
  const scrollY = page => page.evaluate(() => window.scrollY)

  test('Navegar para outra página abre no topo', async ({ page }) => {
    await dashboardRolado(page)
    await items(page).filter({ hasText: 'Lançamentos' }).tap()
    await expect(page).toHaveURL(/\/lancamentos$/)
    await items(page).filter({ hasText: 'Dashboard' }).tap()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect.poll(() => scrollY(page)).toBe(0)
  })

  test('Voltar restaura a posição anterior', async ({ page }) => {
    const y = await dashboardRolado(page)
    await items(page).filter({ hasText: 'Lançamentos' }).tap()
    await expect(page).toHaveURL(/\/lancamentos$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect.poll(async () => Math.abs((await scrollY(page)) - y), { timeout: 5000 }).toBeLessThanOrEqual(50)
  })

  test('Tocar no item ativo volta ao topo', async ({ page }) => {
    await dashboardRolado(page)
    await items(page).filter({ hasText: 'Dashboard' }).tap()
    await expect.poll(() => scrollY(page), { timeout: 5000 }).toBe(0)
  })
})

test.describe('Computador', () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, 'cenário de computador'))

  test('Computador exibe barra lateral e oculta barra inferior', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(bottomNav(page)).toBeHidden()
  })
})
