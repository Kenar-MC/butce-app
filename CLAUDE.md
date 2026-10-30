# CLAUDE.md — Bütçe App

Kişisel gelir–gider takip uygulaması. Web (PWA), mobil öncelikli, tamamen offline; veri tarayıcıda (IndexedDB/Dexie). Sunucu yok.

**Token tasarrufu — okuma sırası:**
1. `docs/PLAN.md` en üstteki **Durum** bölümü → hangi fazdayız, son oturum notu (her zaman)
2. `docs/SPEC.md` → sadece o fazla ilgili bölümler (ekran / veri modeli / iş kuralı)
3. `docs/CONTEXT.md` → sadece yeni bir karar gerekiyorsa
4. Kodu toplu okuma; değiştireceğin dosyayı oku. Ortak parçalar: `src/components/ui.tsx`, `src/db/hooks.ts`, `src/index.css` (.card .input .btn-* sınıfları)

## Teknoloji
React 19 + Vite + TypeScript (strict) · Tailwind CSS v4 · Dexie.js (+ `dexie-react-hooks` / `useLiveQuery`) · React Router (`HashRouter`) · Vitest · oxlint
Sonraki fazlarda: Recharts (Faz 4), vite-plugin-pwa (Faz 5). Tarih biçimleri için kütüphane yok: `Intl` + `src/domain/dates.ts`.

Kurulumda paketlerin **güncel sürümlerini** ve güncel kurulum yönergelerini kullan; sürümleri ezberden yazma.

## Komutlar
```
npm run dev       # geliştirme sunucusu
npm run build     # üretim derlemesi
npm run preview   # derlenmiş sürümü test et
npm run test      # Vitest
npm run lint      # oxlint
```

## Kurallar

**Dil**
- Arayüz metinleri, hata mesajları, tarih/sayı formatları: **Türkçe** (`tr-TR`)
- Kod, değişken, fonksiyon, dosya adları, commit mesajları: **İngilizce**
- Kullanıcıyla (Mehmet) Türkçe konuş; kısa ve net anlat

**Para**
- Tutarlar her yerde **tam sayı kuruş** (`number`). Float ile para hesabı yapma.
- Tutar ayrıştırma (`parseAmount`) ve gösterim (`formatTRY`) sadece `src/domain/money.ts` üzerinden.
- Her para kaydında `currency: 'TRY'` alanı bulunur (çoklu döviz altyapısı).

**Veri**
- `id` = `newId()` (`src/lib/id.ts`, HTTPS olmayan LAN testinde de çalışır); her kayıtta `createdAt` / `updatedAt`.
- Tarihler `'YYYY-MM-DD'` string. `new Date('YYYY-MM-DD')` ile UTC kayması yaşama; yardımcıları `src/domain/dates.ts`'e koy.
- Birden fazla tabloya yazan işlemler (taksit planı + işlemler gibi) tek `db.transaction(...)` içinde.
- Şema değişikliği = Dexie `version(n+1)` + gerekirse `upgrade()` migrasyonu. Mevcut kullanıcı verisini asla bozma.
- Ağ isteği yapma (Faz 7'ye kadar). Uygulama internetsiz tam çalışmalı.

**Kod yapısı**
- İş mantığı `src/domain/` altında **saf fonksiyonlar** (React/Dexie importu yok) ve her biri için `*.test.ts`.
- Ekranlar `src/features/<özellik>/`, ortak bileşenler `src/components/`.
- Bileşenler küçük ve okunur; gereksiz soyutlama yapma.

**Tasarım**
- Mobile-first: 360px genişlikten başla, sonra ≥768px için genişlet.
- Dokunma alanları ≥ 44px; tutar alanında `inputmode="decimal"`.
- Gelir yeşil, gider kırmızı, transfer nötr renk. Karanlık mod sistem ayarına göre.
- Boş durumlarda yönlendirici mesaj göster ("Henüz işlem yok — + ile ekle").

## Çalışma ortamı
- Proje: `C:\Users\kenar\Desktop\Projects\CLAUDE\butce-app` (git deposu). `node_modules` Windows'ta `npm install` ile kurulur; başka platformdan kopyalanmaz.
- **claude.ai oturumunda** (bulut + bilgisayar köprüsü): klasörü tek `tar` ile buluta al (`.sync/from-pc.tgz`, node_modules hariç) → bulutta `npm ci`, test, build, tarayıcı testi → değişenleri tek `tar` ile geri yaz (`.sync/to-pc.tgz`, `tar --overwrite` ile aç) → bilgisayarda `git commit`. Dosya dosya aktarma yapma. `.sync/` git dışında.
- Uçtan uca kontrol: Playwright ile 360px genişlikte ana akış (hesap ekle → işlem ekle → bakiye/liste doğrula). Ekran görüntülerini tek bir birleşik görselde incele.
- Alt ajan (subagent) kullanma; proje küçük, tek akışta ilerle.

## Çalışma akışı
1. `docs/PLAN.md`'de sıradaki fazı bul; **faz dışına taşma**. Fikir varsa PLAN.md > Fikir havuzu'na ekle.
2. Yeni bir npm bağımlılığı (listede olmayan) eklemeden önce sor.
3. Faz bitince: `npm run lint && npm run test && npm run build` geçmeli, ardından fazın **kabul kriterini** tarayıcıda kontrol et.
4. PLAN.md'de tamamlanan maddeleri `[x]` yap; yeni bir karar alındıysa CONTEXT.md > Karar Kaydı'na ekle.
5. Anlamlı adımlarda commit at.
6. Sonunda Mehmet'e kısa özet: ne yapıldı, nasıl test edilir, sıradaki adım.
