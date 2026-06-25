import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled'))
}

// Общая a11y-логика модального диалога: фокус на первый элемент при открытии, Tab/Shift+Tab
// не выходит за пределы диалога, Escape закрывает, фокус возвращается на элемент-триггер
// при закрытии. Раньше ни одна модалка в приложении этого не делала — клавиатурный
// пользователь мог Tab'ом выйти «за» видимый диалог, а Escape не закрывал ничего.
export function useModalA11y(ref: RefObject<HTMLElement | null>, onClose: () => void, active = true) {
  // onClose обычно приходит как новая инлайн-функция на каждый рендер родителя. Если положить
  // её в deps эффекта, setup/teardown (а с ним и захват фокуса) будет перезапускаться на КАЖДЫЙ
  // такой рендер, а не только при открытии/закрытии — фокус будет дёргаться обратно на диалог
  // при любом несвязанном обновлении состояния родителя, пока диалог открыт. Ref с «последним»
  // onClose решает это: эффект перезапускается только по `active`.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!active) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const container = ref.current
    if (container) getFocusable(container)[0]?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !container) return
      const items = getFocusable(container)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ref])
}

// Карточка по центру экрана с тёмным фоном — общий паттерн подтверждений/форм
// (DeleteAccountModal, ChangeEmailModal, ChangePasswordModal, AddPlantingForm, и т.п.).
export default function Modal({
  onClose,
  className = '',
  backdropClassName = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4',
  children,
}: {
  onClose: () => void
  className?: string
  backdropClassName?: string
  children: ReactNode
}) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  useModalA11y(cardRef, onClose)

  return (
    <div className={backdropClassName} onClick={onClose}>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        className={`dacha-card ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
