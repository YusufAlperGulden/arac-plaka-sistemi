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

### Eklenen Yeni Özellikler (PWA, Personel Detayları, Koyu/Açık Tema)

#### 1. PWA Uygulama İkonu (Logo) ve Manifest Entegrasyonu
- **Ne Eklendi:** Uygulamanın Android/iOS cihazlara indirildiğinde veya masaüstüne kısayol eklendiğinde gösterilmesi için "TR Plakası" konseptinde özel, maskelenebilir (maskable) bir logo eklendi.
- **Neden Eklendi:** Daha önce PWA (Progressive Web App) manifestosu ayarlanmış olmasına rağmen ikon düz mavi bir kare olarak görünüyordu. Profesyonel ve marka kimliğine uygun bir görünüm sağlamak amacıyla özelleştirildi.
- **Nasıl Çalışıyor:** 
  - Üretilen logo, tarayıcıların PWA gereksinimlerini karşılaması için (192x192 ve 512x512 piksel çözünürlüklerinde) boyutlandırıldı. 
  - `manifest.json` dosyası, `icons` dizisi altında bu logoları gösterecek şekilde güncellendi ve `purpose: "any maskable"` ayarı yapılarak Android'in ikonları kırpmadan cihaz temasına göre uyarlaması (yuvarlak, kare vb.) sağlandı. 
  - Sunucu (`app.py`), statik dosyaları kök dizin (root) üzerinden düzgün şekilde sunacak şekilde yönlendirildi.

#### 2. Genişletilmiş Sürücü / Personel Profili Yönetimi
- **Ne Eklendi:** Uygulama içindeki "Profil Düzenle" menüsü genişletilerek `Personel No`, `Departman`, `Telefon`, `Ehliyet Sınıfı` ve `Ehliyet Geçerlilik Tarihi` alanları sisteme dahil edildi.
- **Neden Eklendi:** Eski sistemde sadece şifre ve isim değiştirilebiliyordu. Özellikle araç-filo yönetim sistemlerinde, işlemi yapan personelin veya sürücünün detaylı yasal ve operasyonel bilgilerine (hangi departmanda çalıştığı, ehliyetinin sınıfı ve geçerliliği gibi) ihtiyaç duyulmaktadır. Bu eksikliği gidermek için profil yapısı tamamen zenginleştirildi.
- **Nasıl Çalışıyor:**
  - **Veritabanı Katmanı:** `models.py` dosyasındaki `SystemUser` sınıfına (SQLAlchemy tablosu) 5 yeni sütun eklendi (`String` ve `Date` formatlarında).
  - **Migrasyon (Göç):** `schema_migrations.py` içerisine yazılan bir algoritma ile uygulamanın her açılışında veritabanı denetleniyor; eğer bu yeni sütunlar yoksa tablo `ALTER TABLE` komutlarıyla otomatik olarak güncelleniyor (Böylece mevcut veriler silinmeden yapı yenileniyor).
  - **Backend (API):** `app.py` içerisindeki `/api/login` ve `/api/profile/update` rotaları güncellendi. Artık API, JSON tipinde gelen bu yeni verileri doğrulayıp veritabanına işliyor ve okuma esnasında geri döndürüyor.
  - **Frontend (Arayüz):** `index.html` üzerinde modal formuna yeni input alanları yerleştirildi. `main.js` içerisinde kullanıcı giriş yaptığında dönen veriler global `state` objesinde tutuluyor ve form gönderilirken `fetch()` ile sunucuya asenkron (sayfa yenilenmeden) iletiliyor.

#### 3. Dinamik Açık / Koyu Tema (Light / Dark Mode) Geçişi
- **Ne Eklendi:** Uygulama arayüzüne (sağ üst köşeye), kullanıcının temanın renklerini gündüz (Açık) ve gece (Koyu) olarak değiştirebileceği interaktif bir "Güneş/Ay" butonu eklendi. Varsayılan (default) tema koyu tema olarak korundu.
- **Neden Eklendi:** Kullanıcı deneyimini (UX) artırmak ve uygulamanın gece/gündüz farklı ışık koşullarında (özellikle sahada araç teslim alırken) göz yormadan veya güneş ışığı altında parlamadan okunabilmesini sağlamak istendi.
- **Nasıl Çalışıyor:**
  - **CSS Mimarisinde:** `style.css` içerisindeki `:root` değişkenleri ile sistemin tüm renkleri (arkaplan, kartlar, yazılar, butonlar) önceden CSS Variable (değişken) olarak tanımlanmıştı. Bu sayede CSS dosyasına sadece `.light-mode` adında yeni bir sınıf ekleyerek, tüm bu değişkenlerin açık tema renk kodlarıyla ezilmesi (override) sağlandı.
  - **JavaScript Mantığı:** `main.js` içerisine eklenen `toggleTheme()` fonksiyonu, butona basıldığında HTML'in `<body>` etiketine `.light-mode` sınıfını ekleyip çıkarıyor (toggle). İkon güneşten aya (veya tam tersi) dönüşüyor.
  - **Durum Kalıcılığı (Persistence):** Kullanıcının yaptığı tema seçimi tarayıcının `localStorage` hafızasına `theme: 'light'` veya `'dark'` olarak kaydediliyor. Sayfa yenilendiğinde (DOM yüklendiğinde) JavaScript hemen bu hafızayı kontrol edip ekranı kullanıcının bıraktığı renkte açıyor. Veri yoksa, orijinal (Koyu) temada başlatıyor.
