import re

with open(r'templates\index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add "Araç Bakım İşlemleri" button to Dashboard (Action Selection)
dashboard_btn = '''
                <button id="action-maintenance-btn" class="action-big-btn glass-panel">
                    <div class="action-icon">🔧</div>
                    <h3>Araç Bakım İşlemleri</h3>
                    <p>Bakım geçmişi ve yeni bakım kaydı oluşturun</p>
                </button>
'''
# Insert before <button id="action-report-btn"
if 'id="action-maintenance-btn"' not in text:
    text = text.replace('<button id="action-report-btn"', dashboard_btn + '                <button id="action-report-btn"')

# 2. Restore the old maintenance-reminders-btn in Management Menu
old_btn = '''<button id="maintenance-reminders-btn" class="action-big-btn glass-panel">
                    <div class="action-icon">🔧</div>
                    <h3>Araç Bakım Merkezi</h3>
                    <p>Bakım geçmişi ve yaklaşan uyarıları görüntüle</p>
                </button>'''
new_btn = '''<button id="maintenance-reminders-btn" class="action-big-btn glass-panel">
                    <div class="action-icon">🔧</div>
                    <h3>Bakım ve Uyarılar</h3>
                    <p>Yaklaşan ve geciken araç işlemlerini görüntüle</p>
                </button>'''
text = text.replace(old_btn, new_btn)
# Restore title and desc
text = text.replace('<h2>Araç Bakım Merkezi</h2>', '<h2>Bakım ve Uyarılar</h2>')
text = text.replace('<p>Bakım, muayene, sigorta ve bakım kayıtları.</p>', '<p>Bakım, muayene, sigorta ve diğer araç hatırlatmaları.</p>')

# 3. Clean up the injected tabs in #maintenance-reminders-section
tabs_to_remove = r'<div style="display:flex; justify-content:space-around; margin-bottom:20px; border-bottom:1px solid rgba\(255,255,255,0\.1\); padding-bottom:10px;">.*?</div>\s*<div id="maintenance-reminders-view">\s*'
text = re.sub(tabs_to_remove, '', text, flags=re.DOTALL)

# Because we opened `<div id="maintenance-reminders-view">`, we need to remove the opening tag.
# Done by the regex above! But wait, where is it closed?
# The `fix_injection.py` added it inside the end of `maintenance-reminders-section`. 
# We need to remove the injected `add_view` and `list_view` completely from `maintenance-reminders-section`.
injected_views_pattern = r'<!-- Ekleme Formu \(YENİ\) -->.*?</div>\s*<!-- Listeleme Ekranı \(YENİ\) -->.*?</div>\s*</div>'
text = re.sub(injected_views_pattern, '', text, flags=re.DOTALL)
# One of the `</div>` we removed might be the closing tag of `#maintenance-reminders-view`. Actually, I forgot to close `maintenance-reminders-view` in `fix_html_2.py`, I only added it inside `injected_views_pattern`.
# Wait, let's just make sure the `glass-card management-wrapper` is properly closed in `#maintenance-reminders-section`.
# Let's fix the end of `maintenance-reminders-section` manually to be safe.
clean_section_end = r'</section>\s*<!-- Devam Eden Kullanımlar Panosu -->'
text = re.sub(r'</div>\s*</section>\s*<!-- Devam Eden Kullanımlar Panosu -->', '        </div>\n    </section>\n\n    <!-- Devam Eden Kullanımlar Panosu -->', text, flags=re.DOTALL)

# 4. Create the new standalone Main Maintenance Section
standalone_section = '''
    <!-- Ana Ekran Bakım Modülü -->
    <section id="main-maintenance-section" class="screen-section hidden">
        <div class="glass-card management-wrapper">
            <div class="management-header">
                <button id="back-from-main-maintenance-btn" class="btn-secondary">⬅ Geri</button>
                <div>
                    <h2>Araç Bakım İşlemleri</h2>
                    <p>Araç servis ve onarım geçmişi.</p>
                </div>
            </div>

            <div class="management-tabs" role="tablist" style="margin-bottom:20px;">
                <button id="tab-btn-add" class="management-tab active" type="button" onclick="window.switchMainMaintenanceTab('add')">Yeni Bakım Ekle</button>
                <button id="tab-btn-list" class="management-tab" type="button" onclick="window.switchMainMaintenanceTab('list')">Bakım Geçmişi</button>
            </div>

            <div id="main-maintenance-add-view" class="management-panel active">
                <div style="margin-bottom:15px; color:var(--text-secondary); text-align:center;">
                    <p>Araçlarınızın servis, bakım ve onarım işlemlerini buradan sisteme kaydedebilirsiniz.</p>
                </div>
                <form id="maintenance-form" onsubmit="window.submitMaintenanceForm(event)" class="management-form glass-panel">
                    <div class="responsive-form-grid">
                        <div class="input-group">
                            <label for="maintenance-vehicle">Araç (Plaka)</label>
                            <select id="maintenance-vehicle" required>
                                <option value="" disabled selected>Araç Seçin...</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label for="maintenance-company">Bakım Firması</label>
                            <input type="text" id="maintenance-company" required placeholder="Örn: Bosch Car Service">
                        </div>
                        <div class="input-group">
                            <label for="maintenance-date">Bakım Tarihi</label>
                            <input type="date" id="maintenance-date" required>
                        </div>
                        <div class="input-group">
                            <label for="maintenance-mileage">Kilometre (KM)</label>
                            <input type="number" id="maintenance-mileage" required placeholder="Örn: 150000">
                        </div>
                        <div class="input-group">
                            <label for="maintenance-cost">Tutar (Opsiyonel)</label>
                            <input type="number" step="0.01" id="maintenance-cost" placeholder="Örn: 1500.50">
                        </div>
                        <div class="input-group form-grid-wide">
                            <label for="maintenance-desc">Yapılan İşlemler / Açıklama</label>
                            <textarea id="maintenance-desc" rows="3" placeholder="Örn: Periyodik bakım, yağ değişimi vs."></textarea>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Kaydet</button>
                    </div>
                </form>
            </div>

            <div id="main-maintenance-list-view" class="management-panel hidden">
                <div style="margin-bottom:15px; color:var(--text-secondary); text-align:center;">
                    <p>Sisteme daha önceden kaydedilmiş tüm araç bakım geçmişi dökümü.</p>
                </div>
                <div class="management-list" aria-live="polite">
                    <div class="table-responsive" style="max-height:400px; overflow-y:auto;">
                        <table class="report-table" style="width:100%;">
                            <thead>
                                <tr>
                                    <th>Tarih</th>
                                    <th>Plaka</th>
                                    <th>Firma</th>
                                    <th>KM</th>
                                    <th>Tutar</th>
                                    <th>İşlem</th>
                                    <th>Aksiyon</th>
                                </tr>
                            </thead>
                            <tbody id="maintenance-table-body">
                                <tr><td colspan="7" style="text-align:center;">Yükleniyor...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </section>
'''

# Inject before OCR Modal
text = text.replace('<!-- OCR Onay Modalı -->', standalone_section + '\n    <!-- OCR Onay Modalı -->')

with open(r'templates\index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("HTML refactor completed.")
