/**
 * main.js
 * SPA mantığıyla ekranlar arası geçişleri, Raporlama modüllerini
 * ve backend (API) iletişimini yönetir.
 */

document.addEventListener('DOMContentLoaded', () => {
    const {
        parseTurkishPlate,
        matchRegisteredPlate,
        mapOverlayToVideoSource
    } = window.PlateOcrUtils;

    // ---- PWA Service Worker Registration ----
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/service-worker.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    }

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
        invalidateOcrSession();
        isOcrProcessing = false;
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
        
        isPlateListReady = false;
        if (triggerOcrBtn) {
            triggerOcrBtn.textContent = '⏳ Kamera hazırlanıyor...';
            triggerOcrBtn.disabled = true;
        }

        const platesPromise = loadPlatesForDashboard().finally(() => {
            isPlateListReady = true;
        });
        renderStep();
        
        const cameraPromise = window.cameraController
            ? window.cameraController.startCamera()
            : Promise.reject(new Error('Kamera denetleyicisi bulunamadı.'));

        Promise.allSettled([platesPromise, cameraPromise]).then(() => {
            if (triggerOcrBtn && dashboardSection.classList.contains('active')) {
                triggerOcrBtn.textContent = '📷 Plakayı Oku';
                triggerOcrBtn.disabled = false;
            }
        });
    }

    let ocrWorker = null;
    let ocrWorkerPromise = null;
    let isOcrProcessing = false;
    let isPlateListReady = false;
    let ocrSessionId = 0;
    const OCR_MIN_CONFIDENCE = 45;
    const GEMINI_TIMEOUT_MS = 7000;
    const TESSERACT_STAGE_TIMEOUT_MS = 8000;

    // Singleton Tesseract Worker Promise
    async function ensureOcrWorker() {
        if (ocrWorker) return ocrWorker;
        if (ocrWorkerPromise) return ocrWorkerPromise;

        ocrWorkerPromise = (async () => {
            if (typeof Tesseract === 'undefined') {
                throw new Error("Tesseract.js global nesnesi bulunamadı. Lütfen internet bağlantınızı kontrol edin.");
            }

            let worker = null;
            try {
                worker = await Tesseract.createWorker('eng', 1, {
                    logger: message => {}
                });

                await worker.setParameters({
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
                    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
                    preserve_interword_spaces: '1'
                });

                ocrWorker = worker;
                return worker;
            } catch (err) {
                if (worker) {
                    await worker.terminate().catch(() => {});
                }
                ocrWorker = null;
                ocrWorkerPromise = null;
                throw err;
            }
        })();

        try {
            return await ocrWorkerPromise;
        } catch (error) {
            ocrWorkerPromise = null;
            throw error;
        }
    }


    class OcrTimeoutError extends Error {
        constructor() {
            super("OCR Zaman Aşımı");
            this.name = "OcrTimeoutError";
        }
    }

    async function resetOcrWorker() {
        const worker = ocrWorker;
        ocrWorker = null;
        ocrWorkerPromise = null;
        if (worker) {
            await worker.terminate().catch(e => console.warn("OCR worker sonlandırılamadı:", e));
        }
    }

    async function recognizeWithTimeout(worker, canvas, timeoutMs) {
        let timerId;
        try {
            return await Promise.race([
                worker.recognize(canvas),
                new Promise((_, reject) => {
                    timerId = setTimeout(() => reject(new OcrTimeoutError()), timeoutMs);
                })
            ]);
        } finally {
            clearTimeout(timerId);
        }
    }

    // Kamera veya modal kapandığında OCR sürecini sonlandır
    function invalidateOcrSession() {
        ocrSessionId += 1;
    }

    // Modal DOM Elements
    const triggerOcrBtn = document.getElementById('trigger-ocr-btn');
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
    const ocrOriginalCanvas = document.getElementById('ocr-original-crop-canvas'); // Yeni eklendi

    let currentOcrPlate = null;
    let currentOcrSource = null;

    function findRegisteredPlateOption(plateText) {
        const options = Array.from(plateSelect.options).filter(option => option.value);
        const match = matchRegisteredPlate(
            plateText,
            options.map(option => option.dataset.plate || option.value)
        );
        if (!match) return null;

        return options.find(option => {
            const candidate = parseTurkishPlate(option.dataset.plate || option.value);
            return candidate?.normalized === match.normalized;
        }) || null;
    }

    function checkPlateInDb(plateText) {
        const opt = findRegisteredPlateOption(plateText);
        return opt ? opt.value : null;
    }


    function calculateOcrSize(width, height) {
        const maxWidth = 1600;
        const minWidth = 800;
        let targetWidth = Math.min(maxWidth, Math.max(minWidth, width * 2));
        const scale = targetWidth / width;
        return {
            width: Math.round(targetWidth),
            height: Math.round(height * scale)
        };
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
            const val = gray > thresholdValue ? 0 : 255;
            data[i] = data[i+1] = data[i+2] = val;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    async function requestServerOcr(canvas) {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), GEMINI_TIMEOUT_MS);

        try {
            const response = await fetch('/api/gemini-ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: canvas.toDataURL('image/jpeg', 0.86) }),
                signal: abortController.signal
            });
            const data = await response.json().catch(() => ({}));

            if (response.ok && data.success && data.plate) {
                return parseTurkishPlate(data.plate);
            }

            if (response.status === 401) {
                window.showToast('Sunucu oturumu sona erdi; yerel OCR deneniyor.', 'warning');
            } else if (response.status === 429) {
                window.showToast('Sunucu OCR sınırına ulaşıldı; yerel OCR deneniyor.', 'warning');
            }
            return null;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.warn('Sunucu OCR isteği başarısız oldu:', error);
            }
            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function requestLocalOcr(ctx, canvas, originalImageData, sessionId) {
        triggerOcrBtn.textContent = '⏳ Yerel OCR hazırlanıyor...';
        const worker = await ensureOcrWorker();
        const registeredPlates = Array.from(plateSelect.options)
            .filter(option => option.value)
            .map(option => option.dataset.plate || option.value);
        const candidates = [];
        const stages = [
            { name: 'Original', apply: () => {} },
            { name: 'Grayscale', apply: (c, w, h) => processGrayscale(c, w, h) },
            { name: 'Threshold', apply: (c, w, h) => processThreshold(c, w, h, 135) },
            { name: 'Inverted', apply: (c, w, h) => processInvertedThreshold(c, w, h, 135) }
        ];

        for (const stage of stages) {
            if (sessionId !== ocrSessionId) {
                return null;
            }

            triggerOcrBtn.textContent = `⏳ Yerel OCR: ${stage.name}`;
            ctx.putImageData(originalImageData, 0, 0);
            stage.apply(ctx, canvas.width, canvas.height);

            const result = await recognizeWithTimeout(worker, canvas, TESSERACT_STAGE_TIMEOUT_MS);
            if (sessionId !== ocrSessionId) {
                return null;
            }

            const recognizedText = result.data.text || '';
            const confidence = Number(result.data.confidence) || 0;
            const registeredMatch = matchRegisteredPlate(recognizedText, registeredPlates);
            const parsed = registeredMatch
                ? parseTurkishPlate(registeredMatch.normalized)
                : parseTurkishPlate(recognizedText);

            if (parsed && (confidence >= OCR_MIN_CONFIDENCE || registeredMatch)) {
                candidates.push({
                    text: parsed.normalized,
                    confidence,
                    corrected: Boolean(registeredMatch?.corrected),
                    parts: [
                        parsed.provinceCode.toString().padStart(2, '0'),
                        parsed.letters,
                        parsed.digits
                    ],
                    canvasContext: ctx.getImageData(0, 0, canvas.width, canvas.height),
                    canvasW: canvas.width,
                    canvasH: canvas.height
                });

                if (confidence >= 85 && !registeredMatch?.corrected) {
                    break;
                }
            }
        }

        candidates.sort((left, right) => {
            const leftRegistered = findRegisteredPlateOption(left.text) ? 1 : 0;
            const rightRegistered = findRegisteredPlateOption(right.text) ? 1 : 0;
            return rightRegistered - leftRegistered || right.confidence - left.confidence;
        });
        return candidates[0] || null;
    }

    function showOcrResult(bestMatch, source) {
        currentOcrPlate = bestMatch.text;
        currentOcrSource = source;

        if (ocrDebugCanvas) {
            ocrDebugCanvas.width = bestMatch.canvasW;
            ocrDebugCanvas.height = bestMatch.canvasH;
            ocrDebugCanvas.getContext('2d').putImageData(bestMatch.canvasContext, 0, 0);
        }

        ocrResultText.textContent = bestMatch.parts.join(' ');

        if (source === 'gemini') {
            ocrConfidence.textContent = 'Sunucu OCR sonucu';
            ocrConfidence.style.color = '#4ade80';
        } else {
            const correctionNote = bestMatch.corrected ? ' • kayıtlı plakayla düzeltildi' : '';
            ocrConfidence.textContent = `%${Math.round(bestMatch.confidence)} • Yerel OCR${correctionNote}`;
            ocrConfidence.style.color = bestMatch.confidence > 80 ? '#4ade80' : '#facc15';
        }

        const currentMatchedOption = findRegisteredPlateOption(currentOcrPlate);
        if (currentMatchedOption) {
            currentOcrPlate = currentMatchedOption.value;
            ocrDbStatus.textContent = '✅ Sistemde Bulundu';
            ocrDbStatus.style.color = '#4ade80';
            ocrConfirmBtn.disabled = false;
            ocrConfirmBtn.style.opacity = '1';
        } else {
            ocrDbStatus.textContent = '❌ Kayıtlı Değil';
            ocrDbStatus.style.color = '#ef4444';
            ocrConfirmBtn.disabled = true;
            ocrConfirmBtn.style.opacity = '0.5';
        }

        ocrManualEditContainer.classList.add('hidden');
        ocrConfirmModal.classList.remove('hidden');
    }

    if (triggerOcrBtn) {
        triggerOcrBtn.addEventListener('click', async () => {
            const video = window.cameraController?.videoElement;
            const videoReady = video
                && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
                && video.videoWidth > 0
                && video.videoHeight > 0;

            if (isOcrProcessing) {
                return;
            }
            if (!isPlateListReady) {
                window.showToast('Kayıtlı plakalar henüz yükleniyor.', 'warning');
                return;
            }
            if (!videoReady) {
                window.showToast('Kamera görüntüsü henüz hazır değil.', 'error');
                return;
            }

            isOcrProcessing = true;
            triggerOcrBtn.textContent = '⏳ Plaka okunuyor...';
            triggerOcrBtn.disabled = true;
            const sessionId = ocrSessionId;

            try {
                const roiBox = document.getElementById('ocr-roi-box');
                const computedStyle = getComputedStyle(video);
                const sourceCrop = mapOverlayToVideoSource({
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                    displayRect: video.getBoundingClientRect(),
                    overlayRect: roiBox.getBoundingClientRect(),
                    objectFit: computedStyle.objectFit,
                    objectPosition: computedStyle.objectPosition
                });

                const canvas = document.createElement('canvas');
                const ocrSize = calculateOcrSize(sourceCrop.w, sourceCrop.h);
                canvas.width = ocrSize.width;
                canvas.height = ocrSize.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) throw new Error('Canvas 2D bağlamı oluşturulamadı.');

                ctx.drawImage(
                    video,
                    sourceCrop.x,
                    sourceCrop.y,
                    sourceCrop.w,
                    sourceCrop.h,
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );
                const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                if (ocrOriginalCanvas) {
                    ocrOriginalCanvas.width = canvas.width;
                    ocrOriginalCanvas.height = canvas.height;
                    ocrOriginalCanvas.getContext('2d').putImageData(originalImageData, 0, 0);
                }

                const serverResult = await requestServerOcr(canvas);
                if (sessionId !== ocrSessionId) return;

                let bestMatch = null;
                let source = null;
                if (serverResult) {
                    bestMatch = {
                        text: serverResult.normalized,
                        confidence: null,
                        corrected: false,
                        parts: [
                            serverResult.provinceCode.toString().padStart(2, '0'),
                            serverResult.letters,
                            serverResult.digits
                        ],
                        canvasContext: originalImageData,
                        canvasW: canvas.width,
                        canvasH: canvas.height
                    };
                    source = 'gemini';
                } else {
                    bestMatch = await requestLocalOcr(
                        ctx,
                        canvas,
                        originalImageData,
                        sessionId
                    );
                    source = bestMatch ? 'tesseract' : null;
                }

                if (sessionId !== ocrSessionId) return;
                if (bestMatch) {
                    showOcrResult(bestMatch, source);
                } else {
                    window.showToast(
                        'Plaka net okunamadı. Plakayı çerçeveye yaklaştırıp tekrar deneyin.',
                        'error'
                    );
                }
            } catch (error) {
                if (error instanceof OcrTimeoutError || error.name === 'OcrTimeoutError') {
                    await resetOcrWorker();
                    window.showToast('Yerel OCR zaman aşımına uğradı; tekrar deneyin.', 'error');
                } else if (sessionId === ocrSessionId) {
                    console.error('OCR hatası:', error);
                    window.showToast(
                        'Plaka okunamadı. İnternet bağlantısını ve kamera netliğini kontrol edin.',
                        'error'
                    );
                }
            } finally {
                isOcrProcessing = false;
                if (triggerOcrBtn && dashboardSection.classList.contains('active')) {
                    triggerOcrBtn.textContent = '📷 Plakayı Oku';
                    triggerOcrBtn.disabled = false;
                }
            }
        });
    }

    // Modal Event Listeners
    if (ocrConfirmBtn) {
        ocrConfirmBtn.addEventListener('click', () => {
            const rawValue = ocrManualEditContainer.classList.contains('hidden') ? currentOcrPlate : ocrManualInput.value;
            const registeredValue = checkPlateInDb(rawValue);
            
            if (registeredValue) {
                plateSelect.value = registeredValue;
                processBtn.disabled = false;
                closeCameraSafely();
                window.showToast(`Plaka Onaylandı: ${registeredValue}`, 'success');
            } else {
                window.showToast('Girilen plaka sistemde kayıtlı değil!', 'error');
            }
        });
    }

    if (ocrRetryBtn) {
        ocrRetryBtn.addEventListener('click', () => {
            ocrConfirmModal.classList.add('hidden');
            invalidateOcrSession();
        });
    }

    if (ocrEditBtn) {
        ocrEditBtn.addEventListener('click', () => {
            ocrManualEditContainer.classList.remove('hidden');
            ocrManualInput.value = currentOcrPlate;
            ocrManualInput.focus();
            validateManualInput(); // İlk açıldığında buton durumunu kontrol et
        });
    }

    if (ocrManualInput) {
        ocrManualInput.addEventListener('input', validateManualInput);
    }

    function validateManualInput() {
        const val = ocrManualInput.value;
        const registeredValue = checkPlateInDb(val);
        if (registeredValue) {
            ocrConfirmBtn.disabled = false;
            ocrConfirmBtn.style.opacity = "1";
        } else {
            ocrConfirmBtn.disabled = true;
            ocrConfirmBtn.style.opacity = "0.5";
        }
    }

    function clearCanvas(canvas) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Global Camera Cleanup Logic
    function closeCameraSafely() {
        invalidateOcrSession();
        if (window.cameraController) {
            window.cameraController.stopCamera();
        }
        if (ocrConfirmModal) {
            ocrConfirmModal.classList.add('hidden');
        }
        isOcrProcessing = false;
        if (triggerOcrBtn) {
            triggerOcrBtn.innerHTML = '📷 Plakayı Oku';
            triggerOcrBtn.disabled = false;
        }
        
        currentOcrPlate = null;
        currentOcrSource = null;
        if (ocrManualInput) ocrManualInput.value = "";
        clearCanvas(ocrOriginalCanvas);
        clearCanvas(ocrDebugCanvas);
    }

    // Bind cleanup to navigation and page close events
    window.addEventListener("pagehide", closeCameraSafely);
    window.addEventListener("beforeunload", closeCameraSafely);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            closeCameraSafely();
        } else if (dashboardSection.classList.contains('active') && state.currentStep === 1) {
            triggerOcrBtn.disabled = true;
            triggerOcrBtn.textContent = '⏳ Kamera hazırlanıyor...';
            window.cameraController?.startCamera().finally(() => {
                if (dashboardSection.classList.contains('active')) {
                    triggerOcrBtn.textContent = '📷 Plakayı Oku';
                    triggerOcrBtn.disabled = false;
                }
            });
        }
    });

    // Modal Close buttons bindings
    const cancelBtns = document.querySelectorAll('.cancel-btn, .close-modal-btn');
    cancelBtns.forEach(btn => {
        btn.addEventListener('click', closeCameraSafely);
    });


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
            opt.value = p; opt.dataset.plate = p; opt.textContent = p;
            plateSelect.appendChild(opt);
        });
        if (state.plate) plateSelect.value = state.plate;
    }

    async function loadPlatesForReport() {
        const plates = await fetchPlatesAPI();
        reportPlateSelect.innerHTML = '<option value="" disabled selected>Plaka Seçin...</option>';
        plates.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p; opt.dataset.plate = p; opt.textContent = p;
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
