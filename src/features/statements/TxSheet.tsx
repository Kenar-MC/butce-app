import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ConfirmButton, Money, Sheet } from '../../components/ui'
import { db } from '../../db/db'
import { useCards, useCategories } from '../../db/hooks'
import { setCategory } from '../../db/statements'
import type { Transaction } from '../../db/types'
import { formatDayTR, formatMonthTR } from '../../domain/dates'
import { merchantKey } from '../../domain/merchant'
import { cardLabel } from '../../domain/cards'

/** Ekstre satırının ayrıntısı: kategoriyi değiştir (işyerinin tümüne de), sil */
export default function TxSheet({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const categories = useCategories().filter((c) => c.kind === tx.type && (!c.archived || c.id === tx.categoryId))
  const card = useCards().find((c) => c.id === tx.cardId)
  const key = merchantKey(tx.merchant)
  const sameCount = useLiveQuery(
    () => db.transactions.filter((t) => t.type === tx.type && merchantKey(t.merchant) === key).count(),
    [key, tx.type],
  )
  const [categoryId, setCategoryId] = useState(tx.categoryId)
  const [all, setAll] = useState(true)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (busy) return
    setBusy(true)
    if (categoryId !== tx.categoryId) await setCategory(tx, categoryId, all && (sameCount ?? 0) > 1)
    onClose()
  }

  async function remove() {
    await db.transactions.delete(tx.id)
    onClose()
  }

  return (
    <Sheet title={tx.merchant} onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1">
          <Money value={tx.amount} sign={tx.type} className="text-2xl font-bold" />
          <p className="text-sm text-zinc-500">
            {formatDayTR(tx.date)} · {cardLabel(card)} · {formatMonthTR(tx.month)} ekstresi
            {tx.installment && ` · ${tx.installment.no}/${tx.installment.count} taksit`}
          </p>
          {tx.description && tx.description !== tx.merchant && <p className="text-sm break-words text-zinc-600 dark:text-zinc-400">{tx.description}</p>}
        </div>

        <label className="block">
          <span className="label">Kategori</span>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </label>
        {(sameCount ?? 0) > 1 && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 accent-emerald-600" checked={all} onChange={(e) => setAll(e.target.checked)} />
            <span>
              {tx.merchant} işlemlerinin hepsine uygula ({sameCount}) ve sonraki ekstrelerde de böyle sınıflandır
            </span>
          </label>
        )}

        <div className="flex gap-2 pt-2">
          <ConfirmButton label="Satırı sil" onConfirm={() => void remove()} />
          <button className="btn-primary flex-1" disabled={busy} onClick={() => void save()}>
            Kaydet
          </button>
        </div>
      </div>
    </Sheet>
  )
}
