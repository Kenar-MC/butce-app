import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import mascot from '../../assets/mascot.webp'
import { Link } from 'react-router'
import { useApp } from '../../components/AppContext'
import { Money, MonthPicker } from '../../components/ui'
import { db } from '../../db/db'
import { ACCOUNT_TYPES, useAccounts, useBalances, useSetting } from '../../db/hooks'
import { monthRange } from '../../domain/dates'
import { totals } from '../../domain/reports'

export default function DashboardPage() {
  const { month, setMonth } = useApp()
  const accounts = useAccounts().filter((a) => !a.archived)
  const balances = useBalances(accounts)
  const txs = useLiveQuery(() => {
    const [start, end] = monthRange(month)
    return db.transactions.where('date').between(start, end, true, true).toArray()
  }, [month])
  const sum = totals(txs ?? [])
  const total = accounts.reduce((s, a) => s + (balances[a.id] ?? 0), 0)
  const lastBackupAt = useSetting<string>('lastBackupAt')
  const txCount = useLiveQuery(() => db.transactions.count()) ?? 0
  const [now] = useState(() => Date.now())
  const backupDays = lastBackupAt ? Math.floor((now - new Date(lastBackupAt).getTime()) / 86_400_000) : null
  const needBackup = txCount > 0 && (backupDays === null || backupDays >= 14)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <img src={mascot} alt="Bütçe maskotu" className="size-16 shrink-0 rounded-2xl shadow-md ring-2 ring-emerald-800/20" />
        <div className="min-w-0">
          <div className="text-xl font-extrabold tracking-tight text-emerald-800 dark:text-emerald-300">Bütçe</div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{quip(sum, txs?.length ?? 0)}</p>
        </div>
      </div>

      <MonthPicker month={month} onChange={setMonth} />

      {needBackup && (
        <Link to="/ayarlar" className="card flex items-center gap-3 border-amber-300 bg-amber-50 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <span className="text-xl">💾</span>
          <span className="flex-1">
            {backupDays === null ? 'Henüz yedek almadın.' : `Son yedek ${backupDays} gün önce.`} Veriler sadece bu cihazda; yedek almak için dokun.
          </span>
          <span aria-hidden>›</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card">
          <div className="text-sm text-zinc-500">Gelir</div>
          <Money value={sum.income} sign="income" className="text-lg font-bold" />
        </div>
        <div className="card">
          <div className="text-sm text-zinc-500">Gider</div>
          <Money value={sum.expense} sign="expense" className="text-lg font-bold" />
        </div>
        <div className="card col-span-2 sm:col-span-1">
          <div className="text-sm text-zinc-500">Net</div>
          <Money value={sum.net} className="text-lg font-bold" />
        </div>
      </div>

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Hesaplar</h2>
          <Link to="/hesaplar" className="text-sm text-emerald-600">Tümü ›</Link>
        </div>
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center gap-3">
            <span>{ACCOUNT_TYPES[a.type].icon}</span>
            <span className="flex-1">{a.name}</span>
            <Money value={balances[a.id] ?? 0} />
          </div>
        ))}
        <div className="flex justify-between border-t border-zinc-100 pt-3 font-semibold dark:border-zinc-800">
          <span>Toplam</span>
          <Money value={total} />
        </div>
      </section>

    </div>
  )
}

/** Maskotun ayın durumuna göre lafı */
function quip(sum: { income: number; expense: number }, count: number): string {
  if (!count) return 'Bu ay boş. Hadi, ilk harcamanı gir 👆'
  if (sum.income > 0 && sum.expense > sum.income) return 'Bu ay giderin gelirini geçti. Sana diyorum! 👆'
  if (sum.income === 0 && sum.expense > 0) return 'Harcama var, gelir yok. Gözüm üstünde 👀'
  if (sum.expense > sum.income * 0.8) return 'Sınırdasın, frene bas biraz.'
  return 'Şimdilik iyi gidiyorsun. Böyle devam ✨'
}
