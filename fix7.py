import os
import re

filepath = r'c:\Users\stajyer\Downloads\Araç plakası\static\js\main.js'
with open(filepath, 'rb') as f:
    text_bytes = f.read()

# I will define the exact bytes and their replacements
replacements = [
    (b'\xef\xbf\xbd\xc2\x8f\xef\xbf\xbd Kamera haz\xef\xbf\xbdrlan\xef\xbf\xbdyor...', '⏳ Kamera hazırlanıyor...'.encode('utf-8')),
    (b'\xf0\x9f\x93\xb8 \xef\xbf\xbd\xc2\x9eimdi Tara', '📸 Şimdi Tara'.encode('utf-8')),
    (b'\xef\xbf\xbd\xc2\x8d \xef\xbf\xbd\xc2\x9eimdi Tara', '🔍 Şimdi Tara'.encode('utf-8')),
    (b'\xe2\x80\x9cTekrar Dene\xef\xbf\xbd\xc2\x9d', '“Tekrar Dene”'.encode('utf-8')),
    (b'\xe2\x80\x9c\xef\xbf\xbd\xc2\x9eimdi Tara\xef\xbf\xbd\xc2\x9d', '“Şimdi Tara”'.encode('utf-8')),
    (b'Kamera g\xef\xbf\xbdr\xef\xbf\xbdnt\xef\xbf\xbds\xef\xbf\xbd hen\xef\xbf\xbdz haz\xef\xbf\xbdr de\xef\xbf\xbdil.', 'Kamera görüntüsü henüz hazır değil.'.encode('utf-8')),
    (b'Plaka net okunamad\xef\xbf\xbd. Kameray\xef\xbf\xbd sabit tutup tekrar deneyin.', 'Plaka net okunamadı. Kamerayı sabit tutup tekrar deneyin.'.encode('utf-8')),
    (b'Netli\xef\xbf\xbd\xef\xbf\xbd d\xef\xbf\xbdzeltin veya', 'Netliği düzeltin veya'.encode('utf-8')),
    (b'Netli\xef\xbf\xbdi d\xef\xbf\xbdzeltin veya', 'Netliği düzeltin veya'.encode('utf-8')),
    (b'Plaka hizaland\xef\xbf\xbd. Okutmak i\xef\xbf\xbdin', 'Plaka hizalandı. Okutmak için'.encode('utf-8')),
    (b'Yaln\xef\xbf\xbdzca', 'Yalnızca'.encode('utf-8')),
    (b'\xef\xbf\xbdal\xef\xbf\xbd\xef\xbf\xbdacak', 'çalışacak'.encode('utf-8')),
    (b'\xef\xbf\xbdal\xef\xbf\xbdacak', 'çalışacak'.encode('utf-8')),
    (b'd\xef\xbf\xbdmesine', 'düğmesine'.encode('utf-8')),
    (b'Kamera haz\xef\xbf\xbdr de\xef\xbf\xbdil', 'Kamera hazır değil'.encode('utf-8')),
    (b'se\xef\xbf\xbdene\xef\xbf\xbdini kullan\xef\xbf\xbdn', 'seçeneğini kullanın'.encode('utf-8')),
    (b'OTOMAT\xef\xbf\xbdK OCR \xef\xbf\xbdA\xef\xbf\xbd\xc2\x9eRISI \xef\xbf\xbdPTAL ED\xef\xbf\xbdLD\xef\xbf\xbd', 'OTOMATİK OCR ÇAĞRISI İPTAL EDİLDİ'.encode('utf-8')),
    (b'Plaka bulundu \xe2\x80\xa2 okunuyor', 'Plaka bulundu • okunuyor'.encode('utf-8')),
    (b'Plaka bulundu \xe2\x80\xa2 sabit tutun', 'Plaka bulundu • sabit tutun'.encode('utf-8')),
    (b'\xe2\x80\x9c\xc2\x9eimdi Tara', 'Şimdi Tara'.encode('utf-8')),
    (b'Kamera a\xef\xbf\xbd\xef\xbf\xbdksa', 'Kamera açıksa'.encode('utf-8')),
    (b'Kamera a\xef\xbf\xbdksa', 'Kamera açıksa'.encode('utf-8')),
    (b'Kamera haz\xef\xbf\xbdr\xef\xbf\xbd\xef\xbf\xbdn\xef\xbf\xbd', 'Kamera hazırlığını'.encode('utf-8')),
    (b'Kamera haz\xef\xbf\xbdr\xef\xbf\xbdn\xef\xbf\xbd', 'Kamera hazırlığını'.encode('utf-8')),
]

for old, new in replacements:
    text_bytes = text_bytes.replace(old, new)

with open(filepath, 'wb') as f:
    f.write(text_bytes)
print('Done!')
