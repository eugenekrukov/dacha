import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-сервер Vite инжектирует инлайновые <style> (HMR/Tailwind) и инлайновый
// preamble-скрипт react-refresh — строгая CSP-мета из index.html их блокирует,
// и приложение рендерится без стилей. Убираем мету только в dev (apply: 'serve');
// в прод-сборке плагин не участвует, dist/index.html сохраняет строгую CSP.
const stripCspMetaInDev = (): Plugin => ({
  name: 'strip-csp-meta-in-dev',
  apply: 'serve',
  transformIndexHtml(html) {
    return html.replace(
      /<meta\s[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>\s*/i,
      '',
    )
  },
})

// В деве API ходит через префикс /api (proxy на прод с rewrite), чтобы SPA-маршруты
// (/plantings, /today, /crops…) не конфликтовали с одноимёнными API-роутами бэкенда.
// В проде API на корне того же домена — префикс не нужен (см. api/client.ts).
const API_TARGET = process.env.VITE_API_TARGET || 'https://dacha.studio1008.com'

export default defineConfig(({ command }) => ({
  // В проде SPA живёт под dacha.studio1008.com/app/; в деве — с корня для удобства.
  base: command === 'build' ? '/app/' : '/',
  plugins: [react(), stripCspMetaInDev()],
  server: {
    port: 5183,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
}))
