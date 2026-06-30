# Грядки участка — веб UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить на вебе поле «Место» (грядка) в форму создания посадки и на экран деталей посадки —
зеркало уже реализованного бэкенда (`garden_beds`, `GET/POST /gardens/:id/beds`, `PATCH/DELETE /beds/:id`,
`bed_id` на посадках) — со списком грядок, инлайн-созданием/переименованием/удалением и мягкой подсказкой
о севообороте.

**Architecture:** Новый переиспользуемый компонент `BedField` (комбобокс грядок + инлайн «+ Новая грядка»
+ переименование/удаление + подсказка севооборота) встраивается в `AddPlantingForm.tsx` (создание) и в
`PlantingDetailScreen.tsx` (просмотр/правка задним числом через новый эндпоинт `PATCH /plantings/:id/info`,
которого пока нет в клиенте). Типы и API-клиент расширяются под грядки и `bed_id`/`family`.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind (утилитные классы `dacha-input`/`dacha-chip`/`dacha-btn`/
`dacha-card`), `lucide-react` для иконок. У веба нет автотестов (только `tsc -b --noEmit` через
`npm run typecheck`) — проверка вручную через `npm run dev`, как и для прочих UI-фич проекта (см.
`docs/archive/superpowers/specs/2026-06-27-garden-beds-rotation-design.md`, раздел 5).

**Связанная спека:** `docs/archive/superpowers/specs/2026-06-27-garden-beds-rotation-design.md`
**Бэкенд (уже реализован и задеплоен):** `docs/archive/superpowers/plans/2026-06-27-garden-beds-rotation-backend.md`

---

### Task 1: Типы — `GardenBed`, `bed_id`, `family`

**Files:**
- Modify: `web/src/api/types.ts`

- [ ] **Step 1: Добавить тип грядки и истории посадок**

В `web/src/api/types.ts`, сразу после `export interface Garden { ... }` (строки 28-36), добавить:

```ts
export interface BedHistoryEntry {
  crop_name: string
  family: string | null
  year: number
}

export interface GardenBed {
  id: number
  garden_id: number
  name: string
  type: 'soil' | 'greenhouse'
  history: BedHistoryEntry[]
}
```

- [ ] **Step 2: Добавить `bed_id` в `Planting` и `family` в `Crop`**

В `Planting` (строки 52-70) добавить поле после `variety`:

```ts
export interface Planting {
  id: number
  garden_id: number
  crop_id: number
  crop_name?: string
  stage: PlantingStage
  conditions?: 'soil' | 'greenhouse'
  sowing_method?: 'seedling' | 'direct'
  variety?: string | null
  bed_id?: number | null
  quantity?: number
  planted_at?: string
  yield_per_plant_kg?: number | null
  watering_freq_days?: number | null
  harvest_days?: number | null
  last_action_at?: string | null
  last_action_type?: string | null
  next_care_task?: NextCareTask | null
  overdue_care_task?: OverdueCareTask | null
}
```

В `Crop` (строки 189-213) добавить поле после `category`:

```ts
export interface Crop {
  id: number
  name: string
  category?: string | null
  family?: string | null
  image_url?: string | null
  image_credit?: string | null
  is_perennial?: boolean
  sowing_start_day?: number | null
  sowing_end_day?: number | null
  transplant_days?: number | null
  harvest_days?: number | null
  watering_freq_days?: number | null
  frost_sensitive?: boolean
  yield_per_plant_kg?: number | null
  notes?: string | null
  care_tasks?: CareTask[] | null
  good_neighbors?: string[] | null
  bad_neighbors?: string[] | null
  good_predecessors?: string[] | null
  diseases?: CropDisease[] | null
  pests?: CropPest[] | null
  watering_details?: WateringDetails | null
  fertilizing_schedule?: FertilizingEntry[] | null
  climate_zones?: Record<string, ClimateZoneWindow> | null
}
```

