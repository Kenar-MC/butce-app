import { createContext, useContext } from 'react'
import type { Transaction } from '../db/types'

export interface AppCtx {
  /** Seçili ay 'YYYY-MM' — varsayılan: verisi olan son ay */
  month: string
  setMonth: (m: string) => void
  /** Verisi olan aylar (eskiden yeniye) */
  months: string[]
  /** Kart filtresi; '' = tüm kartlar */
  cardId: string
  setCardId: (id: string) => void
  /** Satır ayrıntısını açar (kategori değiştir / sil) */
  openTx: (tx: Transaction) => void
}

export const AppContext = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside Layout')
  return ctx
}
