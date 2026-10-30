import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useApp } from '../../components/AppContext'
import { Empty, Money, MonthPicker } from '../../components/ui'
import { db } from '../../db/db'
import { byId, useAccounts, useCategories } from '../../db/hooks'
import type { Transaction, TxType } from '../../db/types'
import { formatDayTR, monthRange } from '../../domain/dates'
import { totals } from '../../domain/reports'

export default function TransactionsPage() {
  const { month, setMonth, openTx } = useApp()
  const accounts = useAccounts()
  const categories = useCategories()
  const accById = byId(accounts)
  const catById = byId(categories)

  const [type, setType] = useState<TxType | ''>('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [q, setQ] = useState('')

  const txs = useLiveQuery(() => {
    const [start, end] = monthRange(month)
    return db.transactions.where('date').between(start, end, true, true).toArray()
  }, [month])

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr')
    return (txs ?? [])
      .filter(
        (t) =>
          (!type || t.type === type) &&
          (!accountId || t.accountId === accountId || t.toAccountId === accountId) &&
          (!categoryId || t.categoryId === categoryId) &&
          (!needle || (t.note ?? '').toLocaleLowerCase('tr').includes(needle)),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [txs, type, accountId, categoryId, q])

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>()
    for (const t of filtered) m.set(t.date, [...(m.get(t.date) ?? []), t])
    return [...m.entries()]
  }, [filtered])

  const sum = totals(filtered)
  const sel = 'input min-h-10 w-auto shrink-0 py-1 text-sm'

  return (
    <div className="space-y-4">
      <MonthPicker month={month} onChange={setMonth} />

      <div className="grid grid-cols-2 gap-3">
        <div className="card py-3">
          <div className="text-xs text-zinc-500">Gelir</div>
          <Money value={sum.income} sign="income" className="font-semibold" />
        </div>
        <div className="card py-3">
          <div className="text-xs text-zinc-500">Gider</div>
          <Money value={sum.expense} sign="expense" className="font-semibold" />
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <select className={sel} value={type} onChange={(e) => setType(e.target.value as TxType | '')}>
          <option value="">Tüm türler</option>
          <option value="expense">Gider</option>
          <option value="income">Gelir</option>
          <option value="transfer">Transfer</option>
        </select>
        <select className={sel} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Tüm hesaplar</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select className={sel} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tüm kategoriler</option>
          {categories
            .filter((c) => !type || type === c.kind)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
        </select>
      </div>
      <input className="input" type="search" placeholder="Notlarda ara…" value={q} onChange={(e) => setQ(e.target.value)} />

      {txs && groups.length === 0 && <Empty>Bu ay için işlem yok — + ile ekle.</Empty>}

      {groups.map(([date, items]) => {
        const day = totals(items)
        return (
          <section key={date}>
            <div className="mb-1 flex justify-between px-1 text-sm text-zinc-500">
              <span>{formatDayTR(date)}</span>
              {day.net !== 0 && <Money value={Math.abs(day.net)} sign={day.net > 0 ? 'income' : 'expense'} />}
            </div>
            <ul className="card divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
              {items.map((t) => {
                const cat = t.categoryId ? catById[t.categoryId] : undefined
                const acc = accById[t.accountId]?.name ?? '?'
                const sub =
                  t.type === 'transfer' ? `${acc} → ${(t.toAccountId && accById[t.toAccountId]?.name) || '?'}` : acc
                return (
                  <li key={t.id}>
                    <button onClick={() => openTx(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-full text-lg"
                        style={{ background: `${cat?.color ?? '#64748b'}22` }}
                      >
                        {t.type === 'transfer' ? '⇄' : (cat?.icon ?? '❔')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {t.note || (t.type === 'transfer' ? 'Transfer' : (cat?.name ?? 'Kategori yok'))}
                        </span>
                        <span className="block truncate text-sm text-zinc-500">
                          {t.note && cat ? `${cat.name} · ` : ''}
                          {sub}
                        </span>
                      </span>
                      {t.type === 'transfer' ? (
                        <Money value={t.amount} className="text-zinc-500" />
                      ) : (
                        <Money value={t.amount} sign={t.type} className="font-semibold" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
