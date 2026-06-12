import type { ActionType, PlantingStage } from './types'

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

// Полная карта для отображения (включая care-действия из backend для журнала/истории).
const ALL_ACTION_LABELS: Record<string, string> = {
  ...ACTION_LABELS,
  tying: 'Подвязка',
  pinching: 'Пасынкование',
  hilling: 'Окучивание',
  pruning: 'Обрезка',
  weeding: 'Прополка',
  loosening: 'Рыхление',
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

// ISO/Date → DD.MM.YYYY
export function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU')
}
