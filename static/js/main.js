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
        ensureOcrWorker().catch(e => console.error("Ön yükleme hatası:", e));
    }

    let ocrWorker = null;
    let ocrWorkerPromise = null;
    let isOcrProcessing = false;
    let ocrSessionId = 0;
    const OCR_MIN_CONFIDENCE = 50;
    const OCR_TOTAL_TIMEOUT_MS = 15000;

    // Singleton Tesseract Worker Promise
    async function ensureOcrWorker() {
        if (ocrWorker) return ocrWorker;
        if (ocrWorkerPromise) return ocrWorkerPromise;

        const triggerOcrBtn = document.getElementById('trigger-ocr-btn');
        if (triggerOcrBtn) {
            triggerOcrBtn.innerHTML = '⏳ OCR Motoru Yükleniyor...';
            triggerOcrBtn.disabled = true;
        }

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
            const worker = await ocrWorkerPromise;
            if (triggerOcrBtn) {
                triggerOcrBtn.innerHTML = '📷 Plakayı Oku';
                triggerOcrBtn.disabled = false;
            }
            return worker;
        } catch (error) {
            ocrWorkerPromise = null;
            if (triggerOcrBtn) {
                triggerOcrBtn.innerHTML = '⚠️ OCR Yüklenemedi';
                triggerOcrBtn.disabled = true;
            }
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

    /**
     * Plaka ayrıştırma ve İl kodu (01-81) doğrulaması.
     */
    function parseTurkishPlate(value) {
        if (!value) return null;
        let clean = value.toUpperCase();
        
        // Find a pattern that looks like a plate anywhere in the text
        // E.g. "TR 34 ABC 123" -> match "34 ABC 123"
        // Replace O->0, I->1, S->5, B->8 only in the first two characters?
        // Actually, let's find the regex first:
        // Match 2 digits, 1-3 letters, 2-4 digits with optional spaces/dashes between
        const regex = /(?:^|\b|\s|[^A-Z0-9])(\d{2})[\s\-]*([A-Z]{1,3})[\s\-]*(\d{2,4})(?:$|\b|\s|[^A-Z0-9])/i;
        
        // Before matching, if there are common OCR mistakes in province code, we could fix them,
        // but it's safer to just run the regex if we assume it's somewhat clean, or clean the string first.
        // Let's do a basic global replace for O->0, I->1, etc. ONLY on the first two chars of the whole string? No, that's risky.
        
        let match = regex.exec(clean);
        if (!match) {
            // Try aggressive replace on the whole string as fallback
            let aggressive = clean.replace(/[^A-Z0-9]/g, '');
            if (aggressive.length >= 2) {
                let firstTwo = aggressive.substring(0, 2).replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5').replace(/B/g, '8');
                aggressive = firstTwo + aggressive.substring(2);
            }
            match = /^(\d{2})([A-Z]{1,3})(\d{2,4})$/.exec(aggressive);
        }
        
        if (!match) return null;

        const provinceCode = Number(match[1]);
        if (!Number.isInteger(provinceCode) || provinceCode < 1 || provinceCode > 81) {
            return null; // İl kodu hatalı
        }

        return {
            normalized: match[1] + match[2] + match[3],
            provinceCode,
            letters: match[2],
            digits: match[3]
        };
    }

    function findRegisteredPlateOption(plateText) {
        const target = parseTurkishPlate(plateText);
        if (!target) return null;

        return Array.from(plateSelect.options).find(option => {
            const candidate = option.dataset.plate || option.textContent;
            return parseTurkishPlate(candidate)?.normalized === target.normalized;
        }) || null;
    }

    function checkPlateInDb(plateText) {
        const opt = findRegisteredPlateOption(plateText);
        return opt ? opt.value : null;
    }


    /**
     * Saf (pure) fonksiyon: Ekranda görünen ROI kutusunu, orijinal video piksel koordinatlarına dönüştürür.
     */
    function mapOverlayToVideoSource({ videoWidth, videoHeight, displayRect, overlayRect, objectFit, objectPosition }) {
        if (videoWidth <= 0 || videoHeight <= 0 || displayRect.width <= 0 || displayRect.height <= 0) {
            throw new Error("Video veya görüntü alanı henüz hazır değil.");
        }

        let scaleX = videoWidth / displayRect.width;
        let scaleY = videoHeight / displayRect.height;
        let scale;
        
        if (objectFit === 'cover') {
            scale = Math.min(scaleX, scaleY);
        } else if (objectFit === 'contain') {
            scale = Math.max(scaleX, scaleY);
        } else {
            scale = scaleX;
        }

        const displayedWidth = videoWidth / scale;
        const displayedHeight = videoHeight / scale;
        

        let posX = 0.5, posY = 0.5;
        if (objectPosition) {
            const parts = objectPosition.split(' ');
            const keywords = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };
            
            if (parts.length >= 2) {
                let parsedX = parts[0].trim().toLowerCase();
                let parsedY = parts[1].trim().toLowerCase();
                
                posX = parsedX in keywords ? keywords[parsedX] : (parsedX.endsWith('%') ? Number.parseFloat(parsedX) / 100 : 0.5);
                posY = parsedY in keywords ? keywords[parsedY] : (parsedY.endsWith('%') ? Number.parseFloat(parsedY) / 100 : 0.5);
                
                if (!Number.isFinite(posX)) posX = 0.5;
                if (!Number.isFinite(posY)) posY = 0.5;
            }
        }

        const offsetX = (displayRect.width - displayedWidth) * posX;
        const offsetY = (displayRect.height - displayedHeight) * posY;

        const roiX = overlayRect.left - displayRect.left;
        const roiY = overlayRect.top - displayRect.top;

        const rawSourceX = (roiX - offsetX) * scale;
        const rawSourceY = (roiY - offsetY) * scale;
        const rawSourceW = overlayRect.width * scale;
        const rawSourceH = overlayRect.height * scale;

        // Clamping (Sınır kısıtlaması)
        const x = Math.max(0, rawSourceX);
        const y = Math.max(0, rawSourceY);
        const right = Math.min(videoWidth, rawSourceX + rawSourceW);
        const bottom = Math.min(videoHeight, rawSourceY + rawSourceH);

        const w = right - x;
        const h = bottom - y;

        if (w <= 0 || h <= 0) {
            throw new Error("OCR ROI video karesinin tamamen dışında kaldı.");
        }

        const retainedWidth = w / rawSourceW;
        const retainedHeight = h / rawSourceH;

        if (retainedWidth < 0.95 || retainedHeight < 0.95) {
            throw new Error("Plaka çerçevesi kamera görüntüsüyle doğru hizalanmadı.");
        }

        return { x, y, w, h };

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

    if (triggerOcrBtn) {
        triggerOcrBtn.addEventListener('click', async () => {
            const video = window.cameraController?.videoElement;
            const videoReady = video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0;
            
            if (isOcrProcessing || !videoReady) {
                window.showToast("Kamera görüntüsü henüz hazır değil.", "error");
                return;
            }
            
            isOcrProcessing = true;
            const originalText = triggerOcrBtn.innerHTML;
            triggerOcrBtn.innerHTML = '⏳ İşleniyor...';
            triggerOcrBtn.disabled = true;

            const sessionId = ocrSessionId;

            try {
                // Ensure worker is fully initialized
                await ensureOcrWorker();

                if (sessionId !== ocrSessionId) return; // İptal edildi

                const video = window.cameraController.videoElement;
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
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("Canvas 2D bağlamı oluşturulamadı.");
                
                // Orijinal görüntüyü bir kez yakala
                ctx.drawImage(video, sourceCrop.x, sourceCrop.y, sourceCrop.w, sourceCrop.h, 0, 0, canvas.width, canvas.height);
                const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                if (ocrOriginalCanvas) {
                    ocrOriginalCanvas.width = canvas.width;
                    ocrOriginalCanvas.height = canvas.height;
                    ocrOriginalCanvas.getContext('2d').putImageData(originalImageData, 0, 0);
                }

                const stages = [
                    { name: 'Grayscale', apply: (c, w, h) => processGrayscale(c, w, h) },
                    { name: 'Threshold', apply: (c, w, h) => processThreshold(c, w, h, 128) },
                    { name: 'Inverted', apply: (c, w, h) => processInvertedThreshold(c, w, h, 128) }
                ];
                
                let bestMatch = null;
                let usedSource = null;
                const candidates = [];
                
                const abortController = new AbortController();
                const timeoutId = setTimeout(() => abortController.abort(), OCR_TOTAL_TIMEOUT_MS);

                const pipelinePromise = (async () => {
                    // Adım 1: Gemini API
                    try {
                        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
                        const response = await fetch('/api/gemini-ocr', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ image: base64Image }),
                            signal: abortController.signal
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            if (data.success && data.plate) {
                                const parsed = parseTurkishPlate(data.plate);
                                if (parsed) {
                                    bestMatch = {
                                        text: parsed.normalized,
                                        confidence: null, 
                                        parts: [parsed.provinceCode.toString().padStart(2, '0'), parsed.letters, parsed.digits],
                                        canvasContext: ctx.getImageData(0, 0, canvas.width, canvas.height),
                                        canvasW: canvas.width,
                                        canvasH: canvas.height
                                    };
                                    usedSource = "gemini";
                                }
                            }
                        } else {
                            console.warn("Gemini API HTTP Hata:", response.status);
                            if (response.status === 401) {
                                window.showToast('Oturum süresi doldu. Lütfen tekrar giriş yapın.', 'error');
                                setTimeout(() => window.location.reload(), 2000);
                                throw new Error("Unauthorized"); // Skip to fallback or abort
                            } else if (response.status === 429) {
                                window.showToast('Çok fazla istek yapıldı. Yerel OCR devreye giriyor.', 'error');
                            }
                        }
                    } catch (err) {
                        if (err.name === 'AbortError') throw new OcrTimeoutError();
                        console.warn("Gemini API isteği başarısız oldu, Tesseract Fallback başlıyor...", err);
                    }

                    // Adım 2: Fallback (Tesseract)
                    if (!bestMatch) {
                        for (const stage of stages) {
                            if (sessionId !== ocrSessionId) break;

                            ctx.putImageData(originalImageData, 0, 0);
                            stage.apply(ctx, canvas.width, canvas.height);
                            
                            const result = await ocrWorker.recognize(canvas);
                            if (sessionId !== ocrSessionId) break;

                            const text = result.data.text;
                            const confidence = result.data.confidence;
                            const parsed = parseTurkishPlate(text);
                            
                            if (parsed && confidence >= OCR_MIN_CONFIDENCE) {
                                candidates.push({
                                    text: parsed.normalized,
                                    confidence: confidence,
                                    parts: [parsed.provinceCode.toString().padStart(2, '0'), parsed.letters, parsed.digits],
                                    canvasContext: ctx.getImageData(0, 0, canvas.width, canvas.height),
                                    canvasW: canvas.width,
                                    canvasH: canvas.height
                                });
                                
                                if (confidence >= 85) {
                                    break;
                                }
                            }
                        }
                        if (candidates.length > 0) {
                            candidates.sort((a, b) => b.confidence - a.confidence);
                            bestMatch = candidates[0];
                            usedSource = "tesseract";
                        }
                    }
                })();

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new OcrTimeoutError()), OCR_TOTAL_TIMEOUT_MS);
                });

                await Promise.race([pipelinePromise, timeoutPromise]);
                clearTimeout(timeoutId);

                if (sessionId !== ocrSessionId) return; // İptal edildiyse UI işlemleri yapma
                
                if (bestMatch) {
                    currentOcrPlate = bestMatch.text;
                    currentOcrSource = usedSource;
                    
                    if (ocrDebugCanvas) {
                        ocrDebugCanvas.width = bestMatch.canvasW;
                        ocrDebugCanvas.height = bestMatch.canvasH;
                        ocrDebugCanvas.getContext('2d').putImageData(bestMatch.canvasContext, 0, 0);
                    }
                    
                    ocrResultText.textContent = bestMatch.parts[0] + " " + bestMatch.parts[1] + " " + bestMatch.parts[2];
                    
                    if (currentOcrSource === "gemini") {
                        ocrConfidence.textContent = "Gemini API sonucu";
                        ocrConfidence.style.color = "#4ade80";
                    } else {
                        ocrConfidence.textContent = "%" + Math.round(bestMatch.confidence);
                        if (bestMatch.confidence > 80) {
                            ocrConfidence.style.color = "#4ade80";
                            ocrConfidence.innerHTML += " (Yüksek, Yerel OCR)";
                        } else {
                            ocrConfidence.style.color = "#facc15";
                            ocrConfidence.innerHTML += " (Düşük güven, Yerel OCR, lütfen kontrol edin!)";
                        }
                    }
                    
                    let currentMatchedOption = findRegisteredPlateOption(currentOcrPlate);
                    if (currentMatchedOption) {
                        ocrDbStatus.innerHTML = '✅ Sistemde Bulundu';
                        ocrDbStatus.style.color = "#4ade80";
                        ocrConfirmBtn.disabled = false;
                        ocrConfirmBtn.style.opacity = "1";
                    } else {
                        ocrDbStatus.innerHTML = '❌ Kayıtlı Değil';
                        ocrDbStatus.style.color = "#ef4444";
                        ocrConfirmBtn.disabled = true;
                        ocrConfirmBtn.style.opacity = "0.5";
                    }
                    
                    ocrManualEditContainer.classList.add('hidden');
                    ocrConfirmModal.classList.remove('hidden');
                    
                } else {
                    window.showToast('Plaka net okunamadı. Çerçeveye tam oturtup tekrar deneyin.', 'error');
                }
            } catch (err) {
                if (err instanceof OcrTimeoutError || err.name === "OcrTimeoutError") {
                    invalidateOcrSession();
                    await resetOcrWorker();
                    window.showToast('İşlem zaman aşımına uğradı.', 'error');
                } else if (sessionId === ocrSessionId) {
                    console.error("OCR Hatası:", err);
                    window.showToast('Okuma işlemi sırasında hata oluştu.', 'error');
                }
            } finally {
                // UI Deadlock fix: always reset processing state even if session changed
                isOcrProcessing = false;
                if (triggerOcrBtn) {
                    if (ocrWorker) {
                        triggerOcrBtn.textContent = "📷 Plakayı Oku";
                        triggerOcrBtn.disabled = false;
                    } else {
                        triggerOcrBtn.textContent = "⚠️ OCR Yüklenemedi";
                        triggerOcrBtn.disabled = true;
                    }
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
        if (triggerOcrBtn && ocrWorker) {
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
