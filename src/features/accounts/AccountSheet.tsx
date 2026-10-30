import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { AmountInput, ConfirmButton, Segmented, Sheet } from '../../components/ui'
import { db } from '../../db/db'
import { ACCOUNT_TYPES } from '../../db/hooks'
import type { Account, AccountType } from '../../db/types'
import { parseAmount, toInputString } from '../../domain/money'
import { newId, nowISO } from '../../lib/id'

const TYPE_OPTIONS = Object.entries(ACCOUNT_TYPES).map(([k, v]) => [k, v.label]) as [AccountType, string][]

export default function AccountSheet({ acc, onClose, onDeleted }: { acc?: Account; onClose: () => void; onDeleted?: () => void }) {
  const [name, setName] = useState(acc?.name ?? '')
  const [type, setType] = useState<AccountType>(acc?.type ?? 'bank')
  // Kredi kartında kullanıcı borcu pozitif girer, negatif saklanır
  const [opening, setOpening] = useState(acc && acc.openingBalance ? toInputString(Math.abs(acc.openingBalance)) : '')
  const [error, setError] = useState('')
  const txCount = useLiveQuery(
    async () =>
      acc
        ? (await db.transactions.where('accountId').equals(acc.id).count()) +
          (await db.transactions.where('toAccountId').equals(acc.id).count())
        : 0,
    [acc?.id],
  )

  async function save() {
    if (!name.trim()) return setError('Hesap adı gir')
    const value = opening.trim() ? parseAmount(opening) : 0
    if (value === null) return setError('Geçerli bir tutar gir')
    const now = nowISO()
    await db.accounts.put({
      ...(acc ?? { id: newId(), createdAt: now, archived: false }),
      name: name.trim(),
      type,
      currency: 'TRY',
      openingBalance: type === 'credit_card' ? -value : value,
      updatedAt: now,
    })
    onClose()
  }

  async function setArchived(archived: boolean) {
    if (acc) await db.accounts.update(acc.id, { archived, updatedAt: nowISO() })
    onClose()
  }

  /** Hesabı ve ona bağlı tüm işlemleri (transferler dahil) siler */
  async function remove() {
    if (!acc) return
    await db.transaction('rw', db.accounts, db.transactions, async () => {
      const ids = await db.transactions.where('accountId').equals(acc.id).or('toAccountId').equals(acc.id).primaryKeys()
      await db.transactions.bulkDelete(ids)
      await db.accounts.delete(acc.id)
    })
    onClose()
    onDeleted?.()
  }

  return (
    <Sheet title={acc ? 'Hesabı düzenle' : 'Yeni hesap'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label className="block">
          <span className="label">Hesap adı</span>
          <input className="input" placeholder="ör. Garanti Vadesiz" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!acc} />
        </label>
        <div>
          <span className="label">Tür</span>
          <Segmented value={type} options={TYPE_OPTIONS} onChange={setType} />
        </div>
        <div>
          <span className="label">{type === 'credit_card' ? 'Mevcut borç (açılışta)' : 'Açılış bakiyesi'}</span>
          <AmountInput value={opening} onChange={setOpening} />
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          {acc && txCount !== undefined && (
            <ConfirmButton label={txCount ? `Hesabı ve ${txCount} işlemi sil` : 'Sil'} onConfirm={() => void remove()} />
          )}
          {acc && (
            <button type="button" className="btn-ghost" onClick={() => void setArchived(!acc.archived)}>
              {acc.archived ? 'Arşivden çıkar' : 'Arşivle'}
            </button>
          )}
          <button type="submit" className="btn-primary flex-1">
            Kaydet
          </button>
        </div>
        {acc && !!txCount && (
          <p className="text-xs text-zinc-500">
            Silersen bu hesaptaki {txCount} işlem de silinir (diğer hesaplarla yapılan transferler dahil). Geçmişi saklamak istersen arşivle.
          </p>
        )}
      </form>
    </Sheet>
  )
}
