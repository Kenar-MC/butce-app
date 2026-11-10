# Bütçe App — Uygulama Planı (PLAN)

> Hangi sırayla yapılacağını tanımlar. Görev bitince `[ ]` → `[x]`. Detaylar için `SPEC.md`.

## Durum
- **Şu an:** Ekstre sürümü (E1) yayında (2026-11-06). Uygulama artık sadece **ekstre okuma + aylık harcama grafikleri** (K11). Elle işlem girme, hesap bakiyeleri, bütçe sekmesi kaldırıldı.
- Yeni veritabanı `butce-ekstre` (eski `butce-app` verisine dokunulmadı, kullanılmıyor). Mehmet sıfırdan başladı.
- Yayın: GitHub Pages (`Kenar-MC/butce-app`, main'e push → otomatik). iPhone'da ana ekran uygulaması kendiliğinden güncellenir.
- Ekstre Okuyucu artık satır başına kısa işyeri adı (`merchant`) veriyor, bakiye okumuyor.
- E2 (2026-11-06): her ekstre hesap (banka, kart adı, son 4 hane) ve ayla etiketleniyor; farklı kart/ay ayrı ekstre; uygulama kartı son 4 haneye göre eşliyor, yoksa otomatik oluşturuyor (K15).
- 2026-11-09 düzeltme: yeni sürüm iPhone'da "bekliyor"da kalıyordu (injectRegister: false iken eklenti skipWaiting/clientsClaim açmıyor). Artık açık + bekleyen eski sürüme SKIP_WAITING + Ayarlar'da "Güncellemeleri denetle". Takılı telefon, düzeltme yayınlanınca bir sonraki açılışta kendiliğinden geçer (eski sürüm + takılı bekleyen durumuyla yerelde canlandırılıp doğrulandı).
- 2026-11-09: iPhone'da güncellemeden sonra beyaz ekran bildirildi (iOS'ta yeniden üretilemedi; Mehmet uygulamayı silip yeniden ekleyecek). Eklenenler: açılış bekçisi (index.html; 12 sn'de açılmazsa ya da dosya yüklenemezse açıklama + "Önbelleği temizle ve yenile"), ErrorBoundary (hata mesajı + kurtarma), Ayarlar'da önbellek temizleme. Hiçbiri IndexedDB'ye dokunmaz.
- 2026-11-09 kök neden bulundu: iPhone'da hata ekranı "UnknownError: Unable to open cursor" gösterdi. Safari'de boş tabloda `uniqueKeys()` (imleç) çöküyor; sıfırdan açılan uygulamada Layout'taki ay listesi sorgusu her açılışta çöküyordu (beyaz ekranın da sebebi). Tüm imleçli sorgular kaldırıldı (K16); imleç çağrılarını kaydeden testle boş ve dolu veritabanında tüm ekranlarda 0 imleç doğrulandı.
- 2026-11-10 (E3): Özet genel bakış oldu (dönem 3/6/12 ay, dağılım şeridi, ortalama çizgili aylık grafik, kartlara göre, yaklaşan ödemeler); Aylık görünüm Trend'e katıldı (üstte ay seçici, bütün kategoriler). Karanlık mod varsayılan, sağ üstte ay/güneş düğmesi (K17).
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

## E2 — Ekstre kimliği: hesap + ay ✅
- [x] Okuyucu: `statements[]` (her biri `account{name,last4,kind}`, `month`, `period`, özet, satırlar), aynı hesap+ay birleşir, devam sayfası öncekine eklenir, başlıkta düzeltilebilir alanlar, dönemsiz ekstre dışa aktarılmaz; dosya `version: 2`
- [x] Uygulama: v1 + v2 okuma, kart eşleme (son 4 hane / banka / ad), otomatik kart oluşturma, ay tespiti (okuyucu → kesim → dönem metni → en geç satır)
- [x] İçe aktarma: dosyadaki her ekstre ayrı bölüm, tek seferde kaydet / geri al (açılan kartlar da geri alınır)
- [x] Kartlarda banka + son 4 hane (Ayarlar'dan düzenlenir), her yerde "Ad •• 1234"

**Kabul:** Tek dosyada Bonus ••1234 (Ekim + Eylül) ve DenizBank ••4417 (Ekim) → 2 kart, 3 ekstre; Miles ••5678 ayrı kart açılır, Bonus'a karışmaz; aynı dosya tekrar yüklenince kartlar son 4 haneyle eşleşir, satırlar "zaten kayıtlı"; geri alınca açılan kart da silinir. Okuyucuda iki görsel grubu: başlıksız devam sayfası önceki ekstreye eklenir. (Playwright ile doğrulandı.)

## E3 — Özet yeniden tasarım + Trend'de ay görünümü ✅
- [x] Özet: dönem seçimi (Bu ay/3/6/12 ay), kahraman toplam + önceki döneme göre, 4 kutu, harcama dağılımı şeridi, aylık grafik + ortalama çizgisi, en çok harcanan yerler, kartlara göre, yaklaşan son ödemeler
- [x] Trend: yapışkan ay seçici, ay kartı + 12 ay grafiği, bütün kategoriler (seçili ay + ortalama + mini sütunlar, açılınca grafik + işlemler), o ayın işyerleri
- [x] Karanlık mod varsayılan + ay/güneş düğmesi, seçim cihazda saklanır (K17)
- [x] `stats.ts`: `periodMonths`, `periodSummary`, `topShares`; `dates.ts`: `daysBetween` (testli)

**Kabul:** 360px'te demo verisiyle Özet (3/12 ay/Bu ay), dağılım satırına ve grafikte bir aya dokununca Trend'e geçiş, Trend'de ay değiştirme ve kategori açma; ilk açılış sistem açık modda olsa da karanlık, düğmeyle açık moda geçip yenileyince açık kalıyor. (Playwright ile doğrulandı.)

## Eski sürüm (Faz 0–5, gelir–gider) — kapandı
Kurulum, veri katmanı, işlemler, hesaplar, PWA, yedek, ekstre içe aktarma tamamlanmıştı; 2026-11-06'da K11 ile ekstre sürümüne geçildi. Kod git geçmişinde (`23a3441`).

### Fikir havuzu
- İşyeri adını düzenleme / iki işyerini birleştirme (ör. "Trendyol Yemek" ↔ "Trendyol")
- İki kartı birleştirme (yanlışlıkla ayrı açılan kart)
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
