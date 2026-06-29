import type { ActionType, GuideKind, PlantingStage } from './types'

export const STAGE_LABELS: Record<PlantingStage, string> = {
  sowing: 'Посев',
  transplanted: 'Высажено в грунт',
  growing: 'Растёт',
  flowering: 'Цветение',
  harvesting: 'Плодоношение',
  done: 'Завершено',
}

export const ACTION_LABELS: Record<ActionType, string> = {
  watering: 'Полив',
  fertilizing: 'Подкормка',
  treatment: 'Обработка',
  other: 'Другое',
}

export const ACTION_TYPES: ActionType[] = ['watering', 'fertilizing', 'treatment', 'other']

// Полный каталог действий для записи (зеркало android ACTION_TYPES). Иконки — ui/icons.tsx actionIcon().
export const ACTION_CATALOG: { type: string; label: string }[] = [
  { type: 'watering', label: 'Полив' },
  { type: 'fertilizing', label: 'Подкормка' },
  { type: 'treatment', label: 'Обработка' },
  { type: 'pricking_out', label: 'Пикировка' },
  { type: 'transplanting', label: 'Высадка' },
  { type: 'tying', label: 'Подвязка' },
  { type: 'pinching', label: 'Пасынкование' },
  { type: 'hilling', label: 'Окучивание' },
  { type: 'pruning', label: 'Обрезка' },
  { type: 'weeding', label: 'Прополка' },
  { type: 'loosening', label: 'Рыхление' },
  { type: 'thinning', label: 'Прореживание' },
  { type: 'runner_removal', label: 'Удаление усов' },
  { type: 'bolt_removal', label: 'Удаление стрелок' },
  { type: 'deflowering', label: 'Удаление цветков' },
  { type: 'staking', label: 'Установка опоры' },
  { type: 'other', label: 'Другое' },
  { type: 'harvest', label: 'Сбор урожая' },
]

// Полная карта для отображения (включая care-действия из backend для журнала/истории).
// Источник — ACTION_CATALOG (единый список всех типов действий), чтобы не дублировать
// и не забывать типы при добавлении новых (так уже было с transplanting/pricking_out).
const ALL_ACTION_LABELS: Record<string, string> = Object.fromEntries(
  ACTION_CATALOG.map((a) => [a.type, a.label]),
)

export function actionLabel(type: string): string {
  return ALL_ACTION_LABELS[type] ?? type
}

// Категории культур (в БД на английском)
export const CATEGORY_LABELS: Record<string, string> = {
  vegetable: 'Овощи',
  herb: 'Зелень',
  berry: 'Ягоды',
  shrub: 'Кусты',
  tree: 'Деревья',
  flower: 'Цветы',
  fruit: 'Фрукты',
  green: 'Зелень',
}

export function categoryLabel(cat?: string | null): string {
  if (!cat) return ''
  return CATEGORY_LABELS[cat] ?? cat
}

// Справочник проблем растений
export const GUIDE_KIND_LABELS: Record<GuideKind, string> = {
  deficiency: 'Дефицит',
  disease: 'Болезнь',
  pest: 'Вредитель',
}

// ISO/Date → DD.MM.YYYY
export function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU')
}
