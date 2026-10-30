import { BACKUP_TABLES, makeBackup, type BackupData, type BackupFile } from '../domain/backup'
import { nowISO } from '../lib/id'
import { db } from './db'

/** Tüm veriyi yedek dosyası olarak hazırlar ve son yedek tarihini kaydeder */
export async function createBackup(): Promise<BackupFile> {
  const exportedAt = nowISO()
  const data = {} as BackupData
  await db.transaction('r', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const t of BACKUP_TABLES) data[t] = await db.table(t).toArray()
  })
  // Yedeğin içindeki "son yedek" bilgisi de güncel olsun
  data.settings = [...data.settings.filter((s) => s.key !== 'lastBackupAt'), { key: 'lastBackupAt', value: exportedAt }]
  await db.settings.put({ key: 'lastBackupAt', value: exportedAt })
  return makeBackup(data, exportedAt)
}

/** Mevcut veriyi tamamen siler ve yedeği yazar (tek işlem; hata olursa hiçbir şey değişmez) */
export async function restoreBackup(file: BackupFile): Promise<void> {
  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const t of BACKUP_TABLES) {
      await db.table(t).clear()
      if (file.data[t].length) await db.table(t).bulkAdd(file.data[t])
    }
  })
}
