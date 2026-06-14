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

// Полный каталог действий для записи (зеркало android ACTION_TYPES + actionIcon).
export const ACTION_CATALOG: { type: string; label: string; icon: string }[] = [
  { type: 'watering', label: 'Полив', icon: '💧' },
  { type: 'fertilizing', label: 'Подкормка', icon: '🌿' },
  { type: 'treatment', label: 'Обработка', icon: '🛡️' },
  { type: 'pricking_out', label: 'Пикировка', icon: '🌱' },
  { type: 'transplanting', label: 'Высадка', icon: '🪴' },
  { type: 'tying', label: 'Подвязка', icon: '🪢' },
  { type: 'pinching', label: 'Пасынкование', icon: '✂️' },
  { type: 'hilling', label: 'Окучивание', icon: '⛏️' },
  { type: 'pruning', label: 'Обрезка', icon: '🌿' },
  { type: 'weeding', label: 'Прополка', icon: '🌾' },
  { type: 'loosening', label: 'Рыхление', icon: '🔨' },
  { type: 'thinning', label: 'Прореживание', icon: '✂️' },
  { type: 'runner_removal', label: 'Удаление усов', icon: '🌿' },
  { type: 'bolt_removal', label: 'Удаление стрелок', icon: '🧄' },
  { type: 'deflowering', label: 'Удаление цветков', icon: '🌸' },
  { type: 'staking', label: 'Установка опоры', icon: '🪵' },
  { type: 'other', label: 'Другое', icon: '📋' },
]

// Полная карта для отображения (включая care-действия из backend для журнала/истории).
const ALL_ACTION_LABELS: Record<string, string> = {
  ...ACTION_LABELS,
  tying: 'Подвязка',
  pinching: 'Пасынкование',
  hilling: 'Окучивание',
  pruning: 'Обрезка',
  weeding: 'Прополка',
  loosening: 'Рыхление',
  thinning: 'Прореживание',
  runner_removal: 'Удаление усов',
  bolt_removal: 'Удаление стрелок',
  deflowering: 'Удаление цветков',
  staking: 'Установка опоры',
}

export function actionLabel(type: string): string {
  return ALL_ACTION_LABELS[type] ?? type
}

// Категории культур (в БД на английском)
export const CATEGORY_LABELS: Record<string, string> = {
  vegetable: 'Овощи',
  herb: 'Зелень',
  berry: 'Ягоды',
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

export const GUIDE_KIND_ICONS: Record<GuideKind, string> = {
  deficiency: '🍂',
  disease: '🦠',
  pest: '🐛',
}

// ISO/Date → DD.MM.YYYY
export function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU')
}
