import re

with open(r'templates\index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Hamburger menüden Araç Bakım Takip butonunu sil
# <button id="header-maintenance-btn" ...> ... </button>
header_btn_pattern = re.compile(r'<button id="header-maintenance-btn".*?</button>\s*', re.DOTALL)
text = header_btn_pattern.sub('', text)

# 2. Yönetim menüsündeki "Bakım ve Uyarılar" butonunun içeriğini değiştir
old_btn = '''<button id="maintenance-reminders-btn" class="action-big-btn glass-panel">
                    <div class="action-icon">🔧</div>
                    <h3>Bakım ve Uyarılar</h3>
                    <p>Yaklaşan ve geciken araç işlemlerini görüntüle</p>
                </button>'''

new_btn = '''<button id="maintenance-reminders-btn" class="action-big-btn glass-panel">
                    <div class="action-icon">🔧</div>
                    <h3>Araç Bakım Merkezi</h3>
                    <p>Bakım geçmişi ve yaklaşan uyarıları görüntüle</p>
                </button>'''
text = text.replace(old_btn, new_btn)

# 3. title'ı güncelle
text = text.replace('<h2>Bakım ve Uyarılar</h2>', '<h2>Araç Bakım Merkezi</h2>')
text = text.replace('<p>Bakım, muayene, sigorta ve diğer araç hatırlatmaları.</p>', '<p>Bakım, muayene, sigorta ve bakım kayıtları.</p>')


with open(r'templates\index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Step 1 and 2 completed.")