- [ ] **Step 3: Добавить `bed_id` в `CreatePlantingRequest` и новый `UpdatePlantingInfoRequest`**

`CreatePlantingRequest` (строки 250-258) — добавить `bed_id`:

```ts
export interface CreatePlantingRequest {
  garden_id: number
  crop_id: number
  planted_at?: string
  quantity?: number
  conditions?: 'soil' | 'greenhouse'
  sowing_method?: 'seedling' | 'direct'
  variety?: string
  bed_id?: number
}
```

Сразу после неё добавить новый тип (используется в Task 5 для `PATCH /plantings/:id/info`):

```ts
export interface UpdatePlantingInfoRequest {
  planted_at?: string
  quantity?: number
  conditions?: 'soil' | 'greenhouse'
  sowing_method?: 'seedling' | 'direct'
  variety?: string
  bed_id?: number
}
```

- [ ] **Step 4: Типчек**

Run: `cd web && npm run typecheck`
Expected: PASS (новые типы только добавляют поля, ничего не ломают; `client.ts` их пока не использует).

- [ ] **Step 5: Commit**

```bash
git add web/src/api/types.ts
git commit -m "feat(web): добавить типы GardenBed, bed_id, crops.family"
```

---

### Task 2: API-клиент — эндпоинты грядок и `updatePlantingInfo`

**Files:**
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: Импортировать новые типы**

В `web/src/api/client.ts`, в блоке `import type { ... } from './types'` (строки 2-24), добавить
`GardenBed` и `UpdatePlantingInfoRequest` в алфавитном порядке существующего списка:

```ts
import type {
  ActionLog,
  AnalyticsSummary,
  AuthResponse,
  BillingPlan,
  CreateGardenRequest,
  CreatePaymentResponse,
  CreatePlantingRequest,
  Crop,
  FeedResponse,
  Garden,
  GardenBed,
  GeocodeSuggestion,
  GuideEntry,
  GuideEntryDetail,
  GuideKind,
  Harvest,
  Planting,
  PlantingPhoto,
  PlantingStage,
  Recommendation,
  TodayResponse,
  UpdatePlantingInfoRequest,
  UserProfile,
} from './types'
```

- [ ] **Step 2: Добавить эндпоинты грядок в секцию `// --- gardens ---`**

После `geocodeSuggest` (строки 114-115) добавить:

```ts
  getBeds: (gardenId: number) => request<GardenBed[]>(`/gardens/${gardenId}/beds`),
  createBed: (gardenId: number, body: { name: string; type: 'soil' | 'greenhouse' }) =>
    request<GardenBed>(`/gardens/${gardenId}/beds`, { method: 'POST', body: body as unknown as Record<string, unknown> }),
  updateBed: (id: number, body: { name?: string; type?: 'soil' | 'greenhouse' }) =>
    request<GardenBed>(`/beds/${id}`, { method: 'PATCH', body: body as unknown as Record<string, unknown> }),
  deleteBed: (id: number) =>
    request<{ deleted: boolean }>(`/beds/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 3: Добавить `updatePlantingInfo` в секцию `// --- plantings ---`**

После `updateStage` (строки 137-138) добавить:

```ts
  updatePlantingInfo: (id: number, body: UpdatePlantingInfoRequest) =>
    request<Planting>(`/plantings/${id}/info`, { method: 'PATCH', body: body as unknown as Record<string, unknown> }),
```

- [ ] **Step 4: Типчек**

Run: `cd web && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Ручная проверка эндпоинтов**

Run: `cd web && npm run dev`, затем в консоли браузера на залогиненной странице (DevTools → Console):
```js
await fetch('/api/gardens/1/beds', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }).then(r => r.json())
```
Expected: `200` и `[]` (или список грядок, если на тест-аккаунте уже что-то создавали через API напрямую) —
подтверждает, что бэкенд-роут жив и путь в клиенте верный. (Имя ключа в `localStorage` — проверить через
`web/src/auth/storage.ts`, если `token` не подходит.)

- [ ] **Step 6: Commit**

```bash
git add web/src/api/client.ts
git commit -m "feat(web): API-клиент для грядок и PATCH /plantings/:id/info"
```

---

### Task 3: Компонент `BedField` — пикер грядки

**Files:**
- Create: `web/src/components/BedField.tsx`

- [ ] **Step 1: Написать компонент**

Создать `web/src/components/BedField.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '../api/client'
import type { GardenBed } from '../api/types'

