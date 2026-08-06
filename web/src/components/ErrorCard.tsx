import { Link } from 'react-router-dom'
import { PLAN_LIMIT_MESSAGE, PLANTING_LOCKED_MESSAGE, SUBSCRIPTION_REQUIRED_MESSAGE } from '../api/client'

const SUBSCRIPTION_MESSAGES = [SUBSCRIPTION_REQUIRED_MESSAGE, PLAN_LIMIT_MESSAGE, PLANTING_LOCKED_MESSAGE]

// Карточка ошибки для экранов-списков. Когда причина — нет подписки или исчерпан
// free-лимит посадок, показываем не просто текст, а кнопку «Оформить подписку» вместо тупика.
export default function ErrorCard({ message }: { message: string }) {
  const isSubscription = SUBSCRIPTION_MESSAGES.includes(message)
  return (
    <div className="dacha-card flex flex-col gap-3 p-4 font-semibold text-muted">
      <p>{message}</p>
      {isSubscription && (
        <Link to="/paywall" className="dacha-btn self-start">
          Оформить подписку
        </Link>
      )}
    </div>
  )
}
