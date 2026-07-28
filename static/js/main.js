/**
 * main.js
 * SPA mantığıyla ekranlar arası geçişleri, Raporlama modüllerini
 * ve backend (API) iletişimini yönetir.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ---- EKRAN BÖLÜMLERİ (SECTIONS) ----
    const loginSection = document.getElementById('login-section');
    const actionSection = document.getElementById('action-selection-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const reportsMenuSection = document.getElementById('reports-menu-section');
    const vehicleReportSelectionSection = document.getElementById('vehicle-report-selection-section');
    const reportDetailSection = document.getElementById('report-detail-section');
    
    // ---- İŞLEM SEÇİM EKRANI BUTONLARI ----
    const pickupBtn = document.getElementById('action-pickup');
    const dropoffBtn = document.getElementById('action-dropoff');
    const reportMenuBtn = document.getElementById('action-report-btn');
    const actionLogoutBtn = document.getElementById('action-logout-btn');
    
    // ---- RAPORLAR MENÜSÜ BUTONLARI ----
    const reportRecentBtn = document.getElementById('report-recent-btn');
    const reportVehicleBtn = document.getElementById('report-vehicle-btn');
    const backFromReportsMenuBtn = document.getElementById('back-from-reports-menu-btn');

    // ---- ARAÇ BAZLI RAPOR SEÇİM EKRANI ----
    const reportPlateSelect = document.getElementById('report-plate-select');
    const viewVehicleReportBtn = document.getElementById('view-vehicle-report-btn');
    const backFromVehicleSelectBtn = document.getElementById('back-from-vehicle-select-btn');
    
    // ---- RAPOR DETAY EKRANI ----
    const backToReportsMenuBtn = document.getElementById('back-to-reports-menu-btn');
    const reportTableBody = document.getElementById('report-table-body');
    const reportTitle = document.getElementById('report-title');
    
    // ---- DASHBOARD (İŞLEM) EKRANI UI ELEMENTLERİ ----
    const dashboardTitle = document.getElementById('dashboard-title');
    const backToActionsBtn = document.getElementById('back-to-actions-btn');
    const step1Dot = document.getElementById('step-1-dot');
    const step2Dot = document.getElementById('step-2-dot');
    const instructionText = document.getElementById('instruction-text');
    
    const cameraOverlayText = document.getElementById('camera-overlay-text');
    const stepPlateContainer = document.getElementById('step-plate-container');
    const stepMileageContainer = document.getElementById('step-mileage-container');
    
    const manualTitle = document.getElementById('manual-title');
    const manualSubtitle = document.getElementById('manual-subtitle');
    
    const plateSelect = document.getElementById('plate-select');
    const mileageInput = document.getElementById('mileage-input');
    
    const processBtn = document.getElementById('process-btn');
    const processBtnText = document.getElementById('process-btn-text');

    // Uygulama Durumu (State)
    let state = {
        username: null,
        currentAction: null, // 'pickup' veya 'dropoff'
        currentStep: 1,      // 1: Plaka, 2: Kilometre
        plate: null,
        mileage: null
    };

    // Tüm ekranları gizleme yardımcı fonksiyonu
    function hideAllSections() {
        const sections = document.querySelectorAll('.screen-section');
        sections.forEach(sec => {
            sec.classList.remove('active');
            sec.classList.add('hidden');
        });
        
        // Kamera açıksa kapat
        if (window.cameraController) {
            window.cameraController.stopCamera();
        }
    }

    // Global: Giriş sonrası tetiklenir (auth.js)
    window.switchToDashboard = function(username) {
        state.username = username;
        showActionSelection();
    };

    // İşlem Seçimi Ekranını Göster
    function showActionSelection() {
        hideAllSections();
        actionSection.classList.remove('hidden');
        actionSection.classList.add('active');
        
        document.getElementById('welcome-message').textContent = `Hoş geldin ${state.username}, lütfen yapmak istediğiniz işlemi seçin.`;
    }

    // ---- DASHBOARD / İŞLEM (KAMERA) AKIŞI ----
    pickupBtn.addEventListener('click', () => startProcess('Araç Alma', 'pickup'));
    dropoffBtn.addEventListener('click', () => startProcess('Teslim Etme', 'dropoff'));
    backToActionsBtn.addEventListener('click', showActionSelection);
    actionLogoutBtn.addEventListener('click', logout);

    function startProcess(title, actionType) {
        state.currentAction = actionType;
        state.currentStep = 1;
        state.plate = null;
        state.mileage = null;
        
        dashboardTitle.textContent = title;
        
        hideAllSections();
        dashboardSection.classList.remove('hidden');
        dashboardSection.classList.add('active');
        
        loadPlatesForDashboard();
        renderStep();
        
        if (window.cameraController) {
            window.cameraController.startCamera();
        }
    }

    function renderStep() {
        if (state.currentStep === 1) {
            step1Dot.classList.add('active');
            step1Dot.classList.remove('completed');
            step2Dot.classList.remove('active');
            
            instructionText.textContent = 'Plakayı okutun veya menüden plakayı seçin.';
            cameraOverlayText.textContent = 'Plakayı okutun';
            
            manualTitle.textContent = 'Manuel Plaka Seçimi';
            manualSubtitle.textContent = 'Sisteme kayıtlı plakalardan birini seçebilirsiniz.';
            
            stepPlateContainer.classList.remove('hidden');
            stepMileageContainer.classList.add('hidden');
            
            processBtnText.textContent = 'İleri: Kilometre';
            processBtn.disabled = plateSelect.value === "";
            
        } else if (state.currentStep === 2) {
            step1Dot.classList.remove('active');
            step1Dot.classList.add('completed');
            step2Dot.classList.add('active');
            
            instructionText.textContent = 'Kilometreyi okutun veya manuel olarak girin.';
            cameraOverlayText.textContent = 'Kilometreyi okutun';
            
            manualTitle.textContent = 'Manuel Kilometre Girişi';
            manualSubtitle.textContent = `Plaka: ${state.plate}`;
            
            stepPlateContainer.classList.add('hidden');
            stepMileageContainer.classList.remove('hidden');
            
            processBtnText.textContent = 'İşlemi Tamamla';
            processBtn.disabled = mileageInput.value === "";
        }
    }

    plateSelect.addEventListener('change', (e) => {
        if (state.currentStep === 1) processBtn.disabled = (e.target.value === "");
    });

    mileageInput.addEventListener('input', (e) => {
        if (state.currentStep === 2) processBtn.disabled = (e.target.value.trim() === "");
    });

    // İŞLEM ONAYI VE BACKEND'E KAYIT (POST)
    processBtn.addEventListener('click', async () => {
        if (state.currentStep === 1) {
            state.plate = plateSelect.value;
            window.showToast('Plaka onaylandı. Lütfen kilometreyi girin.', 'success');
            state.currentStep = 2;
            renderStep();
            
        } else if (state.currentStep === 2) {
            state.mileage = mileageInput.value.trim();
            const actionStr = state.currentAction === 'pickup' ? 'Araç Alma' : 'Teslim Etme';
            
            // Backend'e kaydet
            try {
                processBtn.disabled = true;
                const response = await fetch('/api/record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        plate: state.plate,
                        action: actionStr,
                        mileage: state.mileage,
                        user: state.username
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    window.showToast(`${actionStr} başarıyla kaydedildi!<br>Plaka: ${state.plate} | KM: ${state.mileage}`, 'success');
                } else {
                    window.showToast(result.message || 'Kayıt sırasında hata oluştu.', 'error');
                }
            } catch (error) {
                console.error("Kayıt hatası:", error);
                window.showToast('Sunucu ile iletişim kurulamadı.', 'error');
            } finally {
                mileageInput.value = '';
                plateSelect.value = '';
                processBtn.disabled = false;
                
                setTimeout(() => showActionSelection(), 2500);
            }
        }
    });


    // ---- RAPORLAR MENÜSÜ AKIŞI ----
    
    // Raporlar Menüsünü Aç
    reportMenuBtn.addEventListener('click', () => {
        hideAllSections();
        reportsMenuSection.classList.remove('hidden');
        reportsMenuSection.classList.add('active');
    });

    // Menüden Geri Dön
    backFromReportsMenuBtn.addEventListener('click', showActionSelection);

    // 1- Son Hareket Raporu
    reportRecentBtn.addEventListener('click', () => {
        reportTitle.textContent = "Son Hareket Raporu";
        fetchAndShowReport('/api/reports/recent');
    });

    // 2- Araç Bazlı Rapor Seçim Ekranını Aç
    reportVehicleBtn.addEventListener('click', () => {
        hideAllSections();
        vehicleReportSelectionSection.classList.remove('hidden');
        vehicleReportSelectionSection.classList.add('active');
        
        loadPlatesForReport(); // Plakaları dropdown'a doldur
    });
    
    backFromVehicleSelectBtn.addEventListener('click', () => {
        hideAllSections();
        reportsMenuSection.classList.remove('hidden');
        reportsMenuSection.classList.add('active');
    });
    
    reportPlateSelect.addEventListener('change', (e) => {
        viewVehicleReportBtn.disabled = (e.target.value === "");
    });
    
    // Araç Raporunu Görüntüle Butonu
    viewVehicleReportBtn.addEventListener('click', () => {
        const selectedPlate = reportPlateSelect.value;
        if(selectedPlate) {
            reportTitle.textContent = `Araç Raporu: ${selectedPlate}`;
            fetchAndShowReport(`/api/reports/plate/${encodeURIComponent(selectedPlate)}`);
        }
    });

    // Rapor Detayından Geri Dön
    backToReportsMenuBtn.addEventListener('click', () => {
        hideAllSections();
        reportsMenuSection.classList.remove('hidden');
        reportsMenuSection.classList.add('active');
    });

    // Raporu Backend'den Çek ve Tabloya Bas
    async function fetchAndShowReport(apiUrl) {
        hideAllSections();
        reportDetailSection.classList.remove('hidden');
        reportDetailSection.classList.add('active');
        
        reportTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Yükleniyor...</td></tr>';
        
        try {
            const response = await fetch(apiUrl);
            const result = await response.json();
            
            if (response.ok && result.success) {
                renderTable(result.records);
            } else {
                reportTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444;">Veriler alınamadı.</td></tr>';
                window.showToast('Raporlar alınamadı.', 'error');
            }
        } catch (error) {
            console.error("Rapor API hatası:", error);
            reportTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444;">Sunucu bağlantı hatası.</td></tr>';
            window.showToast('Sunucu ile iletişim kurulamadı.', 'error');
        }
    }

    function renderTable(records) {
        reportTableBody.innerHTML = '';
        
        if (records.length === 0) {
            reportTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Henüz bir kayıt bulunmuyor.</td></tr>';
            return;
        }
        
        records.forEach(record => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${record.timestamp}</td>
                <td><strong>${record.plate}</strong></td>
                <td>${record.action}</td>
                <td>${record.mileage} KM</td>
                <td>${record.user}</td>
            `;
            reportTableBody.appendChild(tr);
        });
    }

    // ---- API YARDIMCI FONKSİYONLAR (PLAKALARI GETİRME) ----
    
    async function fetchPlatesAPI() {
        try {
            const response = await fetch('/api/plates');
            const result = await response.json();
            if (response.ok && result.success) {
                return result.plates;
            }
        } catch (error) {
            console.error("Plaka API hatası:", error);
        }
        return [];
    }

    async function loadPlatesForDashboard() {
        const plates = await fetchPlatesAPI();
        plateSelect.innerHTML = '<option value="" disabled selected>Plaka Seçin...</option>';
        plates.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            plateSelect.appendChild(opt);
        });
        if (state.plate) plateSelect.value = state.plate;
    }

    async function loadPlatesForReport() {
        const plates = await fetchPlatesAPI();
        reportPlateSelect.innerHTML = '<option value="" disabled selected>Plaka Seçin...</option>';
        plates.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.textContent = p;
            reportPlateSelect.appendChild(opt);
        });
        viewVehicleReportBtn.disabled = true;
    }

    // Çıkış Yapma
    function logout() {
        hideAllSections();
        state = { username: null, currentAction: null, currentStep: 1, plate: null, mileage: null };
        document.getElementById('login-form').reset();
        
        loginSection.classList.remove('hidden');
        loginSection.classList.add('active');
        
        window.showToast('Başarıyla çıkış yapıldı.', 'success');
    }
});
