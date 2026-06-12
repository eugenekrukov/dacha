import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Превью-сервер запускает vite с cwd ≠ web, поэтому указываем конфиг Tailwind
// абсолютным путём — иначе кастомные цвета/токены не подхватываются.
const dir = path.dirname(fileURLToPath(import.meta.url))

export default {
  plugins: {
    tailwindcss: { config: path.join(dir, 'tailwind.config.ts') },
    autoprefixer: {},
  },
}