interface Props {
  gardenId: number
  value: number | null
  cropFamily?: string | null
  onSelect: (bed: GardenBed | null) => void
}

// Грядка — просто именованное место (см. design 2026-06-27), без визуальной карты участка.
// Пикер открывается инлайн в той же форме/секции — отдельного экрана управления грядками нет.
export default function BedField({ gardenId, value, cropFamily, onSelect }: Props) {
  const [beds, setBeds] = useState<GardenBed[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'soil' | 'greenhouse'>('soil')
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const load = async () => {
    try {
      const list = await api.getBeds(gardenId)
      setBeds(list)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить грядки')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gardenId])

  const selectedBed = beds.find((b) => b.id === value) ?? null

  const pick = (bed: GardenBed | null) => {
    onSelect(bed)
    setOpen(false)
  }

  const submitCreate = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const bed = await api.createBed(gardenId, { name, type: newType })
      setBeds((prev) => [...prev, bed])
      setNewName('')
      setNewType('soil')
      setCreating(false)
      pick(bed)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать грядку')
    }
  }

  const startRename = (bed: GardenBed) => {
    setRenamingId(bed.id)
    setRenameValue(bed.name)
  }

  const submitRename = async (bed: GardenBed) => {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name || name === bed.name) return
    try {
      const updated = await api.updateBed(bed.id, { name })
      setBeds((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)))
      if (value === bed.id) onSelect({ ...bed, ...updated })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось переименовать грядку')
    }
  }

  const removeBed = async (bed: GardenBed) => {
    if (!confirm(`Удалить грядку «${bed.name}»?`)) return
    try {
      await api.deleteBed(bed.id)
      setBeds((prev) => prev.filter((b) => b.id !== bed.id))
      if (value === bed.id) pick(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить грядку')
    }
  }

  const warning = rotationWarning(selectedBed, cropFamily)

  return (
    <div className="relative">
      <button
        type="button"
        className="dacha-input flex items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selectedBed ? '' : 'text-muted'}>
          {selectedBed ? selectedBed.name : 'Не выбрано'}
        </span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-card border border-black/10 bg-white p-2 shadow-lg">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(null)}
            className={`block w-full rounded-btn px-3 py-2 text-left text-sm font-semibold hover:bg-background ${
              value === null ? 'bg-primary/10 text-primary' : ''
            }`}
          >
            Не выбрано
          </button>

          <div className="max-h-48 overflow-y-auto">
            {beds.map((bed) => (
              <div key={bed.id} className="flex items-center gap-1">
                {renamingId === bed.id ? (
                  <input
                    autoFocus
                    className="dacha-input flex-1 py-1.5 text-sm"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => submitRename(bed)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename(bed)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(bed)}
                    className={`block flex-1 rounded-btn px-3 py-2 text-left text-sm font-semibold hover:bg-background ${
                      bed.id === value ? 'bg-primary/10 text-primary' : ''
                    }`}
                  >
                    {bed.name}{' '}
                    <span className="text-xs text-muted">
                      {bed.type === 'greenhouse' ? '· теплица' : '· грунт'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Переименовать"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => startRename(bed)}
                  className="rounded-btn p-1.5 text-muted hover:bg-background"
                >
                  <Pencil size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Удалить"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => removeBed(bed)}
                  className="rounded-btn p-1.5 text-muted hover:bg-background"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            ))}
          </div>

          {creating ? (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-black/10 pt-2">
              <input
                autoFocus
                className="dacha-input py-1.5 text-sm"
                placeholder="Название грядки"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className="flex gap-1.5">
                {(['soil', 'greenhouse'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    className={`dacha-chip ${newType === t ? 'dacha-chip-active' : ''}`}
                    onClick={() => setNewType(t)}
                  >
                    {t === 'soil' ? 'Грунт' : 'Теплица'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="dacha-chip flex-1 py-1.5 text-sm"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setCreating(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="dacha-btn flex-1 py-1.5 text-sm"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={submitCreate}
                >
                  Добавить
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCreating(true)}
              className="mt-1 flex w-full items-center gap-1.5 rounded-btn px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-background"
            >
              <Plus size={14} aria-hidden /> Новая грядка
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
      {warning && <p className="mt-1 text-xs font-semibold text-amber-700">{warning}</p>}
    </div>
  )
}

// Сравнение по семейству за 3 года истории грядки (история уже приходит с грядкой одним запросом).
function rotationWarning(bed: GardenBed | null, cropFamily?: string | null): string | null {
  if (!bed || !cropFamily) return null
  const match = [...bed.history]
    .filter((h) => h.family === cropFamily)
    .sort((a, b) => b.year - a.year)[0]
  if (!match) return null
  return `На грядке «${bed.name}» в ${match.year} росла культура семейства «${cropFamily}» (${match.crop_name}) — для этого семейства рекомендуют перерыв 3–4 года.`
}
```

- [ ] **Step 2: Типчек**

Run: `cd web && npm run typecheck`
Expected: PASS. Компонент пока нигде не используется (unused-import предупреждений по нему быть не должно
— проверить, что `tsc` не ругается на неиспользуемые локальные переменные внутри файла).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/BedField.tsx
git commit -m "feat(web): компонент BedField — пикер грядки с инлайн-созданием и подсказкой севооборота"
```

---

### Task 4: Встроить в форму создания посадки

**Files:**
- Modify: `web/src/components/AddPlantingForm.tsx`

- [ ] **Step 1: Импортировать `BedField`, добавить состояние `bedId`**

В `web/src/components/AddPlantingForm.tsx` добавить импорт (после `import type { Crop } from '../api/types'`,
строка 7):

```tsx
import BedField from './BedField'
```

После `const [conditions, setConditions] = useState<'soil' | 'greenhouse'>('soil')` (строка 22) добавить:

```tsx
  const [bedId, setBedId] = useState<number | null>(null)
```

- [ ] **Step 2: Включить `bed_id` в payload `submit`**

Заменить блок `await api.createPlanting({...})` (строки 72-80) на:

```tsx
      await api.createPlanting({
        garden_id: gardenId,
        crop_id: cropId,
        planted_at: plantedAt,
        quantity,
        conditions,
        sowing_method: sowingMethod,
        variety: variety.trim() || undefined,
        bed_id: bedId ?? undefined,
      })
```

- [ ] **Step 3: Добавить поле «Место» в разметку между «Сорт» и «Дата посадки»**

После блока `<label className="mt-2 text-sm font-bold text-muted">Сорт (необязательно)</label>` и его
`<input>` (строки 175-183), перед `<label className="mt-2 text-sm font-bold text-muted">Дата посадки</label>`
(строка 185), вставить:

```tsx
          <label className="mt-2 text-sm font-bold text-muted">Место (необязательно)</label>
          <BedField
            gardenId={gardenId}
            value={bedId}
            cropFamily={selectedCrop?.family}
            onSelect={(bed) => {
              setBedId(bed?.id ?? null)
              if (bed) setConditions(bed.type)
            }}
          />
```

(Порядок полей формы становится: Культура → Сорт → **Место** → Дата посадки → Количество → Условия —
немного отличается от спеки, где «Место» между «Культура» и «Условия» без привязки к «Сорту»/«Дате»;
порядок «Место» относительно «Условия» — главное требование спеки, выполнено: причина (Место) выше
следствия (Условия).)

- [ ] **Step 4: Типчек**

Run: `cd web && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Ручная проверка**

Run: `cd web && npm run dev`, открыть `/plantings`, нажать «+ Добавить».
Expected:
- Поле «Место» отображается со значением «Не выбрано».
- Клик открывает список (пустой, если грядок ещё нет) + пункт «+ Новая грядка».
- Клик «+ Новая грядка» → ввести имя → выбрать «Теплица» → «Добавить» → грядка появляется выбранной,
  поле «Условия» ниже автоматически переключается на «Теплица».
- Клик на «Условия» → «Грунт» — переключается вручную поверх автоподстановки (как в спеке).
- Сохранить посадку — в Network видно `POST /plantings` с `bed_id` в теле запроса.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/AddPlantingForm.tsx
git commit -m "feat(web): поле «Место» в форме создания посадки"
```

---

### Task 5: Встроить в экран деталей посадки (просмотр/правка задним числом)

**Files:**
- Modify: `web/src/screens/PlantingDetailScreen.tsx`

- [ ] **Step 1: Импорты и состояние**

В `web/src/screens/PlantingDetailScreen.tsx` добавить импорт `BedField` и тип `GardenBed` (рядом со
строкой 11, `import type { ActionLog, Crop, GuideEntry, Planting } from '../api/types'`):

```tsx
import BedField from '../components/BedField'
import type { ActionLog, Crop, GardenBed, GuideEntry, Planting } from '../api/types'
```

После `const [photoRefresh, setPhotoRefresh] = useState(0)` (строка 36) добавить:

```tsx
  const [beds, setBeds] = useState<GardenBed[]>([])
  const [editingBed, setEditingBed] = useState(false)
```

- [ ] **Step 2: Подгрузить грядки участка вместе с посадкой**

Заменить функцию `load` (строки 38-51) на:

```tsx
  const load = async () => {
    try {
      const [p, a] = await Promise.all([api.getPlanting(plantingId), api.getActions(plantingId)])
      setPlanting(p)
      setActions(a)
      const c = await api.getCrop(p.crop_id).catch(() => null)
      setCrop(c)
      api.getGuide({ crop_id: p.crop_id }).then(setProblems).catch(() => setProblems([]))
      api.getBeds(p.garden_id).then(setBeds).catch(() => setBeds([]))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить посадку')
    } finally {
      setLoading(false)
    }
  }
```

- [ ] **Step 3: Добавить секцию «Место» под строкой условий в карточке**

Заменить блок (строки 115-119):

```tsx
        {planting.variety && <p className="font-bold text-tertiary">Сорт: {planting.variety}</p>}
        <p className="font-semibold text-muted">
          Посажено {formatDate(planting.planted_at)} · {planting.quantity ?? 1} шт.
          {planting.conditions === 'greenhouse' ? ' · теплица' : ''}
        </p>
```

на:

```tsx
        {planting.variety && <p className="font-bold text-tertiary">Сорт: {planting.variety}</p>}
        <p className="font-semibold text-muted">
          Посажено {formatDate(planting.planted_at)} · {planting.quantity ?? 1} шт.
          {planting.conditions === 'greenhouse' ? ' · теплица' : ''}
        </p>
        {editingBed ? (
          <BedField
            gardenId={planting.garden_id}
            value={planting.bed_id ?? null}
            cropFamily={crop?.family}
            onSelect={async (bed) => {
              setEditingBed(false)
              try {
                const updated = await api.updatePlantingInfo(planting.id, { bed_id: bed?.id ?? undefined })
                setPlanting(updated)
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Не удалось обновить место')
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="flex items-center gap-1 text-left font-semibold text-muted"
            onClick={() => setEditingBed(true)}
          >
            <Pencil size={14} aria-hidden />
            Место: {beds.find((b) => b.id === planting.bed_id)?.name ?? 'не выбрано'}
          </button>
        )}
```

- [ ] **Step 4: Типчек**

Run: `cd web && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Ручная проверка**

Run: `cd web && npm run dev`, открыть карточку любой посадки.
Expected:
- Строка «Место: не выбрано» (или имя грядки, если выбрана при создании) с иконкой карандаша.
- Клик открывает `BedField` на этом же месте, можно выбрать существующую/создать новую грядку.
- После выбора — `PATCH /plantings/:id/info` в Network с `bed_id`, карточка возвращается в режим
  просмотра с обновлённым именем грядки.
- Старая посадка без «Места» (`bed_id: null`) — никаких предупреждений о севообороте не показывается
  (нечего сравнивать), поведение прежнее.

- [ ] **Step 6: Commit**

```bash
git add web/src/screens/PlantingDetailScreen.tsx
git commit -m "feat(web): просмотр и правка «Места» (грядки) на экране деталей посадки"
```

---

### Task 6: Итоговый ручной прогон по сценариям спеки

**Files:** нет новых — финальная проверка перед закрытием фичи.

- [ ] **Step 1: Полный прогон по чек-листу спеки**

Run: `cd web && npm run dev`, пройти на тест-аккаунте:
1. Создать культуру с известным семейством (например, Томат, `family: 'Паслёновые'`) на новой грядке
   «Теплица 1» (тип теплица) — сохранить с датой посадки в прошлом году.
2. Создать вторую посадку Перца (тоже «Паслёновые») и выбрать ту же грядку «Теплица 1» — под полем
   «Место» должно появиться предупреждение о севообороте с упоминанием года и культуры из истории.
3. Выбрать культуру другого семейства (например, Огурец, «Тыквенные») на той же грядке — предупреждения
   быть не должно.
4. Переименовать «Теплица 1» в «Теплица у забора» через иконку карандаша в списке грядок — название
   обновляется в обоих местах (форма создания и детали уже сохранённой посадки).
5. Удалить грядку без истории — пропадает из списка, посадки с `bed_id` на неё (если есть) не падают
   (бэкенд: `ON DELETE SET NULL`); открыть такую посадку — «Место: не выбрано».
6. Создать посадку вовсе без «Места» — сохраняется как раньше, в деталях «Место: не выбрано», без ошибок.

- [ ] **Step 2: Финальный typecheck и build**

Run: `cd web && npm run build`
Expected: сборка проходит без ошибок типов (включает `tsc -b` перед `vite build`).

- [ ] **Step 3: Commit (если за Task 6 были правки по результатам QA)**

```bash
git add -A
git commit -m "fix(web): правки по итогам ручного QA грядок"
```

(Если правок не было — коммит не нужен, таск закрывается чек-листом выше.)

---

## Self-review

- **Покрытие спеки (раздел 3, веб-часть):** поле «Место» между Культурой и Условиями — Task 4; инлайн
  «+ Новая грядка» с чипами Грунт/Теплица — Task 3; переименование/удаление иконкой в списке (веб-вариант
  long-press) — Task 3; авто-подстановка «Условия» с возможностью переопределить вручную — Task 4 Step 3;
  мягкое предупреждение о севообороте — Task 3 (`rotationWarning`); поле необязательно, старые посадки не
  ломаются — Task 4/5/6; просмотр/правка «Места» задним числом на экране посадки — Task 5. Раздел «Что НЕ
  делаем» (визуальная карта участка) — сознательно не реализовано, плана на это нет.
- **Плейсхолдеров нет** — каждый код-блок исполняемый.
- **Согласованность типов:** `GardenBed`, `bed_id`, `BedHistoryEntry`, `UpdatePlantingInfoRequest` —
  одинаковые имена и формы во всех тасках (Task 1 определяет → Task 2-5 используют без расхождений).
- **Источник правды для имени грядки:** на экране деталей имя резолвится клиентом из `GET /gardens/:id/beds`
  (Task 5), а не приходит вместе с посадкой — `GET /plantings/:id` отдаёт только `bed_id` (бэкенд не менялся,
  это вне рамок этого плана).
