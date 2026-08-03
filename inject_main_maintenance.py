import re

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

with open(r'templates\index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Make sure it isn't already there
if 'id="main-maintenance-section"' not in text:
    text = text.replace('<!-- OCR Onay Modalı (Overlay) -->', standalone_section + '\n    <!-- OCR Onay Modalı (Overlay) -->')
    with open(r'templates\index.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Injected main-maintenance-section successfully!")
else:
    print("Section already exists.")

