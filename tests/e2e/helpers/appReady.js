/** Espera o sinal de app pronto (main.js): storage hidratado, app montado e rota inicial renderizada. */
export const waitAppReady = page => page.waitForSelector('html[data-ready="1"]', { state: 'attached' })
