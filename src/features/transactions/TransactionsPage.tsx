import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useApp } from '../../components/AppContext'
import { TxList } from '../../components/TxList'
import { Money, MonthPicker, SelectChip } from '../../components/ui'
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

  // Kategori listesi: bu ay (seçili hesap ve türe göre) işlemi olanlar, en çok işlemden aza
  const catCounts = new Map<string, number>()
  for (const t of txs ?? []) {
    if (!t.categoryId || (type && t.type !== type)) continue
    if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) continue
    catCounts.set(t.categoryId, (catCounts.get(t.categoryId) ?? 0) + 1)
  }
  if (categoryId && !catCounts.has(categoryId)) catCounts.set(categoryId, 0)
  const catOptions = [...catCounts.entries()]
    .filter(([id]) => catById[id])
    .sort((a, b) => b[1] - a[1] || catById[a[0]].name.localeCompare(catById[b[0]].name, 'tr'))

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

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtreler">
        <SelectChip
          label="Hesap"
          value={accountId}
          onChange={setAccountId}
          options={[['', 'Tüm hesaplar'], ...accounts.map((a): [string, string] => [a.id, a.name])]}
        />
        <SelectChip
          label="Kategori"
          value={categoryId}
          onChange={setCategoryId}
          options={[['', 'Tüm kategoriler'], ...catOptions.map(([id, n]): [string, string] => [id, `${catById[id].icon} ${catById[id].name} (${n})`])]}
        />
        <SelectChip
          label="Tür"
          value={type}
          onChange={(v) => setType(v as TxType | '')}
          options={[
            ['', 'Tüm türler'],
            ['expense', 'Gider'],
            ['income', 'Gelir'],
            ['transfer', 'Transfer'],
          ]}
        />
      </div>
      <input className="input" type="search" placeholder="Notlarda ara…" value={q} onChange={(e) => setQ(e.target.value)} />

      {txs && <TxList txs={filtered} accById={accById} catById={catById} onPick={openTx} />}
    </div>
  )
}
