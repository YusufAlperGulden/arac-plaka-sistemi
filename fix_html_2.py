import re

with open(r'templates\index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Eski maintenance-section alanını çıkar (Eğer varsa)
maintenance_section_pattern = re.compile(r'<!-- Araç Bakım Takip Section -->\s*<section id="maintenance-section".*?</section>', re.DOTALL)
text = maintenance_section_pattern.sub('', text)

# Bakım ve Uyarılar section içerisine tab'leri ekle
tabs_html = '''
            <div style="display:flex; justify-content:space-around; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
                <button id="tab-maintenance-reminders" onclick="window.switchMaintenanceCenterTab('reminders')" style="background:none; border:none; color:var(--primary-color); font-weight:bold; cursor:pointer; font-size:16px;">Hatırlatıcılar</button>
                <button id="tab-maintenance-add" onclick="window.switchMaintenanceCenterTab('add')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:16px;">Yeni Bakım Ekle</button>
                <button id="tab-maintenance-list" onclick="window.switchMaintenanceCenterTab('list')" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:16px;">Bakım Geçmişi</button>
            </div>
'''

add_view_html = '''
            <!-- Ekleme Formu (YENİ) -->
            <div id="maintenance-add-view" class="hidden">
                <form id="maintenance-form" onsubmit="window.submitMaintenanceForm(event)">
                    <label for="maintenance-vehicle" style="margin-top:10px; display:block;">Araç (Plaka)</label>
                    <select id="maintenance-vehicle" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px;" required></select>

                    <label for="maintenance-company" style="margin-top:10px; display:block;">Bakım Firması</label>
                    <input type="text" id="maintenance-company" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px;" required placeholder="Firma Adı">

                    <label for="maintenance-date" style="margin-top:10px; display:block;">Bakım Tarihi</label>
                    <input type="date" id="maintenance-date" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px;" required>

                    <label for="maintenance-mileage" style="margin-top:10px; display:block;">Kilometre (KM)</label>
                    <input type="number" id="maintenance-mileage" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px;" required placeholder="Örn: 150000">

                    <label for="maintenance-cost" style="margin-top:10px; display:block;">Tutar (Opsiyonel)</label>
                    <input type="number" step="0.01" id="maintenance-cost" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px;" placeholder="Örn: 1500.50">

                    <label for="maintenance-desc" style="margin-top:10px; display:block;">Yapılan İşlemler / Açıklama</label>
                    <textarea id="maintenance-desc" rows="3" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px;" placeholder="Örn: Yağ değişimi, filtreler vs."></textarea>

                    <button type="submit" class="btn-primary" style="margin-top:20px; width:100%; padding:12px; border-radius:8px;">Kaydet</button>
                </form>
            </div>
'''

list_view_html = '''
            <!-- Listeleme Ekranı (YENİ) -->
            <div id="maintenance-list-view" class="hidden">
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
'''

# Find where to inject tabs (after management-header)
management_header_end = '</div>\n\n            <form id="maintenance-reminder-form"'
replacement = '</div>\n' + tabs_html + '\n            <div id="maintenance-reminders-view">\n            <form id="maintenance-reminder-form"'
text = text.replace(management_header_end, replacement)

# Wrap existing reminders view
# It ends with </table>\n                </div>\n            </div>
# wait, there are two table sections.
table_end_str = '</table>\n                </div>'
# Let's find the closing of the table wrapper and inject the new views.
# Let's find: `</section>` of `#maintenance-reminders-section`
reminder_section_end = '</section>\n\n    <!-- OCR Onay'
text = text.replace('</section>\n\n    <!-- OCR Onay', '</div>\n' + add_view_html + list_view_html + '\n        </div>\n    </section>\n\n    <!-- OCR Onay')

with open(r'templates\index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Step 3 completed.")
