import { Link } from 'react-router-dom'
import { SUBSCRIPTION_REQUIRED_MESSAGE } from '../api/client'

// Карточка ошибки для экранов-списков. Когда причина — истёкшая подписка/триал,
// показываем не просто текст, а кнопку «Оформить подписку» вместо тупика.
export default function ErrorCard({ message }: { message: string }) {
  const isSubscription = message === SUBSCRIPTION_REQUIRED_MESSAGE
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
