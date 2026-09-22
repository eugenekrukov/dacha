import { useState } from 'react'
import { isLargeFont, setLargeFont } from '../ui/fontScale'

const APP_VERSION = '1.0.0' // синхронизировать с Android versionName при релизах

// Подписка, данные аккаунта и участка — в «Профиль» (см. ProfileScreen AccountTab).
// «Настройки» = системные параметры: внешний вид, сведения о приложении.
export default function SettingsScreen() {
  const [largeFont, setLarge] = useState(isLargeFont())

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black">Настройки</h1>

      <section className="dacha-card flex flex-col gap-3 p-5">
        <h2 className="font-black">Внешний вид</h2>
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="font-semibold">
            Крупный шрифт
            <span className="block text-sm font-semibold text-muted">
              Увеличивает текст по всему приложению
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={largeFont}
            aria-label="Крупный шрифт"
            onClick={() => {
              const next = !largeFont
              setLarge(next)
              setLargeFont(next)
            }}
            className={`relative h-7 w-12 shrink-0 rounded-pill transition ${
              largeFont ? 'bg-primary' : 'bg-black/15'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                largeFont ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </label>
      </section>

      <section className="dacha-card flex flex-col gap-2 p-5">
        <h2 className="font-black">О приложении</h2>
        <p className="font-semibold text-muted">Версия {APP_VERSION}</p>
        <a className="text-link" href="https://dacha.studio1008.com/offer" target="_blank" rel="noopener">
          Публичная оферта
        </a>
        <a className="text-link" href="https://dacha.studio1008.com/privacy" target="_blank" rel="noopener">
          Политика конфиденциальности
        </a>
        <a className="text-link" href="https://dacha.studio1008.com/account-deletion" target="_blank" rel="noopener">
          Удаление аккаунта и данных
        </a>
        <a className="text-link" href="mailto:dacha@studio1008.com">Поддержка: dacha@studio1008.com</a>
      </section>
    </div>
  )
}
