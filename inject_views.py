import re

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

with open(r'templates\index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# We need to find the end of the maintenance-reminders-view div and maintenance-reminders-section
# The structure is:
# <div id="maintenance-reminders-view">
#   ... form ...
#   ... table ...
# </div> <!-- this is missing! -->
# wait, in fix_html_2.py I did:
# replacement = '</div>\n' + tabs_html + '\n            <div id="maintenance-reminders-view">\n            <form id="maintenance-reminder-form"'
# This opened the div "maintenance-reminders-view", but didn't close it!

# Let's fix this properly.
# Find the exact place to close maintenance-reminders-view, and insert the other views.
# It should be before `</section>` which precedes `<!-- OCR Onay Modalı -->`

# Let's do a regex to find the end of the section
match = re.search(r'(</section>\s*)(<!-- OCR Onay)', text)
if match:
    injection = f'</div>\n{add_view_html}\n{list_view_html}\n        </div>\n    ' + match.group(1) + match.group(2)
    text = text[:match.start()] + injection + text[match.end():]
    with open(r'templates\index.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Injected successfully.")
else:
    print("Could not find the insertion point.")

