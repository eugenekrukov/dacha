# F12 Фото-дневник — План 2: Веб-клиент

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Веб-клиент фото-дневника — захват фото (из листа действия + standalone) и лента посадки.

**Architecture:** React 18 + Vite + TS + Tailwind. API через `web/src/api/client.ts`. Загрузка — multipart через кастомный `fetch` (паттерн `fetchActionsCsv`). Приватные изображения требуют Bearer → нельзя в `<img src>` напрямую; компонент `AuthImage` тянет blob с токеном и показывает через `URL.createObjectURL`.

**Tech Stack:** React, TypeScript, Tailwind, lucide-react (иконки).

**Зависит от:** backend (План 1) задеплоен — эндпоинты `/photos` (POST multipart, GET, DELETE, GET /file/:id с X-Accel-Redirect).

**Спецификация:** `docs/superpowers/specs/2026-06-20-photo-diary-design.md` (§6).

**Проверка (нет юнит-тестов в вебе):** после каждой задачи — `npx tsc --noEmit` (в `web/`) на 0 ошибок; визуальная проверка через preview-инструмент в финальной задаче.

---

## Структура файлов
- Modify: `web/src/api/types.ts` — тип `PlantingPhoto`.
- Modify: `web/src/api/client.ts` — методы `getPhotos`, `uploadPhoto`, `deletePhoto`.
- Create: `web/src/components/AuthImage.tsx` — `<img>` с blob-фетчем по Bearer.
- Create: `web/src/components/PhotoDiary.tsx` — секция ленты (сетка + добавить + просмотр + удаление).
- Modify: `web/src/components/ActionLogSheet.tsx` — опц. фото-вложение (только не-групповой режим).
- Modify: `web/src/screens/PlantingDetailScreen.tsx` — секция «Дневник».

---

## Task 1: Тип PlantingPhoto + методы API-клиента

**Files:** Modify `web/src/api/types.ts`, `web/src/api/client.ts`

- [ ] **Step 1: Добавить тип** в `web/src/api/types.ts` (в конец файла):
```ts
export interface PlantingPhoto {
  id: number
  planting_id: number
  action_id: number | null
  caption: string | null
  taken_at: string
  width: number | null
  height: number | null
  url: string        // относительный путь, требует Bearer: /photos/file/:id
  thumb_url: string  // /photos/file/:id?thumb=1
}
```

- [ ] **Step 2: Добавить методы** в `web/src/api/client.ts`. Импортировать `PlantingPhoto` в блоке импортов типов. Добавить в объект `api` (после блока `// --- actions ---`):
```ts
  // --- photos (фото-дневник) ---
  getPhotos: (plantingId: number) =>
    request<PlantingPhoto[]>(`/photos?planting_id=${plantingId}`),
  uploadPhoto: async (
    plantingId: number,
    file: File,
    opts: { actionId?: number; caption?: string } = {},
  ): Promise<PlantingPhoto> => {
    const fd = new FormData()
    fd.append('planting_id', String(plantingId))
    if (opts.actionId != null) fd.append('action_id', String(opts.actionId))
    if (opts.caption) fd.append('caption', opts.caption)
    fd.append('file', file)
    const token = tokenStore.getToken()
    const res = await fetch(`${BASE}/photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd, // НЕ ставим Content-Type — браузер сам выставит boundary
    })
    if (!res.ok) {
      let code: string | undefined
      try { code = (await res.json()).code } catch { /* ignore */ }
      throw new ApiError(res.status, code === 'photo_limit_reached' ? 'Достигнут лимит фото' : `HTTP ${res.status}`, code)
    }
    return res.json()
  },
  deletePhoto: (id: number) =>
    request<void>(`/photos/${id}`, { method: 'DELETE' }),
```
Note: `BASE`, `tokenStore`, `ApiError`, `request` уже есть в файле.

- [ ] **Step 3: Проверка типов.** Run (в `web/`): `npx tsc --noEmit`. Expected: 0 ошибок.

- [ ] **Step 4: Commit:**
```bash
git add web/src/api/types.ts web/src/api/client.ts
git commit -m "feat(web): PlantingPhoto тип + методы API (get/upload/delete)"
```

---

## Task 2: Компонент AuthImage (приватные картинки по Bearer)

**Files:** Create `web/src/components/AuthImage.tsx`

- [ ] **Step 1: Создать компонент** `web/src/components/AuthImage.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { tokenStore } from '../auth/storage'

const BASE = import.meta.env.DEV ? '/api' : ''

interface Props {
  path: string            // относительный url из API (например /photos/file/10?thumb=1)
  alt: string
  className?: string
}

