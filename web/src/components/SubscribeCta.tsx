import { Link } from 'react-router-dom'
import { PLAN_LIMIT_MESSAGE, PLANTING_LOCKED_MESSAGE, SUBSCRIPTION_REQUIRED_MESSAGE } from '../api/client'

const SUBSCRIPTION_MESSAGES = [SUBSCRIPTION_REQUIRED_MESSAGE, PLAN_LIMIT_MESSAGE, PLANTING_LOCKED_MESSAGE]

// Ссылка на оплату, которую показываем рядом с текстом ошибки внутри форм/модалок
// (где полноразмерная ErrorCard не подходит по месту).
export default function SubscribeCta({ message }: { message: string }) {
  if (!SUBSCRIPTION_MESSAGES.includes(message)) return null
  return (
    <Link to="/paywall" className="text-sm font-bold text-link underline">
      Оформить подписку →
    </Link>
  )
}
