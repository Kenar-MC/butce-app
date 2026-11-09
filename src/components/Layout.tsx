import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import mascot from '../assets/mascot.webp'
import { db } from '../db/db'
import type { Transaction } from '../db/types'
import { monthKey, todayISO } from '../domain/dates'
import TxSheet from '../features/statements/TxSheet'
import { AppContext } from './AppContext'

const NAV = [
  { to: '/', label: 'Özet', icon: '📊' },
  { to: '/trend', label: 'Trend', icon: '📈' },
  { to: '/ekstreler', label: 'Ekstreler', icon: '🧾' },
  { to: '/ayarlar', label: 'Ayarlar', icon: '⚙️' },
]
const NO_MONTHS: string[] = []

export default function Layout() {
  // Not: Safari'de boş tabloda imleçli sorgular (uniqueKeys, each, filter) "Unable to open cursor" ile çöküyor;
  // bu yüzden veritabanında sadece toArray / where().equals() / get / count kullanılır (K16).
  const months =
    useLiveQuery(async () => [...new Set((await db.statements.toArray()).map((s) => s.month))].sort()) ?? NO_MONTHS
  const [picked, setPicked] = useState<string | null>(null)
  const [cardId, setCardId] = useState('')
  const [tx, setTx] = useState<Transaction | null>(null)
  const { pathname } = useLocation()

  // Seçilmediyse verisi olan son ay (yoksa bu ay)
  const month = picked ?? months[months.length - 1] ?? monthKey(todayISO())
  const ctx = useMemo(() => ({ month, setMonth: setPicked, months, cardId, setCardId, openTx: setTx }), [month, months, cardId])

  return (
    <AppContext.Provider value={ctx}>
      <div className="min-h-dvh md:flex">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-zinc-200 p-4 md:flex dark:border-zinc-800">
          <div className="mb-4 flex items-center gap-2 px-2 text-lg font-extrabold text-emerald-800 dark:text-emerald-300">
            <img src={mascot} alt="" className="size-9 rounded-xl" />
            Bütçe
          </div>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-xl px-3 ${isActive ? 'bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'}`
              }
            >
              <span>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </aside>

        <main className="mx-auto w-full max-w-3xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28 md:pb-10">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center text-xs ${isActive ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`
              }
            >
              <span className="text-xl leading-none">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        {pathname !== '/ice-aktar' && (
          <Link
            to="/ice-aktar"
            aria-label="Ekstre yükle"
            title="Ekstre yükle"
            className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 grid size-14 place-items-center rounded-full bg-emerald-600 text-gold-300 shadow-lg ring-2 ring-emerald-900/40 hover:bg-emerald-700 active:scale-95 md:right-8 md:bottom-8"
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5" />
              <path d="M12 17v-6" />
              <path d="m9 14 3-3 3 3" />
            </svg>
          </Link>
        )}

        {tx && <TxSheet tx={tx} onClose={() => setTx(null)} />}
      </div>
    </AppContext.Provider>
  )
}