// Приватные фото отдаются по Bearer (X-Accel-Redirect на бэкенде), поэтому обычный
// <img src> не подходит — тянем blob с токеном и показываем через object URL.
export default function AuthImage({ path, alt, className }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    const token = tokenStore.getToken()
    fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob() })
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setSrc(url)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [path])

  if (failed) return <div className={`flex items-center justify-center bg-black/5 text-xs text-muted ${className ?? ''}`}>—</div>
  if (!src) return <div className={`animate-pulse bg-black/5 ${className ?? ''}`} />
  return <img src={src} alt={alt} className={className} />
}
```

- [ ] **Step 2: Проверка типов.** Run (в `web/`): `npx tsc --noEmit`. Expected: 0 ошибок.

- [ ] **Step 3: Commit:**
```bash
git add web/src/components/AuthImage.tsx
git commit -m "feat(web): AuthImage — приватные картинки через blob+Bearer"
```

---

## Task 3: Компонент PhotoDiary (лента посадки)

**Files:** Create `web/src/components/PhotoDiary.tsx`

- [ ] **Step 1: Создать компонент** `web/src/components/PhotoDiary.tsx`. Требования:
  - Принимает `plantingId: number`.
  - При маунте грузит `api.getPhotos(plantingId)` → состояние `photos`.
  - Заголовок «Дневник» + кнопка «+ Добавить фото» — скрытый `<input type="file" accept="image/*" capture="environment">`, по выбору вызывает `api.uploadPhoto(plantingId, file)`, при успехе добавляет в начало списка; при `ApiError` с `code==='photo_limit_reached'` показывает сообщение про лимит/подписку.
  - Сетка миниатюр (`grid grid-cols-3 gap-2`), каждая — `<AuthImage path={p.thumb_url} ... className="aspect-square w-full rounded-btn object-cover" />`, тап открывает полноэкранный просмотр.
  - Пустое состояние: текст «Пока нет фото. Снимите свою посадку — соберётся лента роста.»
  - Состояние загрузки (спиннер/скелетон) и ошибки.
  - Полноэкранный просмотр (модалка `fixed inset-0 bg-black/90`): большой `<AuthImage path={p.url} />`, дата (`new Date(taken_at).toLocaleDateString('ru-RU')`), подпись, кнопка удаления (вызывает `api.deletePhoto(id)` → убрать из списка → закрыть просмотр), закрытие по фону/Esc.

Полный код:
```tsx
import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../api/client'
import type { PlantingPhoto } from '../api/types'
import AuthImage from './AuthImage'

