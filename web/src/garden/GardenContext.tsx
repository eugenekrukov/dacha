import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { Garden } from '../api/types'
import { tokenStore } from '../auth/storage'

interface GardenState {
  gardens: Garden[]
  active: Garden | null
  gardenId: number
  loading: boolean
  reload: () => Promise<void>
}

const GardenCtx = createContext<GardenState | null>(null)

export function GardenProvider({ children }: { children: ReactNode }) {
  const [gardens, setGardens] = useState<Garden[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const list = await api.getGardens()
    setGardens(list)
    // gardens отсортированы по planting_count DESC → первый = активный (как в Android)
    if (list[0]) tokenStore.setGardenId(list[0].id)
  }, [])

  useEffect(() => {
    reload()
      .catch(() => setGardens([]))
      .finally(() => setLoading(false))
  }, [reload])

  const active = gardens[0] ?? null

  return (
    <GardenCtx.Provider
      value={{ gardens, active, gardenId: active?.id ?? -1, loading, reload }}
    >
      {children}
    </GardenCtx.Provider>
  )
}

export function useGardens() {
  const ctx = useContext(GardenCtx)
  if (!ctx) throw new Error('useGardens must be used within GardenProvider')
  return ctx
}
