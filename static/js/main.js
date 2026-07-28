/**
 * main.js
 * SPA mantığıyla ekranlar arası geçişleri ve
 * Multi-Step (İşlem Seçimi -> Plaka -> Kilometre) iş akışını yönetir.
 */

document.addEventListener('DOMContentLoaded', () => {
    // UI Ekranları
    const loginSection = document.getElementById('login-section');
    const actionSection = document.getElementById('action-selection-section');
    const dashboardSection = document.getElementById('dashboard-section');
    
    // İşlem Butonları (Araç Alma / Teslim Etme)
    const pickupBtn = document.getElementById('action-pickup');
    const dropoffBtn = document.getElementById('action-dropoff');
    const actionLogoutBtn = document.getElementById('action-logout-btn');
    
    // Dashboard Header ve Indicator
    const dashboardTitle = document.getElementById('dashboard-title');
    const backToActionsBtn = document.getElementById('back-to-actions-btn');
    const step1Dot = document.getElementById('step-1-dot');
    const step2Dot = document.getElementById('step-2-dot');
    const instructionText = document.getElementById('instruction-text');
    
    // Kamera ve İçerik Yönetimi
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

    // Global: Giriş sonrası tetiklenir (auth.js tarafından çağırılır)
    window.switchToDashboard = function(username) {
        state.username = username;
        
        loginSection.classList.remove('active');
        loginSection.classList.add('hidden');
        
        showActionSelection();
    };

    // İşlem Seçimi Ekranını Göster
    function showActionSelection() {
        dashboardSection.classList.remove('active');
        dashboardSection.classList.add('hidden');
        
        actionSection.classList.remove('hidden');
        actionSection.classList.add('active');
        
        // Hoşgeldin mesajını isme göre güncelle
        document.getElementById('welcome-message').textContent = `Hoş geldin ${state.username}, lütfen yapmak istediğiniz işlemi seçin.`;
        
        // Kamera açıksa kapat
        if (window.cameraController) {
            window.cameraController.stopCamera();
        }
    }

    // Araç Alma Butonu
    pickupBtn.addEventListener('click', () => {
        startProcess('Araç Alma', 'pickup');
    });

    // Teslim Etme Butonu
    dropoffBtn.addEventListener('click', () => {
        startProcess('Teslim Etme', 'dropoff');
    });

    // Geri Dön Butonu (Dashboard -> Action Selection)
    backToActionsBtn.addEventListener('click', () => {
        showActionSelection();
    });

    // Çıkış Butonu (Action Selection Ekranında)
    actionLogoutBtn.addEventListener('click', logout);

    // Süreci Başlat
    function startProcess(title, actionType) {
        state.currentAction = actionType;
        state.currentStep = 1;
        state.plate = null;
        state.mileage = null;
        
        dashboardTitle.textContent = title;
        
        actionSection.classList.remove('active');
        actionSection.classList.add('hidden');
        
        dashboardSection.classList.remove('hidden');
        dashboardSection.classList.add('active');
        
        // Backend'den kayıtlı plakaları çek
        loadPlates();
        
        // 1. Adımı render et
        renderStep();
        
        // Kamerayı başlat
        if (window.cameraController) {
            window.cameraController.startCamera();
        }
    }

    // Bulunulan Adıma (Step) Göre UI'ı Güncelle
    function renderStep() {
        if (state.currentStep === 1) {
            // ADIM 1: PLAKA OKUMA
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
            
            // Seçili plaka yoksa butonu disable yap
            processBtn.disabled = plateSelect.value === "";
            
        } else if (state.currentStep === 2) {
            // ADIM 2: KİLOMETRE GİRİŞİ
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
            
            // Kilometre boşsa butonu disable yap
            processBtn.disabled = mileageInput.value === "";
        }
    }

    // Input Değişiklikleri
    plateSelect.addEventListener('change', (e) => {
        if (state.currentStep === 1) {
            processBtn.disabled = (e.target.value === "");
        }
    });

    mileageInput.addEventListener('input', (e) => {
        if (state.currentStep === 2) {
            processBtn.disabled = (e.target.value.trim() === "");
        }
    });

    // Ortak "İleri / Tamamla" Butonu
    processBtn.addEventListener('click', () => {
        if (state.currentStep === 1) {
            // Plaka adımından Kilometre adımına geçiş
            state.plate = plateSelect.value;
            window.showToast('Plaka onaylandı. Lütfen kilometreyi girin.', 'success');
            
            state.currentStep = 2;
            renderStep();
            
        } else if (state.currentStep === 2) {
            // İşlemi Bitirme
            state.mileage = mileageInput.value.trim();
            
            const actionStr = state.currentAction === 'pickup' ? 'Araç Alma' : 'Teslim Etme';
            window.showToast(`${actionStr} işlemi başarıyla tamamlandı!<br>Plaka: ${state.plate} | KM: ${state.mileage}`, 'success');
            
            // Inputu temizle ve ana menüye dön
            mileageInput.value = '';
            plateSelect.value = '';
            
            setTimeout(() => {
                showActionSelection();
            }, 2500); // Kullanıcı mesajı görsün diye hafif bekleme
        }
    });

    // API: Plakaları Getir
    async function loadPlates() {
        try {
            const response = await fetch('/api/plates');
            const result = await response.json();
            
            if (response.ok && result.success) {
                populateDropdown(result.plates);
            } else {
                window.showToast('Kayıtlı plakalar getirilemedi.', 'error');
            }
        } catch (error) {
            window.showToast('Sunucu bağlantı hatası.', 'error');
        }
    }

    function populateDropdown(plates) {
        plateSelect.innerHTML = '<option value="" disabled selected>Plaka Seçin...</option>';
        plates.forEach(plate => {
            const option = document.createElement('option');
            option.value = plate;
            option.textContent = plate;
            plateSelect.appendChild(option);
        });
        
        // Eğer geri dönülmüşse eski seçimi koru
        if (state.plate) {
            plateSelect.value = state.plate;
        }
    }

    // Çıkış Yapma Fonksiyonu
    function logout() {
        if (window.cameraController) {
            window.cameraController.stopCamera();
        }
        
        state = { username: null, currentAction: null, currentStep: 1, plate: null, mileage: null };
        
        document.getElementById('login-form').reset();
        
        actionSection.classList.remove('active');
        actionSection.classList.add('hidden');
        dashboardSection.classList.remove('active');
        dashboardSection.classList.add('hidden');
        
        loginSection.classList.remove('hidden');
        loginSection.classList.add('active');
        
        window.showToast('Başarıyla çıkış yapıldı.', 'success');
    }
});
