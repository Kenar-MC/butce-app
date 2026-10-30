import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useApp } from '../../components/AppContext'
import { TxList } from '../../components/TxList'
import { Money, MonthPicker } from '../../components/ui'
import { db } from '../../db/db'
import { byId, useAccounts, useCategories } from '../../db/hooks'
import type { TxType } from '../../db/types'
import { monthRange } from '../../domain/dates'
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
  }, [txs, type, accountId, categoryId, q])

  const sum = totals(filtered)
  const sel = 'input min-h-10 w-auto shrink-0 py-1' // iOS'ta 16px altı yazı odaklanınca ekranı yakınlaştırır

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

      {txs && <TxList txs={filtered} accById={accById} catById={catById} onPick={openTx} />}
    </div>
  )
}
