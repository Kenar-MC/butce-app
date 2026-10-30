import { useState } from 'react'
import { AmountInput, ConfirmButton, Segmented, Sheet } from '../../components/ui'
import { db } from '../../db/db'
import { useAccounts, useCategories } from '../../db/hooks'
import type { Transaction, TxType } from '../../db/types'
import { todayISO } from '../../domain/dates'
import { parseAmount, toInputString } from '../../domain/money'
import { newId, nowISO } from '../../lib/id'

const TYPES: [TxType, string][] = [
  ['expense', 'Gider'],
  ['income', 'Gelir'],
  ['transfer', 'Transfer'],
]

export default function TransactionSheet({ tx, onClose }: { tx?: Transaction; onClose: () => void }) {
  const accounts = useAccounts()
  const categories = useCategories()

  const [type, setType] = useState<TxType>(tx?.type ?? 'expense')
  const [amount, setAmount] = useState(tx ? toInputString(tx.amount) : '')
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? '')
  const [accountId, setAccountId] = useState(tx?.accountId ?? '')
  const [toAccountId, setToAccountId] = useState(tx?.toAccountId ?? '')
  const [date, setDate] = useState(tx?.date ?? todayISO())
  const [note, setNote] = useState(tx?.note ?? '')
  const [error, setError] = useState('')

  // Arşivli hesap/kategori sadece bu işlemde zaten seçiliyse görünür
  const activeAccounts = accounts.filter((a) => !a.archived || a.id === tx?.accountId || a.id === tx?.toAccountId)
  const kindCats = categories.filter((c) => c.kind === type && (!c.archived || c.id === tx?.categoryId))
  const fromId = accountId || activeAccounts[0]?.id || ''

  async function save() {
    const value = parseAmount(amount)
    if (!value) return setError('Geçerli bir tutar gir (ör. 1250,50)')
    if (!fromId) return setError('Hesap seç')
    if (type !== 'transfer' && !kindCats.some((c) => c.id === categoryId)) return setError('Kategori seç')
    if (type === 'transfer' && (!toAccountId || toAccountId === fromId)) return setError('Farklı iki hesap seç')
    if (!date) return setError('Tarih seç')

    const now = nowISO()
    const record: Transaction = {
      ...(tx ?? { id: newId(), createdAt: now }),
      type,
      amount: value,
      currency: 'TRY',
      date,
      accountId: fromId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type === 'transfer' ? undefined : categoryId,
      note: note.trim() || undefined,
      updatedAt: now,
    }
    await db.transactions.put(record)
    onClose()
  }

  async function remove() {
    if (tx) await db.transactions.delete(tx.id)
    onClose()
  }

  return (
    <Sheet title={tx ? 'İşlemi düzenle' : 'Yeni işlem'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Segmented
          value={type}
          options={TYPES}
          onChange={(t) => {
            setType(t)
            setCategoryId('')
            setError('')
          }}
        />

        <AmountInput value={amount} onChange={setAmount} autoFocus={!tx} />

        {type !== 'transfer' && (
          <div>
            <span className="label">Kategori</span>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {kindCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  aria-pressed={c.id === categoryId}
                  className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-transparent bg-zinc-100 p-1 text-center text-xs leading-tight dark:bg-zinc-800"
                  style={c.id === categoryId ? { borderColor: c.color, background: `${c.color}22` } : undefined}
                >
                  <span className="text-xl">{c.icon}</span>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={type === 'transfer' ? 'grid grid-cols-2 gap-3' : ''}>
          <label className="block">
            <span className="label">{type === 'transfer' ? 'Kimden' : 'Hesap'}</span>
            <select className="input" value={fromId} onChange={(e) => setAccountId(e.target.value)}>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          {type === 'transfer' && (
            <label className="block">
              <span className="label">Kime</span>
              <select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                <option value="">Seç…</option>
                {activeAccounts
                  .filter((a) => a.id !== fromId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-3">
          <label className="block">
            <span className="label">Tarih</span>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Not</span>
            <input className="input" placeholder="İsteğe bağlı" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {tx && <ConfirmButton onConfirm={() => void remove()} />}
          <button type="submit" className="btn-primary flex-1">
            Kaydet
          </button>
        </div>
      </form>
    </Sheet>
  )
}
