import re

with open('templates/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

old_str = '''<div class="input-group compact-input report-search-field">
                        <label for="global-search">Metin Arama</label>
                        <input type="search" id="global-search" placeholder="Plaka, araç, sürücü, talep, servis veya not ara...">
                    </div>'''

new_str = '''<div class="input-group compact-input report-search-field">
                        <label for="global-search">Metin Arama</label>
                        <div style="position: relative; width: 100%;">
                            <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: #a1a1aa; pointer-events: none;">??</span>
                            <input type="search" id="global-search" placeholder="Plaka, araç, sürücü, talep, servis veya not ara..." style="padding-left: 35px; width: 100%; box-sizing: border-box;">
                        </div>
                    </div>'''

if old_str in html:
    html = html.replace(old_str, new_str)
    html = html.replace('main.js?v=26', 'main.js?v=27')
    with open('templates/index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('SUCCESS')
else:
    print('FAILED TO FIND BLOCK')
