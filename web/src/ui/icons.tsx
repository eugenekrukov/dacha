// Единый набор векторных иконок (lucide) вместо системных эмодзи.
// Маппинги — зеркало Android ActionVisuals.kt / taskColor.
import {
  Droplet,
  Sprout,
  SprayCan,
  Shovel,
  Scissors,
  Pickaxe,
  Trash2,
  Flower2,
  Spline,
  ClipboardList,
  Wheat,
  Snowflake,
  Bell,
  Link2,
  Bug,
  Leaf,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'

// Тип действия (запись в журнал) → иконка
const ACTION_ICONS: Record<string, LucideIcon> = {
  watering: Droplet,
  fertilizing: Sprout,
  treatment: SprayCan,
  pricking_out: Sprout,
  transplanting: Shovel,
  tying: Link2,
  pinching: Scissors,
  hilling: Pickaxe,
  pruning: Scissors,
  weeding: Trash2,
  loosening: Shovel,
  thinning: Scissors,
  runner_removal: Scissors,
  bolt_removal: Scissors,
  deflowering: Flower2,
  staking: Spline,
  other: ClipboardList,
}

export function actionIcon(type: string): LucideIcon {
  return ACTION_ICONS[type] ?? ClipboardList
}

// Тип задачи дня → иконка
const TASK_ICONS: Record<string, LucideIcon> = {
  watering_due: Droplet,
  transplant_due: Shovel,
  fertilizing_due: Sprout,
  harvest_due: Wheat,
  frost_alert: Snowflake,
  reminder: Bell,
}

export function taskIcon(type: string, careType?: string | null): LucideIcon {
  if (type === 'care_task_due') return (careType && ACTION_ICONS[careType]) || Leaf
  return TASK_ICONS[type] ?? ClipboardList
}

// Вид проблемы в справочнике → иконка
export function guideKindIcon(kind: string): LucideIcon {
  if (kind === 'pest') return Bug
  if (kind === 'disease') return ShieldAlert
  return Leaf // deficiency
}
