# Araç Plaka Yönetim Sistemi - Değişiklik Günlüğü (Changelog)

## [31.07.2026] - Bugünkü Oturumda Yapılanlar

### Eklenen Özellikler
- **Araç Bazlı Hareket Raporu Kısayolu:** Devam eden kullanımlar listesindeki her araca "📊 Rapor" butonu eklendi. Buton, kullanıcıyı doğrudan ilgili aracın rapor sayfasına yönlendiriyor.

### Değiştirilen / İyileştirilen Özellikler
- **Profil Fotoğrafı ve "Kaydet" Mantığı:** `main.js` içerisindeki `DOMContentLoaded` blokları birleştirildi. Profil popup'ı açıldığında seçilen fotoğrafın anında ekranda belirmeme sorunu çözüldü (Kutuların doğrudan `document.getElementById` ile bulunması sağlandı). Aynı hata yüzünden "Kaydet" butonunun işlevsiz kalması sorunu da giderildi.
- **Profil Popup İptal/Kapatma Mantığı:** 
  - Kafa karışıklığı yaratan ve çalışmayan "İptal" butonu arayüzden (HTML) tamamen kaldırıldı.
  - "X" (Çarpı) butonuna tıklama etkinliği (event listener) eklendi ve pencereyi başarıyla kapatması sağlandı. CSS'teki `display: flex` çakışması `display: none` komutu eklenerek çözüldü.
  - "X" (Çarpı) butonunun üzerine gelindiğinde renginin beyaza değil **kırmızıya** dönmesi için CSS hover özelliği güncellendi.
- **Versiyon Yönetimi:** Tarayıcı önbelleği (cache) sorunlarını önlemek adına `main.js` ve `style.css` versiyon numaraları güncellendi (v=59, v=1.0.6).

### Kaldırılan Özellikler
- Araç Alma ekranındaki kilometre girişi kaldırılmıştı (önceki oturumlarda).
- Teslim Etme menüsünde kilometre girişi aktif tutuldu.

### Gelecek İçin Beyin Fırtınası Notları
Claude AI'dan gelen fikirler değerlendirildi ve en potansiyelli 3 özellik vizyon panosuna eklendi:
1. Görsel Hasar Kaydı (Fotoğraflı teslimat)
2. Offline (Çevrimdışı) Çalışma Modu
3. Ehliyet / Personel Kartı OCR ile Hızlı Eşleştirme