export default function PhotoDiary({ plantingId }: { plantingId: number }) {
  const [photos, setPhotos] = useState<PlantingPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [viewer, setViewer] = useState<PlantingPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    api.getPhotos(plantingId)
      .then((p) => { if (!cancelled) setPhotos(p) })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить фото') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [plantingId])

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // позволить повторно выбрать тот же файл
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const photo = await api.uploadPhoto(plantingId, file)
      setPhotos((prev) => [photo, ...prev])
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'photo_limit_reached'
        ? 'Достигнут лимит фото. Оформите подписку, чтобы добавить больше.'
        : 'Не удалось загрузить фото')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    try {
      await api.deletePhoto(id)
      setPhotos((prev) => prev.filter((p) => p.id !== id))
      setViewer(null)
    } catch {
      setError('Не удалось удалить фото')
    }
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-black">Дневник</h2>
        <button
          type="button"
          className="dacha-chip flex items-center gap-1.5 px-3 py-2"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Camera size={18} aria-hidden /> {busy ? '…' : 'Добавить фото'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      </div>

      {error && <p className="mb-2 text-sm font-bold text-red-600">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="aspect-square animate-pulse rounded-btn bg-black/5" />)}
        </div>
      ) : photos.length === 0 ? (
        <p className="rounded-btn bg-background p-4 text-center text-sm text-muted">
          Пока нет фото. Снимите свою посадку — соберётся лента роста.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button key={p.id} type="button" onClick={() => setViewer(p)} className="block">
              <AuthImage path={p.thumb_url} alt="Фото посадки" className="aspect-square w-full rounded-btn object-cover" />
            </button>
          ))}
        </div>
      )}

      {viewer && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/90" onClick={() => setViewer(null)}>
          <div className="flex justify-end p-4">
            <button type="button" aria-label="Закрыть" onClick={() => setViewer(null)} className="text-white">
              <X size={28} aria-hidden />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
            <AuthImage path={viewer.url} alt="Фото посадки" className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
          <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="font-bold">{new Date(viewer.taken_at).toLocaleDateString('ru-RU')}</p>
              {viewer.caption && <p className="text-sm text-white/70">{viewer.caption}</p>}
            </div>
            <button type="button" aria-label="Удалить" onClick={() => remove(viewer.id)} className="text-red-400">
              <Trash2 size={24} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Проверка типов.** Run (в `web/`): `npx tsc --noEmit`. Expected: 0 ошибок.

- [ ] **Step 3: Commit:**
```bash
git add web/src/components/PhotoDiary.tsx
git commit -m "feat(web): PhotoDiary — лента посадки (сетка, добавление, просмотр, удаление)"
```

---

## Task 4: Секция «Дневник» на экране посадки

**Files:** Modify `web/src/screens/PlantingDetailScreen.tsx`

- [ ] **Step 1: Прочитать** `web/src/screens/PlantingDetailScreen.tsx`, найти место под расписанием работ / журналом (там же, где «Записать действие»).

- [ ] **Step 2: Подключить `PhotoDiary`.** Импорт `import PhotoDiary from '../components/PhotoDiary'` и вставить `<PhotoDiary plantingId={planting.id} />` в подходящую секцию (после блока действий/расписания, до истории). Использовать реальное имя переменной посадки в этом файле (проверить при чтении — вероятно `planting.id` или из параметра маршрута).

- [ ] **Step 3: Проверка типов.** Run (в `web/`): `npx tsc --noEmit`. Expected: 0 ошибок.

- [ ] **Step 4: Commit:**
```bash
git add web/src/screens/PlantingDetailScreen.tsx
git commit -m "feat(web): секция Дневник на экране посадки"
```

---

## Task 5: Фото-вложение в листе действия

**Files:** Modify `web/src/components/ActionLogSheet.tsx`

- [ ] **Step 1: Добавить опц. фото-вложение** в `ActionLogSheet.tsx`. Требования:
  - Только в **не-групповом** режиме (`!grouped`). В групповом — не показывать (один кадр на много посадок неоднозначен).
  - Кнопка «📷 Фото» (lucide `Camera`) + скрытый `<input type="file" accept="image/*" capture="environment">`; по выбору сохранять `File` в состояние `photoFile` и показать имя/превью-метку «фото прикреплено» с возможностью убрать.
  - В `save()`: после успешного `api.logAction(tg.id, type, ...)` (не-групповой режим → один target), если `photoFile` задан — вызвать `api.uploadPhoto(tg.id, photoFile, { actionId: loggedAction.id })`. Для этого `logAction` уже возвращает `ActionLog` с `id` — использовать его. Для `transplanting`-ветки тоже привязать к действию transplanting.
  - Ошибку загрузки фото показывать, но **не откатывать** уже записанное действие (действие важнее фото); текст «Действие записано, но фото не загрузилось».

- [ ] **Step 2: Проверка типов.** Run (в `web/`): `npx tsc --noEmit`. Expected: 0 ошибок.

- [ ] **Step 3: Commit:**
```bash
git add web/src/components/ActionLogSheet.tsx
git commit -m "feat(web): фото-вложение в листе действия (одиночный режим)"
```

---

## Task 6: Визуальная проверка через preview

> Не TDD — верификация. Использовать preview-инструмент (dev-сервер веба).

- [ ] **Step 1: Запустить preview** dev-сервера веба (порт согласно проекту, см. память — 5183). Залогиниться тест-аккаунтом.
- [ ] **Step 2:** Открыть экран посадки → секция «Дневник»: пустое состояние, затем добавить фото (загрузка → миниатюра появляется). Открыть просмотр, удалить.
- [ ] **Step 3:** Открыть лист действия по задаче дня → прикрепить фото → сохранить → фото появляется в дневнике посадки с бейджем действия.
- [ ] **Step 4:** Проверить консоль и network на ошибки (preview-инструменты). Снять скриншот для подтверждения.
- [ ] **Step 5: Commit** (если были правки по итогам проверки).

---

## Self-review (выполнено автором плана)
- **Покрытие спека §6 (веб):** типы/API → Task 1; приватные картинки → Task 2; лента (сетка/добавление/просмотр/удаление) → Task 3; секция на экране посадки → Task 4; фото из листа действия (одиночный режим) → Task 5; проверка → Task 6.
- **Согласованность:** `api.getPhotos/uploadPhoto/deletePhoto`, `PlantingPhoto`, `AuthImage(path)`, `PhotoDiary(plantingId)` — единые имена во всех задачах. URL приходят из API относительными (`/photos/file/:id`), `AuthImage`/upload используют `BASE` как в `client.ts`.
- **Нет юнит-тестов:** веб в этом проекте проверяется `tsc --noEmit` + preview (так в session-note); TDD неприменим, верификация — Task 6.
