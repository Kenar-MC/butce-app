import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { useApp } from '../../components/AppContext'
import { Money, MonthPicker } from '../../components/ui'
import { db } from '../../db/db'
import { ACCOUNT_TYPES, useAccounts, useBalances } from '../../db/hooks'
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

  return (
    <div className="space-y-4">
      <MonthPicker month={month} onChange={setMonth} />

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

      <p className="text-center text-sm text-zinc-500">Grafikler ve bütçe durumu Faz 4'te eklenecek.</p>
    </div>
  )
}
