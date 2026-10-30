# Bütçe App — Bağlam (CONTEXT)

> Bu dosya projenin "neden"ini ve alınmış kararları tutar. Yeni bir oturuma başlarken önce bunu oku.
> Son güncelleme: 2026-10-30 (Faz 0–2 sonrası)

## 1. Proje nedir?

Kişisel kullanım için bir **gelir–gider takip uygulaması**. İlk hedef: harcamaları ve gelirleri hızlıca girip ay sonunda nereye ne gittiğini görmek.

Uzun vadede:
1. Malvarlığı takibi (döviz, altın, hisse, fon, kripto, gayrimenkul vb.)
2. Piyasa verisiyle güncel değer hesaplama (kur, altın, BIST)
3. Belki başka kişilerle paylaşım / dışarı açma

## 2. Geliştirici

- Mehmet Can — altyapı/network tarafında çalışıyor; React/Vite + Node/Express + PostgreSQL ile daha önce proje kurdu (WSL2, nvm, GitHub CLI ortamı hazır).
- Geliştirme Claude Code ile yapılacak; kodun büyük kısmını Claude yazar, Mehmet yön verir ve test eder.
- İletişim ve arayüz dili: **Türkçe**. Kod, değişken ve dosya adları: **İngilizce**.

## 3. Alınmış kararlar (Karar Kaydı)

| # | Konu | Karar | Neden |
|---|------|-------|-------|
| K1 | Platform | **Web uygulaması (PWA)**, mobil öncelikli (mobile-first) responsive tasarım | Tek kod tabanı; telefonda tarayıcıdan veya "Ana ekrana ekle" ile uygulama gibi açılır |
| K2 | Veri saklama | **Tarayıcı içi IndexedDB** (Dexie.js ile) — sunucu yok | Tamamen offline çalışır; her kullanıcının verisi kendi tarayıcısında kalır (bkz. §4) |
| K3 | Para birimi | **Arayüzde sadece TL**, ama her kayıtta `currency` alanı var | İleride USD/EUR/altın eklemek veri modelini bozmaz |
| K4 | MVP kapsamı | İşlemler + kategoriler + **hesaplar**, **taksit**, **tekrarlayan işlem**, **aylık özet/grafik**, **kategori bütçe limitleri** | Mehmet'in seçimi |
| K5 | Teknoloji | React + Vite + TypeScript, Tailwind CSS v4, Dexie.js, React Router, Vitest, oxlint; sonra Recharts, vite-plugin-pwa. Tarih için kütüphane yok (`Intl`) | Mehmet React/Vite biliyor; TS para hesaplarında hatayı azaltır |
| K6 | Para tutarı | Tutarlar **tam sayı kuruş** olarak saklanır (`12550` = 125,50 ₺), asla float | Yuvarlama hatalarını önler |
| K7 | Yayınlama | İlk aşama lokal (`npm run dev`). Dışarı açılırsa **statik hosting** (Cloudflare Pages / Netlify / GitHub Pages) | Backend olmadığı için sunucu maliyeti yok, sunucuda kullanıcı verisi yok |
| K8 | Yönlendirme | `HashRouter` (`/#/islemler`) + `base: './'` | Her statik hostta ayarsız çalışır |

## 4. IndexedDB nasıl çalışır? (K2'nin sonuçları)

- Veri **tarayıcı + cihaz + site adresi** bazında tutulur. Siteyi açan herkesin verisi kendi tarayıcısındadır; kimse kimsenin verisini görmez. Giriş/şifre gerekmez.
- **Artısı:** Paylaşmak için siteyi yayınlamak yeterli; herkes kendi bağımsız bütçesini tutar.
- **Sınırları (bilinçli kabul edilen):**
  - Telefon ile bilgisayar arasında **otomatik senkron yok**. Aynı kişi iki cihazda ayrı veri görür. Çözüm (MVP): JSON yedek al → diğer cihazda yükle. Gerçek senkron ileride backend + giriş ile gelir (Faz 8).
  - Tarayıcı verisi temizlenirse veya gizli sekmede kullanılırsa veri silinir.
  - iPhone Safari, uzun süre ziyaret edilmeyen sitelerin verisini silebilir. Önlem: uygulamayı **ana ekrana ekleyerek** kullanmak, `navigator.storage.persist()` ile kalıcı depolama istemek ve **düzenli JSON yedek** almak.
- Bu yüzden **yedekleme (dışa/içe aktarma) MVP'nin zorunlu parçasıdır.**

## 5. Kapsam dışı (şimdilik)

- Kullanıcı hesabı, giriş, sunucu, senkronizasyon
- Banka entegrasyonu / otomatik ekstre çekme
- Aktif çoklu döviz (altyapı hazır ama arayüzde yok)
- Varlık takibi ve piyasa verisi
- Paylaşımlı/aile bütçesi

## 6. Diğer dosyalar

- `docs/SPEC.md` — ekranlar, veri modeli, iş kuralları (ne yapılacak)
- `docs/PLAN.md` — fazlar, görev listesi, kabul kriterleri (hangi sırayla)
- `CLAUDE.md` — Claude Code için kodlama talimatları (nasıl yapılacak)

## 7. Açık sorular (ileride netleşecek)

- Kredi kartında hesap kesim / son ödeme günü takibi MVP sonrası mı eklensin?
- Bütçe limiti her ay aynı mı kalsın, aylık farklı limit gerekir mi?
- Dışarı açılırsa alan adı ve hosting seçimi
