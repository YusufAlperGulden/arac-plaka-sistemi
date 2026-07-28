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
    const actionTypeSelect = document.getElementById('action-type-select');
    const mileageInput = document.getElementById('mileage-input');
    const notesInput = document.getElementById('notes-input');
    
    const processBtn = document.getElementById('process-btn');
    const processBtnText = document.getElementById('process-btn-text');

    // Uygulama Durumu (State)
    let state = {
        username: null,
        currentAction: null, // 'pickup' veya 'dropoff'
        currentStep: 1,      // 1: Plaka, 2: Kilometre
        plate: null,
        actionType: null,
        mileage: null,
        notes: null
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

    function startProcess(title, actionTypeStr) {
        state.currentAction = actionTypeStr;
        state.currentStep = 1;
        state.plate = null;
        state.actionType = null;
        state.mileage = null;
        state.notes = null;
        
        dashboardTitle.textContent = title;
        
        hideAllSections();
        dashboardSection.classList.remove('hidden');
        dashboardSection.classList.add('active');
        
        loadPlatesForDashboard();
        renderStep();
        
        if (window.cameraController) {
            window.cameraController.startCamera();
        }
        
        // Kamera açıldığında (veya işlem başladığında) lazy-load OCR
        initOcrWorker();
    }
    
    let ocrWorker = null;
    let isOcrProcessing = false;
    const OCR_MIN_CONFIDENCE = 50; // Konfigüre edilebilir güven skoru sınırı

    // Tesseract Worker'ı asenkron olarak başlat
    async function initOcrWorker() {
        const triggerOcrBtn = document.getElementById('trigger-ocr-btn');
        if (triggerOcrBtn && !ocrWorker) {
            triggerOcrBtn.innerHTML = '⏳ OCR Motoru Yükleniyor...';
            triggerOcrBtn.disabled = true;
        }

        if (!ocrWorker && typeof Tesseract !== 'undefined') {
            try {
                ocrWorker = await Tesseract.createWorker('eng', 1, {
                    logger: m => {}
                });
                await ocrWorker.setParameters({
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
                    preserve_interword_spaces: '1'
                });
                console.log("Tesseract Worker hazır.");
                
                if (triggerOcrBtn) {
                    triggerOcrBtn.innerHTML = '📷 Plakayı Oku';
                    triggerOcrBtn.disabled = false;
                }
            } catch (error) {
                console.error("Tesseract yüklenemedi:", error);
                if (triggerOcrBtn) {
                    triggerOcrBtn.innerHTML = '⚠️ OCR Yüklenemedi';
                    triggerOcrBtn.disabled = true;
                }
            }
        }
    }

    const triggerOcrBtn = document.getElementById('trigger-ocr-btn');
    
    // Modal DOM Elements
    const ocrConfirmModal = document.getElementById('ocr-confirm-modal');
    const ocrResultText = document.getElementById('ocr-result-text');
    const ocrConfidence = document.getElementById('ocr-confidence');
    const ocrDbStatus = document.getElementById('ocr-db-status');
    const ocrConfirmBtn = document.getElementById('ocr-confirm-btn');
    const ocrEditBtn = document.getElementById('ocr-edit-btn');
    const ocrRetryBtn = document.getElementById('ocr-retry-btn');
    const ocrManualEditContainer = document.getElementById('ocr-manual-edit-container');
    const ocrManualInput = document.getElementById('ocr-manual-input');
    const ocrDebugCanvas = document.getElementById('ocr-debug-canvas');

    let currentOcrPlate = null;

    function normalizePlate(text) {
        let clean = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        // Basit bağlamsal düzeltmeler (İl kodu için)
        if (clean.length >= 2) {
            let firstTwo = clean.substring(0, 2).replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5').replace(/B/g, '8');
            clean = firstTwo + clean.substring(2);
        }
        return clean;
    }

    function checkPlateInDb(plateText) {
        for (let i = 0; i < plateSelect.options.length; i++) {
            if (plateSelect.options[i].value === plateText) {
                return true;
            }
        }
        return false;
    }

    /**
     * mapOverlayToVideoSource
     * Saf (pure) fonksiyon: Ekranda görünen ROI kutusunu, orijinal video piksel koordinatlarına dönüştürür.
     */
    function mapOverlayToVideoSource({ videoWidth, videoHeight, displayRect, overlayRect, objectFit }) {
        let scaleX = videoWidth / displayRect.width;
        let scaleY = videoHeight / displayRect.height;
        let scale;
        
        if (objectFit === 'cover') {
            scale = Math.min(scaleX, scaleY); // Cover için minimum scale (görüntü taşıyor)
        } else {
            scale = Math.max(scaleX, scaleY); // Contain için maximum scale (görüntü tam sığıyor)
        }

        const displayedWidth = videoWidth / scale;
        const displayedHeight = videoHeight / scale;
        
        // object-position: center (default) varsayılmıştır.
        const offsetX = (displayRect.width - displayedWidth) / 2;
        const offsetY = (displayRect.height - displayedHeight) / 2;

        const roiX = overlayRect.left - displayRect.left;
        const roiY = overlayRect.top - displayRect.top;

        const sourceX = (roiX - offsetX) * scale;
        const sourceY = (roiY - offsetY) * scale;
        const sourceW = overlayRect.width * scale;
        const sourceH = overlayRect.height * scale;

        return { x: sourceX, y: sourceY, w: sourceW, h: sourceH };
    }
    
    // İşleme fonksiyonları
    function processGrayscale(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            data[i] = data[i+1] = data[i+2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
    }
    
    function processThreshold(ctx, width, height, thresholdValue) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            const val = gray > thresholdValue ? 255 : 0;
            data[i] = data[i+1] = data[i+2] = val;
        }
        ctx.putImageData(imageData, 0, 0);
    }
    
    function processInvertedThreshold(ctx, width, height, thresholdValue) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            const val = gray > thresholdValue ? 0 : 255; // Ters
            data[i] = data[i+1] = data[i+2] = val;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    if (triggerOcrBtn) {
        triggerOcrBtn.addEventListener('click', async () => {
            if (isOcrProcessing || !ocrWorker || !window.cameraController || !window.cameraController.videoElement || window.cameraController.videoElement.readyState !== 4) {
                window.showToast("Kamera veya OCR motoru henüz hazır değil.", "error");
                return;
            }
            
            isOcrProcessing = true;
            const originalText = triggerOcrBtn.innerHTML;
            triggerOcrBtn.innerHTML = '⏳ İşleniyor...';
            triggerOcrBtn.disabled = true;

            try {
                const video = window.cameraController.videoElement;
                const roiBox = document.getElementById('ocr-roi-box');
                
                // 1. Koordinat Eşleme ve Kırpma (object-fit: cover uyumlu)
                const sourceCrop = mapOverlayToVideoSource({
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                    displayRect: video.getBoundingClientRect(),
                    overlayRect: roiBox.getBoundingClientRect(),
                    objectFit: 'cover' // CSS'teki değere göre
                });
                
                const canvas = document.createElement('canvas');
                // 2x Scale for better OCR
                canvas.width = sourceCrop.w * 2;
                canvas.height = sourceCrop.h * 2;
                const ctx = canvas.getContext('2d');
                
                // Staged Preprocessing Pipeline (Kademeli Fallback)
                const stages = [
                    { name: 'Grayscale', apply: (c, w, h) => processGrayscale(c, w, h) },
                    { name: 'Threshold', apply: (c, w, h) => processThreshold(c, w, h, 128) },
                    { name: 'Inverted', apply: (c, w, h) => processInvertedThreshold(c, w, h, 128) }
                ];
                
                let bestMatch = null;
                
                for (const stage of stages) {
                    console.log(`OCR Denemesi: ${stage.name}`);
                    // Orijinal görüntüyü çiz
                    ctx.drawImage(video, sourceCrop.x, sourceCrop.y, sourceCrop.w, sourceCrop.h, 0, 0, canvas.width, canvas.height);
                    
                    // İşlemi uygula
                    stage.apply(ctx, canvas.width, canvas.height);
                    
                    // OCR
                    const result = await ocrWorker.recognize(canvas, {
                        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE
                    });
                    
                    const text = result.data.text;
                    const confidence = result.data.confidence;
                    const normalizedText = normalizePlate(text);
                    const plateRegex = /^([0-9]{2})([A-Z]{1,3})([0-9]{2,4})$/i;
                    const match = plateRegex.exec(normalizedText);
                    
                    if (match && confidence >= OCR_MIN_CONFIDENCE) {
                        bestMatch = {
                            text: normalizedText,
                            confidence: confidence,
                            parts: [match[1], match[2], match[3]],
                            canvasContext: ctx.getImageData(0, 0, canvas.width, canvas.height),
                            canvasW: canvas.width,
                            canvasH: canvas.height
                        };
                        break; // Geçerli plaka bulununca pipeline'ı durdur (Early return)
                    }
                }
                
                if (bestMatch) {
                    currentOcrPlate = bestMatch.text;
                    
                    // Debug Canvas'a sonucu çiz
                    if (ocrDebugCanvas) {
                        ocrDebugCanvas.width = bestMatch.canvasW;
                        ocrDebugCanvas.height = bestMatch.canvasH;
                        ocrDebugCanvas.getContext('2d').putImageData(bestMatch.canvasContext, 0, 0);
                    }
                    
                    // Modal'ı Doldur
                    ocrResultText.textContent = bestMatch.parts[0] + " " + bestMatch.parts[1] + " " + bestMatch.parts[2];
                    ocrConfidence.textContent = "%" + Math.round(bestMatch.confidence);
                    
                    if (bestMatch.confidence > 80) {
                        ocrConfidence.style.color = "#4ade80";
                        ocrConfidence.innerHTML += " (Yüksek)";
                    } else {
                        ocrConfidence.style.color = "#facc15";
                        ocrConfidence.innerHTML += " (Düşük güven, lütfen kontrol edin!)";
                    }
                    
                    const isRegistered = checkPlateInDb(currentOcrPlate);
                    if (isRegistered) {
                        ocrDbStatus.innerHTML = '✅ Sistemde Bulundu';
                        ocrDbStatus.style.color = "#4ade80";
                        ocrConfirmBtn.disabled = false;
                        ocrConfirmBtn.style.opacity = "1";
                    } else {
                        ocrDbStatus.innerHTML = '❌ Kayıtlı Değil';
                        ocrDbStatus.style.color = "#ef4444";
                        
                        // Sadece kayıtlı araçları seçmeye izin verdiğimiz için Onayla butonunu kapattık.
                        // Kullanıcı "Elle Düzelt" ile farklı bir plaka deneyebilir.
                        ocrConfirmBtn.disabled = true;
                        ocrConfirmBtn.style.opacity = "0.5";
                    }
                    
                    ocrManualEditContainer.classList.add('hidden');
                    ocrConfirmModal.classList.remove('hidden');
                    
                } else {
                    window.showToast('Plaka net okunamadı. Çerçeveye tam oturtup tekrar deneyin.', 'error');
                }
            } catch (err) {
                console.error("OCR Hatası:", err);
                window.showToast('Okuma işlemi sırasında hata oluştu.', 'error');
            } finally {
                isOcrProcessing = false;
                triggerOcrBtn.innerHTML = originalText;
                triggerOcrBtn.disabled = false;
            }
        });
    }

    // Modal Event Listeners
    if (ocrConfirmBtn) {
        ocrConfirmBtn.addEventListener('click', () => {
            const finalPlate = ocrManualEditContainer.classList.contains('hidden') ? currentOcrPlate : normalizePlate(ocrManualInput.value);
            
            if (checkPlateInDb(finalPlate)) {
                plateSelect.value = finalPlate;
                processBtn.disabled = false;
                ocrConfirmModal.classList.add('hidden');
                window.showToast(`Plaka Onaylandı: ${finalPlate}`, 'success');
                if (window.cameraController) window.cameraController.stopCamera();
            } else {
                window.showToast('Girilen plaka sistemde kayıtlı değil!', 'error');
            }
        });
    }

    if (ocrRetryBtn) {
        ocrRetryBtn.addEventListener('click', () => {
            ocrConfirmModal.classList.add('hidden');
        });
    }

    if (ocrEditBtn) {
        ocrEditBtn.addEventListener('click', () => {
            ocrManualEditContainer.classList.remove('hidden');
            ocrManualInput.value = currentOcrPlate;
            ocrManualInput.focus();
            
            // Kullanıcı düzenleme moduna geçince onayla butonunu aç (ancak yine de kayıtlıysa çalışacak)
            ocrConfirmBtn.disabled = false;
            ocrConfirmBtn.style.opacity = "1";
        });
    }
    function renderStep() {
        if (state.currentStep === 1) {
            step1Dot.classList.add('active');
            step1Dot.classList.remove('completed');
            step2Dot.classList.remove('active');
            
            instructionText.textContent = 'Plakayı okutun veya menüden plakayı seçin.';
            cameraOverlayText.textContent = 'Plakayı okutun';
            
            manualTitle.textContent = 'Araç ve İşlem Seçimi';
            manualSubtitle.textContent = 'Kayıtlı plakayı ve hareket tipini seçin.';
            
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
            
            manualTitle.textContent = 'Kilometre ve Açıklama';
            manualSubtitle.textContent = `Plaka: ${state.plate} | Tip: ${state.actionType}`;
            
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
            state.actionType = actionTypeSelect.value;
            window.showToast('Plaka onaylandı. Lütfen kilometre girin.', 'success');
            state.currentStep = 2;
            renderStep();
            
        } else if (state.currentStep === 2) {
            state.mileage = mileageInput.value.trim();
            state.notes = notesInput.value.trim();
            
            // Backend'e kaydet (ACTIVE_TRIPS / RECORDS_DB mantığı)
            try {
                processBtn.disabled = true;
                const response = await fetch('/api/record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        plate: state.plate,
                        action: state.currentAction, // 'pickup' veya 'dropoff'
                        action_type: state.actionType, // 'Periyodik Bakım' vb.
                        mileage: state.mileage,
                        user: state.username,
                        notes: state.notes
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    window.showToast(result.message, 'success');
                } else {
                    window.showToast(result.message || 'Kayıt sırasında hata oluştu.', 'error');
                }
            } catch (error) {
                console.error("Kayıt hatası:", error);
                window.showToast('Sunucu ile iletişim kurulamadı.', 'error');
            } finally {
                mileageInput.value = '';
                notesInput.value = '';
                plateSelect.value = '';
                processBtn.disabled = false;
                
                setTimeout(() => showActionSelection(), 2500);
            }
        }
    });


    // ---- RAPORLAR MENÜSÜ AKIŞI ----
    
    // Rapor state
    let currentRecords = [];
    const filterActionType = document.getElementById('filter-action-type');
    const globalSearch = document.getElementById('global-search');
    const sortBy = document.getElementById('sort-by');

    reportMenuBtn.addEventListener('click', () => {
        hideAllSections();
        reportsMenuSection.classList.remove('hidden');
        reportsMenuSection.classList.add('active');
    });

    backFromReportsMenuBtn.addEventListener('click', showActionSelection);

    reportRecentBtn.addEventListener('click', () => {
        reportTitle.textContent = "🕒 Son Hareket Raporu";
        fetchAndShowReport('/api/reports/recent');
    });

    reportVehicleBtn.addEventListener('click', () => {
        hideAllSections();
        vehicleReportSelectionSection.classList.remove('hidden');
        vehicleReportSelectionSection.classList.add('active');
        
        loadPlatesForReport();
    });
    
    backFromVehicleSelectBtn.addEventListener('click', () => {
        hideAllSections();
        reportsMenuSection.classList.remove('hidden');
        reportsMenuSection.classList.add('active');
    });
    
    reportPlateSelect.addEventListener('change', (e) => {
        viewVehicleReportBtn.disabled = (e.target.value === "");
    });
    
    viewVehicleReportBtn.addEventListener('click', () => {
        const selectedPlate = reportPlateSelect.value;
        if(selectedPlate) {
            reportTitle.textContent = `🚗 Araç Raporu: ${selectedPlate}`;
            fetchAndShowReport(`/api/reports/plate/${encodeURIComponent(selectedPlate)}`);
        }
    });

    backToReportsMenuBtn.addEventListener('click', () => {
        hideAllSections();
        reportsMenuSection.classList.remove('hidden');
        reportsMenuSection.classList.add('active');
    });

    // Filtreleme ve Sıralama Event Listener'ları
    filterActionType.addEventListener('change', applyFiltersAndSort);
    globalSearch.addEventListener('input', applyFiltersAndSort);
    sortBy.addEventListener('change', applyFiltersAndSort);

    async function fetchAndShowReport(apiUrl) {
        hideAllSections();
        reportDetailSection.classList.remove('hidden');
        reportDetailSection.classList.add('active');
        
        reportTableBody.innerHTML = '<tr><td colspan="11" style="text-align:center;">Yükleniyor...</td></tr>';
        
        // Reset filters
        filterActionType.value = 'all';
        globalSearch.value = '';
        sortBy.value = 'date-desc';

        try {
            const response = await fetch(apiUrl);
            const result = await response.json();
            
            if (response.ok && result.success) {
                currentRecords = result.records; // Veriyi kaydet
                applyFiltersAndSort(); // Tabloyu render et
            } else {
                reportTableBody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#ef4444;">Veriler alınamadı.</td></tr>';
                window.showToast('Raporlar alınamadı.', 'error');
            }
        } catch (error) {
            console.error("Rapor API hatası:", error);
            reportTableBody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#ef4444;">Sunucu bağlantı hatası.</td></tr>';
            window.showToast('Sunucu ile iletişim kurulamadı.', 'error');
        }
    }

    function parseDate(dateStr) {
        // Örn format: "19.01.2026 15:12:16"
        if (!dateStr) return new Date(0);
        const parts = dateStr.split(' ');
        if(parts.length !== 2) return new Date(0);
        const dateParts = parts[0].split('.');
        const timeParts = parts[1].split(':');
        if(dateParts.length !== 3 || timeParts.length !== 3) return new Date(0);
        
        // Date(year, monthIndex, day, hours, minutes, seconds)
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]);
    }

    function applyFiltersAndSort() {
        let filtered = [...currentRecords];

        // Filtreleme - Hareket Tipi
        const typeFilter = filterActionType.value;
        if (typeFilter !== 'all') {
            filtered = filtered.filter(r => (r.action_type || '').includes(typeFilter));
        }

        // Filtreleme - Global Arama (Plaka, Araç, Sürücü, Not)
        const searchVal = globalSearch.value.toLowerCase().trim();
        if (searchVal !== '') {
            filtered = filtered.filter(r => {
                const combinedString = `${r.plate || ''} ${r.vehicle_name || ''} ${r.driver || ''} ${r.notes || ''}`.toLowerCase();
                return combinedString.includes(searchVal);
            });
        }

        // Sıralama
        const sortMode = sortBy.value;
        filtered.sort((a, b) => {
            if (sortMode === 'date-desc') {
                return parseDate(b.add_date) - parseDate(a.add_date);
            } else if (sortMode === 'date-asc') {
                return parseDate(a.add_date) - parseDate(b.add_date);
            } else if (sortMode === 'distance-desc') {
                return parseFloat(b.distance || 0) - parseFloat(a.distance || 0);
            } else if (sortMode === 'distance-asc') {
                return parseFloat(a.distance || 0) - parseFloat(b.distance || 0);
            } else if (sortMode === 'plate-asc') {
                return (a.plate || '').localeCompare(b.plate || '');
            } else if (sortMode === 'plate-desc') {
                return (b.plate || '').localeCompare(a.plate || '');
            } else if (sortMode === 'driver-asc') {
                return (a.driver || '').localeCompare(b.driver || '');
            } else if (sortMode === 'driver-desc') {
                return (b.driver || '').localeCompare(a.driver || '');
            }
            return 0;
        });

        renderTable(filtered);
    }

    function renderTable(records) {
        reportTableBody.innerHTML = '';
        
        if (records.length === 0) {
            reportTableBody.innerHTML = '<tr><td colspan="11" style="text-align:center;">Henüz bir kayıt bulunmuyor.</td></tr>';
            return;
        }
        
        records.forEach(record => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${record.action_type || '-'}</td>
                <td>${record.add_date || '-'}</td>
                <td>${record.vehicle_name || '-'}</td>
                <td><strong>${record.plate || '-'}</strong></td>
                <td>${record.driver || '-'}</td>
                <td>${record.start_mileage || '-'}</td>
                <td>${record.end_mileage || '-'}</td>
                <td>${record.start_date || '-'}</td>
                <td><strong>${record.distance || '0'}</strong></td>
                <td>${record.end_date || '-'}</td>
                <td>${record.notes || ''}</td>
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
