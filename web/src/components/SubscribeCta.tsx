import { Link } from 'react-router-dom'
import { PLAN_LIMIT_MESSAGE, SUBSCRIPTION_REQUIRED_MESSAGE } from '../api/client'

// Ссылка на оплату, которую показываем рядом с текстом ошибки внутри форм/модалок
// (где полноразмерная ErrorCard не подходит по месту).
export default function SubscribeCta({ message }: { message: string }) {
  if (message !== SUBSCRIPTION_REQUIRED_MESSAGE && message !== PLAN_LIMIT_MESSAGE) return null
  return (
    <Link to="/paywall" className="text-sm font-bold text-link underline">
      Оформить подписку →
    </Link>
  )
}
