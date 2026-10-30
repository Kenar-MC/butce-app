/** iPhone/iPad (iPadOS kendini Mac gibi tanıtır) */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function makeFile(filename: string, text: string, mime = 'application/json'): File {
  return new File([text], filename, { type: mime })
}

/**
 * Dosyayı kullanıcıya verir. iPhone'da paylaş menüsü açılır ("Dosyalar'a Kaydet").
 * iOS'ta paylaş menüsü doğrudan bir dokunuşla çağrılmalı: dosyayı önceden hazırlayıp
 * bu fonksiyonu tıklama işleyicisinde, araya await koymadan çağır.
 */
export async function saveFile(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (isIOS() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
      // izin yoksa aşağıdaki indirmeye düş
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text()
  return JSON.parse(text.replace(/^﻿/, ''))
}
