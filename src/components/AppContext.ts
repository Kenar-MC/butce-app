import { createContext, useContext } from 'react'
import type { Transaction } from '../db/types'

export interface AppCtx {
  /** Seçili ay 'YYYY-MM' — Özet ve İşlemler ortak kullanır */
  month: string
  setMonth: (m: string) => void
  /** İşlem formunu açar; tx verilirse düzenleme */
  openTx: (tx?: Transaction) => void
}

export const AppContext = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside Layout')
  return ctx
}
