/**
 * Yedek dosyası (kind: "backup"). Tüm tablolar olduğu gibi yazılır;
 * geri yükleme mevcut veriyi tamamen değiştirir.
 */
export const BACKUP_TABLES = ['cards', 'statements', 'transactions', 'categories', 'rules', 'settings'] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]
export type BackupData = Record<BackupTable, Record<string, unknown>[]>

export interface BackupFile {
  app: 'butce-app'
  kind: 'backup'
  schemaVersion: 2
  exportedAt: string
  data: BackupData
}

const REQUIRED: BackupTable[] = ['cards', 'statements', 'transactions', 'categories']

export function makeBackup(data: BackupData, exportedAt: string): BackupFile {
  return { app: 'butce-app', kind: 'backup', schemaVersion: 2, exportedAt, data }
}

export function backupFileName(exportedAt: string): string {
  return `butce-yedek-${exportedAt.slice(0, 10)}.json`
}

/** Doğrular; hata varsa Türkçe mesaj döner */
export function parseBackup(json: unknown): BackupFile | string {
  if (typeof json !== 'object' || json === null) return 'Dosya okunamadı.'
  const f = json as Record<string, unknown>
  if (f.app !== 'butce-app' || f.kind !== 'backup') return 'Bu bir Bütçe yedek dosyası değil.'
  if (f.schemaVersion === 1) return 'Bu yedek eski gelir–gider sürümünden; ekstre sürümüne yüklenemez.'
  if (f.schemaVersion !== 2) return 'Yedek sürümü desteklenmiyor.'
  const d = f.data as Record<string, unknown> | undefined
  if (typeof d !== 'object' || d === null) return 'Yedekte veri yok.'

  const data = {} as BackupData
  for (const t of BACKUP_TABLES) {
    const rows = d[t] ?? (REQUIRED.includes(t) ? undefined : [])
    if (!Array.isArray(rows)) return `Yedek bozuk: "${t}" tablosu eksik.`
    const key = t === 'settings' || t === 'rules' ? 'key' : 'id'
    if (!rows.every((r) => typeof r === 'object' && r !== null && typeof (r as Record<string, unknown>)[key] === 'string')) {
      return `Yedek bozuk: "${t}" tablosunda geçersiz kayıt var.`
    }
    data[t] = rows as Record<string, unknown>[]
  }
  return {
    app: 'butce-app',
    kind: 'backup',
    schemaVersion: 2,
    exportedAt: typeof f.exportedAt === 'string' ? f.exportedAt : '',
    data,
  }
}
