# Araç Plaka Android

Bu modül, canlı Flask/PWA uygulamasını güvenli bir Android WebView içinde açar.
Kamera izni yalnızca `https://arac-plaka-sistemi.onrender.com` kaynağına ve
yalnızca video yakalama amacıyla verilir.

## Gereksinimler

- JDK 17 veya daha yeni
- Android SDK Platform 35
- Android SDK Build Tools 35.0.0

## Derleme

Windows:

```powershell
.\gradlew.bat clean assembleRelease
```

macOS/Linux:

```bash
./gradlew clean assembleRelease
```

APK çıktısı:

`app/build/outputs/apk/release/app-release.apk`

Bu çıktı kurum içi test/dağıtım için Gradle geliştirme anahtarıyla imzalanır.
Google Play dağıtımı için kuruma ait kalıcı bir release keystore kullanılmalıdır.

Uygulama çevrimdışı bir kopya değildir; arayüz ve OCR API için internet
bağlantısı gerekir. Yerel Tesseract yedeği ilk kullanımda CDN dosyalarını
indirir.
