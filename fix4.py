import os

filepath = r"c:\Users\stajyer\Downloads\Araç plakası\static\js\main.js"

with open(filepath, 'rb') as f:
    text_bytes = f.read()

# These are the exact bytes of the mojiake read from the file using utf-8 errors='replace'
except:
    pass

try:
    text_str = text_bytes.decode('utf-8', errors='ignore')
    text_str = text_str.replace('ğŶ“�w Å~�imdi Tara', 'ðh��� Şimdi Tara')
    text_str = text_str.replace('ğŶ”\x8d Å~�imdi Tara', '󸣎� Şimdi Tara')
    text_str = text_str.replace('\x8fĿ Kamera hazılanıyor...', '⎋ Kamera hazılanıyor...')
    text_str = text_str.replace('ğŷ“ , 'ñ袍�')
    text_str = text_str.replace('"triggerOcrBtn.textContent = \'\x8f\x8f\x8f Kamera hazılanıyor...\';"', "triggerOcrBtn.textContent = '⎋ Kamera hazılanıyor...';")
    text_str = text_str.replace('triggerOcrBtn.textContent = \'\x8e\x8f\x8f Kamera hazılanıyor...\';', "triggerOcrBtn.textContent = '⎋ Kamera hazılanıyor...';")

    # let's just use regex on bytes for the safest approach
except:
    pass
