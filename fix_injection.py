import re

with open(r'templates\index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. First, let's remove the wrongly injected code block near the bottom.
# It starts with '</div>\n            <!-- Ekleme Formu (YENİ) -->'
# and ends with '        </div>\n    </section>' and then '<!-- OCR Onay'
# Let's just find '<!-- Ekleme Formu (YENİ) -->' and remove until '        </div>\n    ' (before OCR Onay)
wrong_injection_pattern = re.compile(r'</div>\s*<!-- Ekleme Formu \(YENİ\) -->.*?<!-- Listeleme Ekranı \(YENİ\) -->.*?</div>\s*</div>\s*', re.DOTALL)
text = wrong_injection_pattern.sub('', text)

# 2. Add descriptions as user requested:
# "Bence buraya hamburgee menüsünde yazan bilgileri eklemeliydin."

add_view_html = '''
            <!-- Ekleme Formu (YENİ) -->
            <div id="maintenance-add-view" class="hidden">
                <div style="margin-bottom:15px; color:var(--text-secondary); text-align:center;">
                    <p>Araçlarınızın servis, bakım ve onarım geçmişlerini buradan sisteme kaydedebilirsiniz.</p>
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
                            <textarea id="maintenance-desc" rows="3" placeholder="Örn: Periyodik bakım, yağ değişimi, filtreler değiştirildi vs."></textarea>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Kaydet</button>
                    </div>
                </form>
            </div>
'''

list_view_html = '''
            <!-- Listeleme Ekranı (YENİ) -->
            <div id="maintenance-list-view" class="hidden">
                <div style="margin-bottom:15px; color:var(--text-secondary); text-align:center;">
                    <p>Sisteme daha önceden kaydedilmiş tüm araç bakım geçmişi dökümü.</p>
                </div>
                <div class="management-list aria-live="polite">
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
                                </tr>
                            </thead>
                            <tbody id="maintenance-table-body">
                                <tr><td colspan="6" style="text-align:center;">Yükleniyor...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
'''

# 3. Inject it at the right place!
# The right place is inside `#maintenance-reminders-section`, right before its closing `</section>`.
# Wait, `#maintenance-reminders-section` is followed by `<!-- Devam Eden Kullanımlar Panosu -->`.
# Let's find `<!-- Devam Eden Kullanımlar Panosu -->` and put it before that.

correct_injection_point = r'(\s*</section>\s*<!-- Devam Eden Kullanımlar Panosu -->)'
match = re.search(correct_injection_point, text)
if match:
    # Also I need to close the `</div>` for `<div class="glass-card management-wrapper">` 
    # Because my previous script removed it? No, wait. 
    # The structure of `#maintenance-reminders-section` is:
    # <section id="maintenance-reminders-section">
    #    <div class="glass-card management-wrapper">
    #       ...
    #    </div>
    # </section>
    
    # We should inject it just before `</div>\n    </section>\n\n    <!-- Devam Eden Kullanımlar Panosu -->`
    
    inject_target = r'(\s*</div>\s*</section>\s*<!-- Devam Eden Kullanımlar Panosu -->)'
    match_inner = re.search(inject_target, text)
    if match_inner:
        replacement = '\n' + add_view_html + '\n' + list_view_html + match_inner.group(1)
        text = text[:match_inner.start()] + replacement + text[match_inner.end():]
        with open(r'templates\index.html', 'w', encoding='utf-8') as f:
            f.write(text)
        print("Injected into correct place.")
    else:
        print("Could not find the exact closing tags of maintenance-reminders-section.")
else:
    print("Could not find 'Devam Eden Kullanımlar Panosu'.")

