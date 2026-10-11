import { test, expect } from '@playwright/test'
import { importFixture } from './helpers/importFixture.js'

const bottomNav = page => page.getByTestId('bottom-nav')
const items = page => page.getByTestId('bottom-nav-item')

test.describe('Celular', () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'cenário de celular'))

  test('Celular exibe barra inferior com 4 itens', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(bottomNav(page)).toBeVisible()
    await expect(items(page)).toHaveCount(4)
    const nomes = ['Dashboard', 'Lançamentos', 'Importar', 'Versões']
    for (const [i, nome] of nomes.entries()) await expect(items(page).nth(i)).toContainText(nome)
    await expect(page.getByTestId('sidebar')).toBeHidden()
  })

  for (const [item, rota] of [
    ['Lançamentos', '/lancamentos'], ['Importar', '/importacoes'], ['Versões', '/versoes'], ['Dashboard', '/dashboard'],
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
    const boxes = await items(page).evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => [r.width, r.height]))
    expect(boxes).toHaveLength(4)
    for (const [w, h] of boxes) {
      expect(w).toBeGreaterThanOrEqual(44)
      expect(h).toBeGreaterThanOrEqual(44)
    }
  })

  for (const [pagina, rota] of [
    ['Dashboard', '/dashboard'], ['Lançamentos', '/lancamentos'], ['Importações', '/importacoes'], ['Versões', '/versoes'],
  ]) {
    test(`Celular não tem rolagem horizontal: ${pagina}`, async ({ page }) => {
      if (pagina === 'Lançamentos') {
        await importFixture(page)
        await page.getByTestId('bottom-nav-item').filter({ hasText: pagina }).tap()
      } else {
        await page.goto(rota)
      }
      await page.waitForLoadState('networkidle')
      const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
      expect(sw).toBeLessThanOrEqual(iw)
    })
  }

  test('Conteúdo não fica escondido atrás da barra inferior', async ({ page }) => {
    await page.goto('/importacoes')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const { lastBottom, navTop } = await page.evaluate(() => {
      const root = document.querySelector('main')
      const els = [...root.querySelectorAll('*')].filter(e => e.getBoundingClientRect().height > 0)
      const lastBottom = Math.max(...els.map(e => e.getBoundingClientRect().bottom))
      return { lastBottom, navTop: document.querySelector('[data-testid=bottom-nav]').getBoundingClientRect().top }
    })
    expect(lastBottom).toBeLessThanOrEqual(navTop)
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
