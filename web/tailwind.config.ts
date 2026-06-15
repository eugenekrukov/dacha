import type { Config } from 'tailwindcss'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// content резолвится относительно cwd процесса. Превью запускает vite с cwd ≠ web,
// поэтому строим абсолютные glob-пути (forward slashes для fast-glob).
const dir = path.dirname(fileURLToPath(import.meta.url))
const glob = (p: string) => path.join(dir, p).replace(/\\/g, '/')

// Дизайн-система Solar Dacha (зеркало android UI_MANIFEST.md)
export default {
  content: [glob('index.html'), glob('src/**/*.{ts,tsx}')],
  theme: {
    extend: {
      colors: {
        primary: '#FF7B00',      // оранжевый — заливка кнопок/активных чипов (белый текст поверх)
        link: '#C2410C',         // тёмно-оранжевый — текстовые ссылки (контраст ≥4.5:1 на белом/креме)
        background: '#FFF8EB',   // кремовый фон экранов
        tertiary: '#2E7D32',     // зелёный — стадии, следующая задача
        muted: '#6B4A2E',        // коричневый вспомогательный текст (затемнён для читаемости 40+)
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '22px',
        btn: '16px',
        pill: '100px',
      },
      boxShadow: {
        card: '0 3px 10px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config
