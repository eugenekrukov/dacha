import { useEffect, useState } from 'react'
import { tokenStore } from '../auth/storage'
import { BASE } from '../api/client'

interface Props {
  path: string            // относительный url из API (например /photos/file/10?thumb=1)
  alt: string
  className?: string
}

// Приватные фото отдаются по Bearer (X-Accel-Redirect на бэкенде), поэтому обычный
// <img src> не подходит — тянем blob с токеном и показываем через object URL.
export default function AuthImage({ path, alt, className }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    const token = tokenStore.getToken()
    fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob() })
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setSrc(url)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [path])

  if (failed) return (
    <div role="img" aria-label="Не удалось загрузить фото" className={`flex items-center justify-center bg-black/5 text-xs text-muted ${className ?? ''}`}>—</div>
  )
  if (!src) return <div className={`animate-pulse bg-black/5 ${className ?? ''}`} />
  return <img src={src} alt={alt} className={className} />
}
