import os

filepath = r"c:\Users\stajyer\Downloads\Araç plakası\static\js\main.js"

with open(filepath, 'rb') as f:
    text_bytes = f.read()

# Replace exact byte sequences for the mojibake
text_bytes = text_bytes.replace(b'\xc4\x9f\xc5\xb8\xe2\x80\x9c\xc2\xb8 \xc3\x85\xc5\xbeimdi Tara', '📸 Şimdi Tara'.encode('utf-8'))
text_bytes = text_bytes.replace(b'\xc4\x9f\xc5\xb8\xe2\x80\x9d  \xc3\x85\xc5\xbeimdi Tara', '🔍 Şimdi Tara'.encode('utf-8'))
text_bytes = text_bytes.replace(b'\xc3\xa2 \xc2\xb3 Kamera haz\xc4\xb1rlan\xc4\xb1yor...', '⏳ Kamera hazırlanıyor...'.encode('utf-8'))
text_bytes = text_bytes.replace(b'\xc3\xa2\xe2\x82\xac\xc5\x93Tekrar Dene\xc3\xa2\xe2\x82\xac\xc2\x9d', '“Tekrar Dene”'.encode('utf-8'))
text_bytes = text_bytes.replace(b'\xc3\xa2\xe2\x82\xac\xc5\x93\xc3\x85\xc5\xbeimdi Tara\xc3\xa2\xe2\x82\xac\xc2\x9d', '“Şimdi Tara”'.encode('utf-8'))
text_bytes = text_bytes.replace(b'\xc3\x85\xc5\xbeimdi Tara', 'Şimdi Tara'.encode('utf-8'))

# Some other ones
text_bytes = text_bytes.replace(b'\xc3\x87A\xc3\x84\xc5\xbeRISI', 'ÇAĞRISI'.encode('utf-8'))

with open(filepath, 'wb') as f:
    f.write(text_bytes)

print('Success bytes!')
