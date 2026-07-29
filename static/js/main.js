/**
 * main.js
 * SPA mantığıyla ekranlar arası geçişleri, Raporlama modüllerini
 * ve backend (API) iletişimini yönetir.
 */

document.addEventListener('DOMContentLoaded', () => {
    const {
        parseTurkishPlate,
        resolvePlateForForm,
        matchRegisteredPlate,
        mapOverlayToVideoSource,
        buildVerticalScanCrops,
        plateCandidateIoU,
        plateCandidatesReferToSameRegion,
        selectTrackedPlateCandidate,
        detectPlateCandidates,
        mapPlateCandidatesToSource,
        orderOcrCropRegions,
        shouldAcceptOcrConsensus
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
    const plateDetectionBox = document.getElementById('plate-detection-box');
    const plateDetectionLabel = document.getElementById('plate-detection-label');
    const autoScanStatus = document.getElementById('auto-scan-status');
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
        stopAutoScan();
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

        Promise.allSettled([platesPromise, cameraPromise]).then(results => {
            if (triggerOcrBtn && dashboardSection.classList.contains('active')) {
                triggerOcrBtn.textContent = '🔍 Şimdi Tara';
                triggerOcrBtn.disabled = false;
            }
            if (results[1]?.status === 'fulfilled' && results[1].value !== false) {
                startAutoScan();
            } else {
                setAutoScanStatus(
                    'Kamera hazır değil; izin verip “Tekrar Dene” seçeneğini kullanın.',
                    'error'
                );
            }
        });
    }

    let ocrWorker = null;
    let ocrWorkerPromise = null;
    let isOcrProcessing = false;
    let isPlateListReady = false;
    let ocrSessionId = 0;
    const OCR_MIN_CONFIDENCE = 45;
    const OCR_CONSENSUS_MIN_CONFIDENCE = 28;
    const OCR_STRONG_CONFIDENCE = 82;
    const GEMINI_TIMEOUT_MS = 12000;
    const TESSERACT_STAGE_TIMEOUT_MS = 8000;
    const DETECTION_MAX_WIDTH = 520;
    const AUTO_SCAN_INTERVAL_MS = 900;
    const AUTO_SCAN_STABLE_FRAMES = 2;
    const AUTO_SCAN_MIN_SCORE = 0.48;
    const AUTO_SCAN_RETRY_COOLDOWN_MS = 12000;
    let autoScanTimer = null;
    let autoScanPreviousCandidate = null;
    let autoScanStableFrames = 0;
    let autoScanCooldownUntil = 0;
    let autoScanBlockedCandidate = [];
    let autoScanMissingFrames = 0;
    let detectionCanvas = null;
    let detectionContext = null;

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

    function getRegisteredPlateOptions() {
        return Array.from(plateSelect.options).filter(
            option => option.value && option.dataset.ocrTemporary !== 'true'
        );
    }

    function findRegisteredPlateOption(plateText) {
        const options = getRegisteredPlateOptions();
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

    function resolveOcrPlate(plateText) {
        const registeredOptions = getRegisteredPlateOptions();
        const resolvedPlate = resolvePlateForForm(
            plateText,
            registeredOptions.map(option => option.dataset.plate || option.value)
        );
        if (!resolvedPlate) {
            return null;
        }

        // Kullanıcının elle girdiği geçerli fakat benzer bir plakayı fuzzy
        // eşleştirmeyle yanlış kayıtlı araca çevirmemek için burada yalnız
        // birebir normalleştirilmiş eşleşme kullanılır.
        const registeredOption = resolvedPlate.registered
            ? registeredOptions.find(option => (
                parseTurkishPlate(option.dataset.plate || option.value)?.normalized
                === resolvedPlate.normalized
            )) || null
            : null;

        return { ...resolvedPlate, option: registeredOption };
    }

    function ensureOcrPlateOption(resolvedPlate) {
        if (resolvedPlate.option) {
            return resolvedPlate.option;
        }

        const existingOption = Array.from(plateSelect.options).find(option => {
            if (!option.value) return false;
            return parseTurkishPlate(option.dataset.plate || option.value)?.normalized
                === resolvedPlate.normalized;
        });
        if (existingOption) {
            return existingOption;
        }

        plateSelect
            .querySelectorAll('option[data-ocr-temporary="true"]')
            .forEach(option => option.remove());

        const option = document.createElement('option');
        option.value = resolvedPlate.normalized;
        option.dataset.plate = resolvedPlate.normalized;
        option.dataset.ocrTemporary = 'true';
        option.textContent = `${resolvedPlate.normalized} (OCR ile okundu)`;
        plateSelect.appendChild(option);
        return option;
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

    function captureFullVideoFrame(video) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
            throw new Error('Plaka tespit görüntüsü hazırlanamadı.');
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    function captureDetectionFrame(source) {
        const sourceWidth = source.videoWidth || source.width;
        const sourceHeight = source.videoHeight || source.height;
        const scale = Math.min(
            1,
            DETECTION_MAX_WIDTH / Math.max(sourceWidth, sourceHeight)
        );
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));

        if (!detectionCanvas) {
            detectionCanvas = document.createElement('canvas');
            detectionContext = detectionCanvas.getContext(
                '2d',
                { willReadFrequently: true }
            );
        }
        if (!detectionContext) {
            throw new Error('Plaka tespit görüntüsü hazırlanamadı.');
        }
        if (detectionCanvas.width !== width || detectionCanvas.height !== height) {
            detectionCanvas.width = width;
            detectionCanvas.height = height;
        }

        detectionContext.drawImage(source, 0, 0, width, height);
        const imageData = detectionContext.getImageData(0, 0, width, height);
        const candidates = detectPlateCandidates(
            imageData,
            width,
            height,
            { maxCandidates: 5 }
        );

        return {
            canvas: detectionCanvas,
            candidates,
            width,
            height,
        };
    }

    function detectionCandidateToSource(video, detection, candidate) {
        const scaleX = video.videoWidth / detection.width;
        const scaleY = video.videoHeight / detection.height;
        return {
            x: candidate.x * scaleX,
            y: candidate.y * scaleY,
            w: candidate.w * scaleX,
            h: candidate.h * scaleY,
        };
    }

    function sourceRectToVideoDisplay(video, sourceRect) {
        const displayRect = video.getBoundingClientRect();
        const style = getComputedStyle(video);
        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;
        const scaleX = displayRect.width / sourceWidth;
        const scaleY = displayRect.height / sourceHeight;
        let scale = scaleX;

        if (style.objectFit === 'cover') {
            scale = Math.max(scaleX, scaleY);
        } else if (style.objectFit === 'contain') {
            scale = Math.min(scaleX, scaleY);
        }

        const displayedWidth = sourceWidth * scale;
        const displayedHeight = sourceHeight * scale;
        const offsetX = (displayRect.width - displayedWidth) / 2;
        const offsetY = (displayRect.height - displayedHeight) / 2;
        const left = Math.max(0, sourceRect.x * scale + offsetX);
        const top = Math.max(0, sourceRect.y * scale + offsetY);
        const right = Math.min(
            displayRect.width,
            (sourceRect.x + sourceRect.w) * scale + offsetX
        );
        const bottom = Math.min(
            displayRect.height,
            (sourceRect.y + sourceRect.h) * scale + offsetY
        );

        return {
            x: left,
            y: top,
            w: Math.max(0, right - left),
            h: Math.max(0, bottom - top),
        };
    }

    function hideDetectionOverlay() {
        if (!plateDetectionBox) return;
        plateDetectionBox.classList.add('hidden');
        plateDetectionBox.classList.remove('stable');
        plateDetectionBox.setAttribute('aria-hidden', 'true');
    }

    function showDetectionOverlay(video, detection, candidate, isStable) {
        if (!plateDetectionBox || !candidate) {
            hideDetectionOverlay();
            return;
        }

        const sourceRect = detectionCandidateToSource(video, detection, candidate);
        const displayRect = sourceRectToVideoDisplay(video, sourceRect);
        if (displayRect.w <= 0 || displayRect.h <= 0) {
            hideDetectionOverlay();
            return;
        }

        plateDetectionBox.style.left = `${displayRect.x}px`;
        plateDetectionBox.style.top = `${displayRect.y}px`;
        plateDetectionBox.style.width = `${displayRect.w}px`;
        plateDetectionBox.style.height = `${displayRect.h}px`;
        plateDetectionBox.classList.remove('hidden');
        plateDetectionBox.classList.toggle('stable', isStable);
        plateDetectionBox.setAttribute('aria-hidden', 'false');
        if (plateDetectionLabel) {
            plateDetectionLabel.textContent = isStable
                ? 'Plaka bulundu • okunuyor'
                : 'Plaka bulundu • sabit tutun';
        }
    }

    function deduplicateCrops(crops, maximumCount = 6) {
        const selected = [];
        for (const crop of crops) {
            if (
                !crop
                || crop.w <= 0
                || crop.h <= 0
                || selected.some(existing => plateCandidateIoU(existing, crop) >= 0.76)
            ) {
                continue;
            }
            selected.push(crop);
            if (selected.length >= maximumCount) {
                break;
            }
        }
        return selected;
    }

    function buildOcrCropRegions(
        video,
        preferredDetection = null,
        { automatic = false, source = video } = {}
    ) {
        const capturedDetection = captureDetectionFrame(source);
        const previousCandidate = (
            preferredDetection?.preferredCandidate
            || preferredDetection?.candidates?.[0]
            || null
        );
        const trackedCandidate = selectTrackedPlateCandidate(
            capturedDetection.candidates,
            previousCandidate
        );
        const orderedCandidates = trackedCandidate
            ? [
                trackedCandidate,
                ...capturedDetection.candidates.filter(
                    candidate => candidate !== trackedCandidate
                ),
            ]
            : capturedDetection.candidates;
        const detection = {
            ...capturedDetection,
            candidates: orderedCandidates,
            preferredCandidate: trackedCandidate,
        };
        const sourceWidth = source.videoWidth || source.width;
        const sourceHeight = source.videoHeight || source.height;
        const automaticCrops = mapPlateCandidatesToSource(
            detection.candidates,
            {
                detectionWidth: detection.width,
                detectionHeight: detection.height,
                sourceWidth,
                sourceHeight,
            }
        );

        const roiBox = document.getElementById('ocr-roi-box');
        const computedStyle = getComputedStyle(video);
        const fallbackCrop = mapOverlayToVideoSource({
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            displayRect: video.getBoundingClientRect(),
            overlayRect: roiBox.getBoundingClientRect(),
            objectFit: computedStyle.objectFit,
            objectPosition: computedStyle.objectPosition
        });
        const fallbackCrops = buildVerticalScanCrops(fallbackCrop, sourceHeight);
        const sourceCrops = orderOcrCropRegions(
            automaticCrops,
            fallbackCrops,
            { automatic }
        );

        return { detection, sourceCrops };
    }

    function captureVideoCrop(video, sourceCrop) {
        const canvas = document.createElement('canvas');
        const ocrSize = calculateOcrSize(sourceCrop.w, sourceCrop.h);
        canvas.width = ocrSize.width;
        canvas.height = ocrSize.height;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            throw new Error('Canvas 2D bağlamı oluşturulamadı.');
        }

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

        return {
            canvas,
            ctx,
            originalImageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
            sourceCrop,
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

    function processAutoContrast(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const grayscale = new Uint8Array(width * height);
        const histogram = new Uint32Array(256);

        for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
            const gray = Math.round(
                0.299 * data[index]
                + 0.587 * data[index + 1]
                + 0.114 * data[index + 2]
            );
            grayscale[pixel] = gray;
            histogram[gray] += 1;
        }

        const lowTarget = grayscale.length * 0.03;
        const highTarget = grayscale.length * 0.97;
        let cumulative = 0;
        let low = 0;
        let high = 255;
        for (let value = 0; value < 256; value += 1) {
            cumulative += histogram[value];
            if (cumulative >= lowTarget) {
                low = value;
                break;
            }
        }
        cumulative = 0;
        for (let value = 0; value < 256; value += 1) {
            cumulative += histogram[value];
            if (cumulative >= highTarget) {
                high = value;
                break;
            }
        }

        const range = Math.max(1, high - low);
        for (let pixel = 0, index = 0; pixel < grayscale.length; pixel += 1, index += 4) {
            const stretched = Math.max(
                0,
                Math.min(255, Math.round((grayscale[pixel] - low) * 255 / range))
            );
            data[index] = data[index + 1] = data[index + 2] = stretched;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    function calculateOtsuThreshold(data) {
        const histogram = new Uint32Array(256);
        let total = 0;
        let weightedTotal = 0;

        for (let index = 0; index < data.length; index += 4) {
            const gray = Math.round(
                0.299 * data[index]
                + 0.587 * data[index + 1]
                + 0.114 * data[index + 2]
            );
            histogram[gray] += 1;
            weightedTotal += gray;
            total += 1;
        }

        let backgroundWeight = 0;
        let backgroundSum = 0;
        let bestVariance = -1;
        let bestThreshold = 128;

        for (let threshold = 0; threshold < 256; threshold += 1) {
            backgroundWeight += histogram[threshold];
            if (backgroundWeight === 0) continue;

            const foregroundWeight = total - backgroundWeight;
            if (foregroundWeight === 0) break;

            backgroundSum += threshold * histogram[threshold];
            const backgroundMean = backgroundSum / backgroundWeight;
            const foregroundMean = (
                weightedTotal - backgroundSum
            ) / foregroundWeight;
            const variance = (
                backgroundWeight
                * foregroundWeight
                * (backgroundMean - foregroundMean) ** 2
            );
            if (variance > bestVariance) {
                bestVariance = variance;
                bestThreshold = threshold;
            }
        }
        return bestThreshold;
    }

    function processOtsuThreshold(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const threshold = calculateOtsuThreshold(imageData.data);
        const data = imageData.data;
        for (let index = 0; index < data.length; index += 4) {
            const gray = (
                0.299 * data[index]
                + 0.587 * data[index + 1]
                + 0.114 * data[index + 2]
            );
            const value = gray > threshold ? 255 : 0;
            data[index] = data[index + 1] = data[index + 2] = value;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    function processAdaptiveThreshold(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const grayscale = new Uint8Array(width * height);
        const stride = width + 1;
        const integral = new Float64Array((width + 1) * (height + 1));

        for (let y = 0; y < height; y += 1) {
            let rowSum = 0;
            for (let x = 0; x < width; x += 1) {
                const dataIndex = (y * width + x) * 4;
                const gray = Math.round(
                    0.299 * data[dataIndex]
                    + 0.587 * data[dataIndex + 1]
                    + 0.114 * data[dataIndex + 2]
                );
                grayscale[y * width + x] = gray;
                rowSum += gray;
                integral[(y + 1) * stride + x + 1] = (
                    integral[y * stride + x + 1] + rowSum
                );
            }
        }

        const radius = Math.max(10, Math.round(Math.min(width, height) * 0.10));
        for (let y = 0; y < height; y += 1) {
            const top = Math.max(0, y - radius);
            const bottom = Math.min(height, y + radius + 1);
            for (let x = 0; x < width; x += 1) {
                const left = Math.max(0, x - radius);
                const right = Math.min(width, x + radius + 1);
                const area = (right - left) * (bottom - top);
                const localSum = (
                    integral[bottom * stride + right]
                    - integral[top * stride + right]
                    - integral[bottom * stride + left]
                    + integral[top * stride + left]
                );
                const localMean = localSum / area;
                const value = grayscale[y * width + x] < localMean * 0.84 ? 0 : 255;
                const dataIndex = (y * width + x) * 4;
                data[dataIndex] = data[dataIndex + 1] = data[dataIndex + 2] = value;
            }
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

    async function requestServerOcr(cropCaptures) {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), GEMINI_TIMEOUT_MS);
        const serverCandidates = cropCaptures.slice(0, 3);

        try {
            const response = await fetch('/api/gemini-ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    images: serverCandidates.map(
                        capture => capture.canvas.toDataURL('image/jpeg', 0.86)
                    )
                }),
                signal: abortController.signal
            });
            const data = await response.json().catch(() => ({}));

            if (response.ok && data.success && data.plate) {
                const plate = parseTurkishPlate(data.plate);
                if (!plate) return null;

                const candidateIndex = Number.isInteger(data.candidate_index)
                    ? Math.max(0, Math.min(serverCandidates.length - 1, data.candidate_index))
                    : 0;
                return { plate, candidateIndex };
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

    async function requestLocalOcr(cropCaptures, sessionId) {
        triggerOcrBtn.textContent = '⏳ Yerel OCR hazırlanıyor...';
        const worker = await ensureOcrWorker();
        const registeredPlates = getRegisteredPlateOptions()
            .map(option => option.dataset.plate || option.value);
        const candidates = [];
        const votes = new Map();
        const stages = [
            { name: 'AutoContrast', apply: (c, w, h) => processAutoContrast(c, w, h) },
            { name: 'Adaptive', apply: (c, w, h) => processAdaptiveThreshold(c, w, h) },
            { name: 'Otsu', apply: (c, w, h) => processOtsuThreshold(c, w, h) },
            { name: 'Original', apply: () => {} },
        ];

        for (let cropIndex = 0; cropIndex < cropCaptures.length; cropIndex += 1) {
            for (const stage of stages) {
                if (sessionId !== ocrSessionId) {
                    return null;
                }

                const capture = cropCaptures[cropIndex];
                const { ctx, canvas, originalImageData } = capture;
                triggerOcrBtn.textContent =
                    `⏳ Yerel OCR: ${stage.name} ${cropIndex + 1}/${cropCaptures.length}`;
                ctx.putImageData(originalImageData, 0, 0);
                stage.apply(ctx, canvas.width, canvas.height);

                const result = await recognizeWithTimeout(worker, canvas, TESSERACT_STAGE_TIMEOUT_MS);
                if (sessionId !== ocrSessionId) {
                    return null;
                }

                const recognizedText = result.data.text || '';
                const confidence = Number(result.data.confidence) || 0;
                const normalizedRecognizedText = String(recognizedText).toUpperCase();
                const recognizedCompact = /[ÇĞİÖŞÜ]/.test(normalizedRecognizedText)
                    ? ''
                    : normalizedRecognizedText.replace(/[^A-Z0-9]/g, '');
                const eligibleRegisteredPlates = registeredPlates.filter(plate => (
                    parseTurkishPlate(
                        String(plate),
                        { allowOcrCorrections: false }
                    )?.normalized.length === recognizedCompact.length
                ));
                const registeredMatch = (
                    recognizedCompact.length === 7
                    || recognizedCompact.length === 8
                )
                    ? matchRegisteredPlate(
                        recognizedText,
                        eligibleRegisteredPlates
                    )
                    : null;
                const parsed = registeredMatch
                    ? parseTurkishPlate(registeredMatch.normalized)
                    : parseTurkishPlate(recognizedText);

                if (
                    parsed
                    && (
                        confidence >= OCR_CONSENSUS_MIN_CONFIDENCE
                        || registeredMatch
                    )
                ) {
                    const corrected = Boolean(
                        registeredMatch?.corrected || parsed.ocrCorrected
                    );
                    const candidate = {
                        text: parsed.normalized,
                        confidence,
                        corrected,
                        registered: Boolean(registeredMatch),
                        parts: [
                            parsed.provinceCode.toString().padStart(2, '0'),
                            parsed.letters,
                            parsed.digits
                        ],
                        canvasContext: ctx.getImageData(0, 0, canvas.width, canvas.height),
                        originalCanvasContext: originalImageData,
                        canvasW: canvas.width,
                        canvasH: canvas.height,
                        cropIndex,
                        stage: stage.name,
                    };
                    candidates.push(candidate);

                    const vote = votes.get(candidate.text) || {
                        count: 0,
                        totalConfidence: 0,
                        corrected: false,
                        registered: false,
                        best: candidate,
                        variants: new Set(),
                    };
                    const variantKey = `${cropIndex}:${stage.name}`;
                    if (!vote.variants.has(variantKey)) {
                        vote.variants.add(variantKey);
                        vote.count += 1;
                        vote.totalConfidence += confidence;
                    }
                    vote.corrected = vote.corrected || corrected;
                    vote.registered = vote.registered || candidate.registered;
                    if (candidate.confidence > vote.best.confidence) {
                        vote.best = candidate;
                    }
                    votes.set(candidate.text, vote);

                    // Çok güçlü tek sonuçta veya iki bağımsız görüntü varyantı aynı
                    // plakada birleştiğinde erken dön; ilk düşük güvenli sözdizimsel
                    // eşleşmeyi artık doğrudan kabul etmiyoruz.
                    if (
                        confidence >= OCR_STRONG_CONFIDENCE
                        && !corrected
                    ) {
                        return candidate;
                    }
                    if (shouldAcceptOcrConsensus(vote)) {
                        return {
                            ...vote.best,
                            consensus: vote.count,
                        };
                    }
                }
            }
        }

        candidates.sort((left, right) => {
            const leftVotes = votes.get(left.text)?.count || 0;
            const rightVotes = votes.get(right.text)?.count || 0;
            const leftRegistered = findRegisteredPlateOption(left.text) ? 1 : 0;
            const rightRegistered = findRegisteredPlateOption(right.text) ? 1 : 0;
            return (
                rightVotes - leftVotes
                || rightRegistered - leftRegistered
                || Number(left.corrected) - Number(right.corrected)
                || right.confidence - left.confidence
            );
        });
        const best = candidates[0] || null;
        if (!best) {
            return null;
        }

        const bestVote = votes.get(best.text);
        if (
            best.registered
            || best.confidence >= OCR_MIN_CONFIDENCE
            || shouldAcceptOcrConsensus(bestVote)
        ) {
            return { ...best, consensus: bestVote?.count || 1 };
        }
        return null;
    }

    function showOcrResult(bestMatch, source) {
        currentOcrPlate = bestMatch.text;
        currentOcrSource = source;

        if (ocrDebugCanvas) {
            ocrDebugCanvas.width = bestMatch.canvasW;
            ocrDebugCanvas.height = bestMatch.canvasH;
            ocrDebugCanvas.getContext('2d').putImageData(bestMatch.canvasContext, 0, 0);
        }
        if (ocrOriginalCanvas && bestMatch.originalCanvasContext) {
            ocrOriginalCanvas.width = bestMatch.canvasW;
            ocrOriginalCanvas.height = bestMatch.canvasH;
            ocrOriginalCanvas.getContext('2d').putImageData(bestMatch.originalCanvasContext, 0, 0);
        }

        ocrResultText.textContent = bestMatch.parts.join(' ');

        if (source === 'gemini') {
            ocrConfidence.textContent = 'Sunucu OCR sonucu';
            ocrConfidence.style.color = '#4ade80';
        } else {
            const correctionNote = bestMatch.corrected ? ' • OCR karakterleri düzeltildi' : '';
            const consensusNote = bestMatch.consensus > 1
                ? ` • ${bestMatch.consensus} sonuç eşleşti`
                : '';
            ocrConfidence.textContent = (
                `%${Math.round(bestMatch.confidence)} • Yerel OCR`
                + correctionNote
                + consensusNote
            );
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
            ocrDbStatus.textContent = '⚠️ Okundu • Araç Kayıtlı Değil';
            ocrDbStatus.style.color = '#facc15';
            ocrConfirmBtn.disabled = false;
            ocrConfirmBtn.style.opacity = '1';
        }

        ocrManualEditContainer.classList.add('hidden');
        ocrConfirmModal.classList.remove('hidden');
    }

    function isVideoReady(video) {
        return Boolean(
            video
            && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
            && video.videoWidth > 0
            && video.videoHeight > 0
        );
    }

    function setAutoScanStatus(message, tone = 'info') {
        if (!autoScanStatus) return;
        const colors = {
            info: '#93c5fd',
            searching: '#cbd5e1',
            found: '#facc15',
            success: '#4ade80',
            error: '#fca5a5',
        };
        autoScanStatus.textContent = message;
        autoScanStatus.style.color = colors[tone] || colors.info;
    }

    async function performPlateOcr({
        preferredDetection = null,
        automatic = false,
    } = {}) {
        const video = window.cameraController?.videoElement;
        if (isOcrProcessing) {
            return false;
        }
        if (!isPlateListReady) {
            if (!automatic) {
                window.showToast('Kayıtlı plakalar henüz yükleniyor.', 'warning');
            }
            return false;
        }
        if (!isVideoReady(video)) {
            if (!automatic) {
                window.showToast('Kamera görüntüsü henüz hazır değil.', 'error');
            }
            return false;
        }

        isOcrProcessing = true;
        triggerOcrBtn.textContent = '⏳ Plaka okunuyor...';
        triggerOcrBtn.disabled = true;
        setAutoScanStatus('Plaka kırpıldı; metin okunuyor…', 'found');
        const sessionId = ocrSessionId;
        let succeeded = false;

        try {
            const frozenFrame = captureFullVideoFrame(video);
            const { detection, sourceCrops } = buildOcrCropRegions(
                video,
                preferredDetection,
                { automatic, source: frozenFrame }
            );
            const cropCaptures = sourceCrops.map(
                crop => captureVideoCrop(frozenFrame, crop)
            );
            const primaryCapture = cropCaptures[0];
            if (!primaryCapture) {
                throw new Error('OCR için uygun plaka kırpımı oluşturulamadı.');
            }

            if (detection.candidates[0]) {
                showDetectionOverlay(
                    video,
                    detection,
                    detection.candidates[0],
                    true
                );
            }

            if (ocrOriginalCanvas) {
                ocrOriginalCanvas.width = primaryCapture.canvas.width;
                ocrOriginalCanvas.height = primaryCapture.canvas.height;
                ocrOriginalCanvas
                    .getContext('2d')
                    .putImageData(primaryCapture.originalImageData, 0, 0);
            }

            const serverResult = await requestServerOcr(cropCaptures);
            if (sessionId !== ocrSessionId) return false;

            let bestMatch = null;
            let source = null;
            if (serverResult) {
                const parsed = serverResult.plate;
                const selectedCapture = (
                    cropCaptures[serverResult.candidateIndex] || primaryCapture
                );
                bestMatch = {
                    text: parsed.normalized,
                    confidence: null,
                    corrected: Boolean(parsed.ocrCorrected),
                    parts: [
                        parsed.provinceCode.toString().padStart(2, '0'),
                        parsed.letters,
                        parsed.digits
                    ],
                    canvasContext: selectedCapture.originalImageData,
                    originalCanvasContext: selectedCapture.originalImageData,
                    canvasW: selectedCapture.canvas.width,
                    canvasH: selectedCapture.canvas.height
                };
                source = 'gemini';
            } else {
                bestMatch = await requestLocalOcr(cropCaptures.slice(0, 4), sessionId);
                source = bestMatch ? 'tesseract' : null;
            }

            if (sessionId !== ocrSessionId) return false;
            if (bestMatch) {
                hideDetectionOverlay();
                setAutoScanStatus('Plaka otomatik okundu; sonucu onaylayın.', 'success');
                showOcrResult(bestMatch, source);
                succeeded = true;
            } else {
                setAutoScanStatus(
                    'Plaka bulundu ancak metin net değildi; kamerayı sabit tutun.',
                    'error'
                );
                if (!automatic) {
                    window.showToast(
                        'Plaka net okunamadı. Kamerayı sabit tutup tekrar deneyin.',
                        'error'
                    );
                }
            }
        } catch (error) {
            if (error instanceof OcrTimeoutError || error.name === 'OcrTimeoutError') {
                await resetOcrWorker();
                setAutoScanStatus('Yerel OCR zaman aşımına uğradı; tekrar denenebilir.', 'error');
                if (!automatic) {
                    window.showToast('Yerel OCR zaman aşımına uğradı; tekrar deneyin.', 'error');
                }
            } else if (sessionId === ocrSessionId) {
                console.error('OCR hatası:', error);
                setAutoScanStatus(
                    'Okuma tamamlanamadı; bağlantıyı ve kamera netliğini kontrol edin.',
                    'error'
                );
                if (!automatic) {
                    window.showToast(
                        'Plaka okunamadı. İnternet bağlantısını ve kamera netliğini kontrol edin.',
                        'error'
                    );
                }
            }
        } finally {
            isOcrProcessing = false;
            if (triggerOcrBtn && dashboardSection.classList.contains('active')) {
                triggerOcrBtn.textContent = '🔍 Şimdi Tara';
                triggerOcrBtn.disabled = false;
            }
        }

        return succeeded;
    }

    function scheduleAutoScan(delay = AUTO_SCAN_INTERVAL_MS) {
        clearTimeout(autoScanTimer);
        autoScanTimer = setTimeout(runAutoScanFrame, delay);
    }

    function pruneAutoScanBlockedCandidates(now = Date.now()) {
        autoScanBlockedCandidate = autoScanBlockedCandidate.filter(
            entry => entry.until > now
        );
        autoScanCooldownUntil = autoScanBlockedCandidate.reduce(
            (maximum, entry) => Math.max(maximum, entry.until),
            0
        );
    }

    function isAutoScanCandidateBlocked(candidate, now = Date.now()) {
        pruneAutoScanBlockedCandidates(now);
        return autoScanBlockedCandidate.some(entry => (
            plateCandidatesReferToSameRegion(entry.candidate, candidate)
        ));
    }

    function blockAutoScanCandidate(candidate) {
        if (!candidate) {
            return;
        }

        const until = Date.now() + AUTO_SCAN_RETRY_COOLDOWN_MS;
        pruneAutoScanBlockedCandidates();
        const existing = autoScanBlockedCandidate.find(entry => (
            plateCandidatesReferToSameRegion(entry.candidate, candidate)
        ));
        if (existing) {
            existing.candidate = candidate;
            existing.until = until;
        } else {
            autoScanBlockedCandidate.push({ candidate, until });
        }
        autoScanCooldownUntil = autoScanBlockedCandidate.reduce(
            (maximum, entry) => Math.max(maximum, entry.until),
            0
        );
    }

    function stopAutoScan() {
        clearTimeout(autoScanTimer);
        autoScanTimer = null;
        autoScanPreviousCandidate = null;
        autoScanStableFrames = 0;
        autoScanBlockedCandidate = [];
        autoScanCooldownUntil = 0;
        autoScanMissingFrames = 0;
        hideDetectionOverlay();
    }

    function startAutoScan() {
        stopAutoScan();
        autoScanCooldownUntil = 0;
        setAutoScanStatus('Otomatik tarama açık • plakayı kameraya gösterin.', 'searching');
        scheduleAutoScan(180);
    }

    async function runAutoScanFrame() {
        autoScanTimer = null;
        const video = window.cameraController?.videoElement;
        const modalVisible = ocrConfirmModal
            && !ocrConfirmModal.classList.contains('hidden');
        const shouldContinue = (
            dashboardSection.classList.contains('active')
            && state.currentStep === 1
            && !document.hidden
            && !modalVisible
        );
        if (!shouldContinue) {
            return;
        }

        if (!isVideoReady(video) || isOcrProcessing || !isPlateListReady) {
            scheduleAutoScan();
            return;
        }

        try {
            const detection = captureDetectionFrame(video);
            const now = Date.now();
            pruneAutoScanBlockedCandidates(now);

            const credibleCandidates = detection.candidates.filter(candidate => (
                Number(candidate.ocrScore ?? candidate.score) >= AUTO_SCAN_MIN_SCORE
            ));
            if (!credibleCandidates.length) {
                autoScanMissingFrames += 1;
                if (autoScanMissingFrames >= 2) {
                    autoScanPreviousCandidate = null;
                    autoScanStableFrames = 0;
                } else {
                    autoScanStableFrames = Math.max(0, autoScanStableFrames - 1);
                }
                hideDetectionOverlay();
                setAutoScanStatus('Plaka aranıyor…', 'searching');
                scheduleAutoScan();
                return;
            }
            autoScanMissingFrames = 0;

            const availableCandidates = credibleCandidates.filter(
                candidate => !isAutoScanCandidateBlocked(candidate, now)
            );
            if (!availableCandidates.length) {
                const blockedCandidate = selectTrackedPlateCandidate(
                    credibleCandidates,
                    autoScanBlockedCandidate[0]?.candidate || null
                );
                showDetectionOverlay(video, detection, blockedCandidate, false);
                setAutoScanStatus(
                    'Netliği düzeltin veya “Şimdi Tara” düğmesine dokunun.',
                    'found'
                );
                scheduleAutoScan();
                return;
            }

            const candidate = selectTrackedPlateCandidate(
                availableCandidates,
                autoScanPreviousCandidate
            );
            const stableWithPrevious = (
                autoScanPreviousCandidate
                && plateCandidatesReferToSameRegion(
                    autoScanPreviousCandidate,
                    candidate
                )
            );
            autoScanStableFrames = stableWithPrevious
                ? autoScanStableFrames + 1
                : 1;
            autoScanPreviousCandidate = candidate;

            const stable = autoScanStableFrames >= AUTO_SCAN_STABLE_FRAMES;
            showDetectionOverlay(video, detection, candidate, stable);
            setAutoScanStatus(
                stable
                    ? 'Plaka bulundu; otomatik okunuyor…'
                    : 'Plaka bulundu; kısa süre sabit tutun.',
                stable ? 'success' : 'found'
            );

            if (stable) {
                const succeeded = await performPlateOcr({
                    preferredDetection: {
                        ...detection,
                        preferredCandidate: candidate,
                    },
                    automatic: true,
                });
                if (succeeded) {
                    return;
                }
                // Bekleme süresini uzun OCR işlemi bittikten sonra başlat.
                // Aynı aday kısa süre bekletilir; başka bir bölgedeki adaylar
                // ve manuel tarama bu bekleme süresinden etkilenmez.
                blockAutoScanCandidate(candidate);
                autoScanPreviousCandidate = null;
                autoScanStableFrames = 0;
            }
        } catch (error) {
            console.warn('Otomatik plaka tespiti başarısız oldu:', error);
            hideDetectionOverlay();
            setAutoScanStatus('Otomatik tespit yeniden deneniyor…', 'error');
        }

        scheduleAutoScan();
    }

    if (triggerOcrBtn) {
        triggerOcrBtn.addEventListener('click', async () => {
            const succeeded = await performPlateOcr();
            if (!succeeded) {
                blockAutoScanCandidate(autoScanPreviousCandidate);
                autoScanPreviousCandidate = null;
                autoScanStableFrames = 0;
            }
        });
    }

    // Modal Event Listeners
    if (ocrConfirmBtn) {
        ocrConfirmBtn.addEventListener('click', () => {
            const rawValue = ocrManualEditContainer.classList.contains('hidden') ? currentOcrPlate : ocrManualInput.value;
            const resolvedPlate = resolveOcrPlate(rawValue);

            if (!resolvedPlate) {
                window.showToast('Geçerli bir Türk plakası girin.', 'error');
                return;
            }

            const option = ensureOcrPlateOption(resolvedPlate);
            option.selected = true;
            plateSelect.value = option.value;
            plateSelect.dispatchEvent(new Event('change', { bubbles: true }));
            closeCameraSafely();

            const registrationNote = resolvedPlate.registered ? '' : ' (kayıt dışı araç)';
            window.showToast(
                `Plaka forma aktarıldı: ${resolvedPlate.normalized}${registrationNote}`,
                'success'
            );
        });
    }

    if (ocrRetryBtn) {
        ocrRetryBtn.addEventListener('click', () => {
            ocrConfirmModal.classList.add('hidden');
            invalidateOcrSession();
            autoScanCooldownUntil = 0;
            startAutoScan();
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
        const resolvedPlate = resolveOcrPlate(ocrManualInput.value);
        const isValidPlate = Boolean(resolvedPlate);
        ocrConfirmBtn.disabled = !isValidPlate;
        ocrConfirmBtn.style.opacity = isValidPlate ? '1' : '0.5';

        if (!resolvedPlate) {
            ocrDbStatus.textContent = '❌ Geçersiz Plaka';
            ocrDbStatus.style.color = '#ef4444';
        } else if (resolvedPlate.registered) {
            ocrDbStatus.textContent = '✅ Sistemde Bulundu';
            ocrDbStatus.style.color = '#4ade80';
        } else {
            ocrDbStatus.textContent = '⚠️ Geçerli • Araç Kayıtlı Değil';
            ocrDbStatus.style.color = '#facc15';
        }
    }

    function clearCanvas(canvas) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Global Camera Cleanup Logic
    function closeCameraSafely() {
        stopAutoScan();
        invalidateOcrSession();
        if (window.cameraController) {
            window.cameraController.stopCamera();
        }
        if (ocrConfirmModal) {
            ocrConfirmModal.classList.add('hidden');
        }
        isOcrProcessing = false;
        if (triggerOcrBtn) {
            triggerOcrBtn.innerHTML = '🔍 Şimdi Tara';
            triggerOcrBtn.disabled = false;
        }
        setAutoScanStatus('Otomatik tarama durduruldu.', 'info');
        
        currentOcrPlate = null;
        currentOcrSource = null;
        if (ocrManualInput) ocrManualInput.value = "";
        clearCanvas(ocrOriginalCanvas);
        clearCanvas(ocrDebugCanvas);
    }

    // Bind cleanup to navigation and page close events
    window.addEventListener("pagehide", closeCameraSafely);
    window.addEventListener("beforeunload", closeCameraSafely);
    window.addEventListener("camera-ready", () => {
        if (dashboardSection.classList.contains('active') && state.currentStep === 1) {
            startAutoScan();
        }
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            closeCameraSafely();
        } else if (dashboardSection.classList.contains('active') && state.currentStep === 1) {
            triggerOcrBtn.disabled = true;
            triggerOcrBtn.textContent = '⏳ Kamera hazırlanıyor...';
            window.cameraController?.startCamera().then(started => {
                if (dashboardSection.classList.contains('active')) {
                    triggerOcrBtn.textContent = '🔍 Şimdi Tara';
                    triggerOcrBtn.disabled = false;
                    if (started !== false) {
                        startAutoScan();
                    }
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
            manualSubtitle.textContent = 'Plakayı okutun veya kayıtlı listeden seçin.';
            
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

    // Android WebView geri tuşu için SPA içi güvenli gezinme kancası.
    window.handleNativeBack = function() {
        if (ocrConfirmModal && !ocrConfirmModal.classList.contains('hidden')) {
            closeCameraSafely();
            return true;
        }

        if (reportDetailSection.classList.contains('active')) {
            backToReportsMenuBtn.click();
            return true;
        }

        if (vehicleReportSelectionSection.classList.contains('active')) {
            backFromVehicleSelectBtn.click();
            return true;
        }

        if (reportsMenuSection.classList.contains('active')) {
            showActionSelection();
            return true;
        }

        if (dashboardSection.classList.contains('active')) {
            showActionSelection();
            return true;
        }

        return false;
    };

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
