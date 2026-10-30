import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import type { Transaction } from '../db/types'
import { monthKey, todayISO } from '../domain/dates'
import TransactionSheet from '../features/transactions/TransactionSheet'
import { AppContext } from './AppContext'

const NAV = [
  { to: '/', label: 'Özet', icon: '📊' },
  { to: '/islemler', label: 'İşlemler', icon: '📋' },
  { to: '/hesaplar', label: 'Hesaplar', icon: '💳' },
  { to: '/butce', label: 'Bütçe', icon: '🎯' },
  { to: '/ayarlar', label: 'Ayarlar', icon: '⚙️' },
]

export default function Layout() {
  const [month, setMonth] = useState(() => monthKey(todayISO()))
  const [sheet, setSheet] = useState<{ tx?: Transaction } | null>(null)
  const ctx = useMemo(() => ({ month, setMonth, openTx: (tx?: Transaction) => setSheet({ tx }) }), [month])

  return (
    <AppContext.Provider value={ctx}>
      <div className="min-h-dvh md:flex">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-zinc-200 p-4 md:flex dark:border-zinc-800">
          <div className="mb-4 px-3 text-lg font-bold">💰 Bütçe</div>
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

        <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
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

        <Link
          to="/ice-aktar"
          aria-label="Ekstre / bakiye içe aktar"
          title="Ekstre / bakiye içe aktar"
          className="fixed right-5 bottom-[calc(8.75rem+env(safe-area-inset-bottom))] z-20 grid size-12 place-items-center rounded-full bg-white text-emerald-700 shadow-lg ring-1 ring-zinc-200 hover:bg-emerald-50 active:scale-95 md:right-9 md:bottom-[6.25rem] dark:bg-zinc-800 dark:text-emerald-300 dark:ring-zinc-700"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m21 16-5-5-9 9" />
          </svg>
        </Link>

        <button
          aria-label="Yeni işlem"
          onClick={() => setSheet({})}
          className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 grid size-14 place-items-center rounded-full bg-emerald-600 text-3xl text-white shadow-lg hover:bg-emerald-700 active:scale-95 md:right-8 md:bottom-8"
        >
          +
        </button>

        {sheet && <TransactionSheet tx={sheet.tx} onClose={() => setSheet(null)} />}
      </div>
    </AppContext.Provider>
  )
}
