# Bütçe App — Uygulama Planı (PLAN)

> Hangi sırayla yapılacağını tanımlar. Görev bitince `[ ]` → `[x]`. Detaylar için `SPEC.md`.

## Durum
- **Şu an:** Ekstre sürümü (E1) yayında (2026-11-06). Uygulama artık sadece **ekstre okuma + aylık harcama grafikleri** (K11). Elle işlem girme, hesap bakiyeleri, bütçe sekmesi kaldırıldı.
- Yeni veritabanı `butce-ekstre` (eski `butce-app` verisine dokunulmadı, kullanılmıyor). Mehmet sıfırdan başladı.
- Yayın: GitHub Pages (`Kenar-MC/butce-app`, main'e push → otomatik). iPhone'da ana ekran uygulaması kendiliğinden güncellenir.
- Ekstre Okuyucu artık satır başına kısa işyeri adı (`merchant`) veriyor, bakiye okumuyor.
- **Sıradaki (istenirse):** Fikir havuzundan seçilir.

## E1 — Ekstre sürümü ✅
- [x] Yeni veri modeli: kart, ekstre (kart + ay), satır, kategori, işyeri kuralı, ayar
- [x] İçe aktarma: kart seç/oluştur, dönem seçimi (kesim ayı / satır tarihi), satır satır gözden geçirme, tekrar işareti, kart ödemelerini atlama, geri alma
- [x] Özet: ay seçici, aylık harcama sütun grafiği (dokununca ay), kategori dağılımı (dokununca işlemler), en çok harcanan yerler
- [x] Trend: 6/12 ay, kategori başına ortalama + son ay değişimi + küçük sütunlar, açılınca grafik
- [x] Ekstreler listesi + detay (özet bilgileri, kategoriler, satırlar, silme)
- [x] Satır ayrıntısı: kategori değiştir, işyerinin tümüne uygula + kural, sil
- [x] Ayarlar: kartlar, kategoriler, yedek (şema 2)
- [x] Ekstre Okuyucu: `merchant` alanı, bakiye okuma kaldırıldı
- [x] Recharts eklendi (K5'te planlıydı)

**Kabul:** 360px'te boş uygulamada karşılama → dosya yükle → kart oluştur → Ekle → Özet'te grafik ve kategoriler; ikinci ay yüklenince grafikte iki sütun, sütuna dokununca ay değişir; aynı dosya tekrar yüklenince satırların hepsi "zaten kayıtlı". (Playwright ile doğrulandı.)

## Eski sürüm (Faz 0–5, gelir–gider) — kapandı
Kurulum, veri katmanı, işlemler, hesaplar, PWA, yedek, ekstre içe aktarma tamamlanmıştı; 2026-11-06'da K11 ile ekstre sürümüne geçildi. Kod git geçmişinde (`23a3441`).

### Fikir havuzu
- İşyeri adını düzenleme / iki işyerini birleştirme (ör. "Trendyol Yemek" ↔ "Trendyol")
- Kategori başına aylık hedef / limit ve aşınca uyarı
- Taksit takibi: kalan taksitler ve gelecek aylara yük
- CSV / Excel dışa aktarma (ay ve kategori özetleri)
- Ekstreyi uygulamanın içinden okutma (API anahtarı ister; şimdilik okuyucu artifact'ı)
- Eski sürüm verisini (`butce-app` veritabanı) silme düğmesi
- Yedeği birleştirerek yükleme
- Uzun vade (eski yol haritası): varlık takibi, piyasa verisi, senkron

---

## Yeni oturuma başlarken

> `CLAUDE.md`'yi oku, PLAN.md > Durum'a bak, istenen değişikliği yap, kontrol et ve PLAN.md'yi güncelle.
