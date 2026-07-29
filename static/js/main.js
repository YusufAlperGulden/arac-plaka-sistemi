/**
 * main.js
 * SPA mantığıyla ekranlar arası geçişleri, Raporlama modüllerini
 * ve backend (API) iletişimini yönetir.
 */

document.addEventListener('DOMContentLoaded', () => {
    const {
        parseTurkishPlate,
        hasSafeProvinceEvidenceForStrictAutoAcceptance,
        inferTurkishPlateEstimate,
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
    const activeVehiclesSection = document.getElementById('active-vehicles-section');
    const fleetManagementSection = document.getElementById('fleet-management-section');
    const movementTypeManagementSection = document.getElementById(
        'movement-type-management-section'
    );
    
    // ---- İŞLEM SEÇİM EKRANI BUTONLARI ----
    const pickupBtn = document.getElementById('action-pickup');
    const dropoffBtn = document.getElementById('action-dropoff');
    const activeVehiclesBtn = document.getElementById('active-vehicles-btn');
    const reportMenuBtn = document.getElementById('action-report-btn');
    const actionLogoutBtn = document.getElementById('action-logout-btn');
    
    // ---- RAPORLAR MENÜSÜ BUTONLARI ----
    const reportRecentBtn = document.getElementById('report-recent-btn');
    const reportVehicleBtn = document.getElementById('report-vehicle-btn');
    const fleetManagementBtn = document.getElementById('fleet-management-btn');
    const movementTypeManagementBtn = document.getElementById(
        'movement-type-management-btn'
    );
    const backFromReportsMenuBtn = document.getElementById('back-from-reports-menu-btn');
    const databaseStatusText = document.getElementById('database-status-text');

    // ---- AKTİF ARAÇLAR PANOSU ----
    const backFromActiveVehiclesBtn = document.getElementById(
        'back-from-active-vehicles-btn'
    );
    const activeTripSearch = document.getElementById('active-trip-search');
    const refreshActiveTripsBtn = document.getElementById(
        'refresh-active-trips-btn'
    );
    const activeTripList = document.getElementById('active-trip-list');
    const activeTotalCount = document.getElementById('active-total-count');
    const activeTripCount = document.getElementById('active-trip-count');
    const availableVehicleCount = document.getElementById(
        'available-vehicle-count'
    );

    // ---- ARAÇ TANIMLARI YÖNETİMİ ----
    const backFromFleetManagementBtn = document.getElementById(
        'back-from-fleet-management-btn'
    );
    const fleetTabs = document.querySelectorAll('[data-fleet-tab]');
    const brandForm = document.getElementById('brand-form');
    const brandIdInput = document.getElementById('brand-id');
    const brandNameInput = document.getElementById('brand-name');
    const brandActiveInput = document.getElementById('brand-active');
    const brandCancelBtn = document.getElementById('brand-cancel-btn');
    const brandList = document.getElementById('brand-list');
    const modelForm = document.getElementById('model-form');
    const modelIdInput = document.getElementById('model-id');
    const modelBrandSelect = document.getElementById('model-brand-select');
    const modelNameInput = document.getElementById('model-name');
    const modelActiveInput = document.getElementById('model-active');
    const modelCancelBtn = document.getElementById('model-cancel-btn');
    const modelList = document.getElementById('model-list');
    const vehicleForm = document.getElementById('vehicle-form');
    const vehicleIdInput = document.getElementById('vehicle-id');
    const vehiclePlateInput = document.getElementById('vehicle-plate');
    const vehicleModelSelect = document.getElementById('vehicle-model-select');
    const vehicleYearInput = document.getElementById('vehicle-year');
    const vehicleActiveInput = document.getElementById('vehicle-active');
    const vehicleCancelBtn = document.getElementById('vehicle-cancel-btn');
    const vehicleList = document.getElementById('vehicle-list');

    // ---- HAREKET TÜRLERİ YÖNETİMİ ----
    const backFromMovementTypeManagementBtn = document.getElementById(
        'back-from-movement-type-management-btn'
    );
    const movementTypeForm = document.getElementById('movement-type-form');
    const movementTypeIdInput = document.getElementById('movement-type-id');
    const movementTypeNameInput = document.getElementById('movement-type-name');
    const movementTypeDescriptionInput = document.getElementById(
        'movement-type-description'
    );
    const movementTypeSortOrderInput = document.getElementById(
        'movement-type-sort-order'
    );
    const movementTypeActiveInput = document.getElementById(
        'movement-type-active'
    );
    const movementTypeCancelBtn = document.getElementById(
        'movement-type-cancel-btn'
    );
    const movementTypeList = document.getElementById('movement-type-list');

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
    const selectedVehicleInfo = document.getElementById('selected-vehicle-info');
    const actionTypeSelect = document.getElementById('action-type-select');
    const mileageInput = document.getElementById('mileage-input');
    const requestNoInput = document.getElementById('request-no-input');
    const serviceFormNoInput = document.getElementById('service-form-no-input');
    const notesInput = document.getElementById('notes-input');
    
    const processBtn = document.getElementById('process-btn');
    const processBtnText = document.getElementById('process-btn-text');

    // Uygulama Durumu (State)
    let state = {
        username: null,
        isAdmin: false,
        currentAction: null, // 'pickup' veya 'dropoff'
        currentStep: 1,      // 1: Plaka, 2: Kilometre
        plate: null,
        actionType: null,
        mileage: null,
        requestNo: null,
        serviceFormNo: null,
        notes: null
    };
    let registeredVehiclesByPlate = new Map();
    let activeTripsCache = [];
    let fleetCatalog = {
        brands: [],
        models: [],
        vehicles: [],
    };
    let movementTypesCache = [];

    function formatPlateForDisplay(value) {
        const parsed = parseTurkishPlate(
            String(value || ''),
            { allowOcrCorrections: false }
        );
        if (!parsed) {
            return String(value || '').trim().toUpperCase();
        }
        return [
            parsed.provinceCode.toString().padStart(2, '0'),
            parsed.letters,
            parsed.digits,
        ].join(' ');
    }

    function normalizeVehicleDetails(vehicle) {
        const rawVehicle = typeof vehicle === 'string'
            ? { plate: vehicle }
            : vehicle;
        if (!rawVehicle || typeof rawVehicle !== 'object') return null;

        const parsedPlate = parseTurkishPlate(
            String(rawVehicle.plate || ''),
            { allowOcrCorrections: false }
        );
        if (!parsedPlate) return null;

        const plate = parsedPlate.normalized;
        const vehicleName = String(rawVehicle.vehicle_name || '').trim();
        const displayPlate = String(
            rawVehicle.display_plate || formatPlateForDisplay(plate)
        ).trim();
        const displayLabel = String(
            rawVehicle.display_label
            || (vehicleName ? `${vehicleName} - ${displayPlate}` : displayPlate)
        ).trim();
        return {
            ...rawVehicle,
            plate,
            displayPlate,
            vehicleName,
            displayLabel,
        };
    }

    function getVehicleDetails(plate) {
        const parsed = parseTurkishPlate(
            String(plate || ''),
            { allowOcrCorrections: false }
        );
        return parsed
            ? registeredVehiclesByPlate.get(parsed.normalized) || null
            : null;
    }

    function getVehicleDisplayLabel(plate) {
        return (
            getVehicleDetails(plate)?.displayLabel
            || formatPlateForDisplay(plate)
        );
    }

    function updateSelectedVehicleInfo(plate) {
        if (!selectedVehicleInfo) return;
        const vehicle = getVehicleDetails(plate);
        if (!vehicle?.vehicleName) {
            selectedVehicleInfo.textContent = '';
            selectedVehicleInfo.classList.add('hidden');
            return;
        }

        selectedVehicleInfo.textContent = `Araç: ${vehicle.displayLabel}`;
        selectedVehicleInfo.classList.remove('hidden');
    }

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
    window.switchToDashboard = function(username, isAdmin = false) {
        state.username = username;
        state.isAdmin = Boolean(isAdmin);
        updateAdminVisibility();
        loadMovementTypes();
        showActionSelection();
    };

    // İşlem Seçimi Ekranını Göster
    function showActionSelection() {
        hideAllSections();
        actionSection.classList.remove('hidden');
        actionSection.classList.add('active');
        
        document.getElementById('welcome-message').textContent = `Hoş geldin ${state.username}, lütfen yapmak istediğiniz işlemi seçin.`;
    }

    function updateAdminVisibility() {
        document.querySelectorAll('.admin-only').forEach(element => {
            element.classList.toggle('hidden', !state.isAdmin);
        });
    }

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, options);
        let result = {};
        try {
            result = await response.json();
        } catch (_error) {
            result = {};
        }
        if (!response.ok || result.success === false) {
            const error = new Error(
                result.message || 'İşlem tamamlanamadı.'
            );
            error.status = response.status;
            throw error;
        }
        return result;
    }

    function replaceSelectOptions(select, items, {
        placeholder = null,
        selectedValue = '',
        valueKey = 'id',
        labelKey = 'name',
    } = {}) {
        select.textContent = '';
        if (placeholder) {
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = placeholder;
            placeholderOption.disabled = true;
            select.appendChild(placeholderOption);
        }
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = String(item[valueKey]);
            option.textContent = String(item[labelKey] || '');
            select.appendChild(option);
        });
        const requestedValue = String(selectedValue || '');
        if (
            requestedValue
            && Array.from(select.options).some(
                option => option.value === requestedValue
            )
        ) {
            select.value = requestedValue;
        } else if (placeholder) {
            select.value = '';
        }
    }

    function showListMessage(container, message) {
        container.textContent = '';
        const paragraph = document.createElement('p');
        paragraph.className = 'empty-state';
        paragraph.textContent = message;
        container.appendChild(paragraph);
    }

    function createStatusBadge(active, label = null) {
        const badge = document.createElement('span');
        badge.className = `status-badge${active ? '' : ' inactive'}`;
        badge.textContent = label || (active ? 'Aktif' : 'Pasif');
        return badge;
    }

    function createActionButton(label, className, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', handler);
        return button;
    }

    async function loadMovementTypes() {
        try {
            const result = await apiRequest(
                '/api/movement-types?include_inactive=1'
            );
            movementTypesCache = Array.from(result.movement_types || []);
            const activeTypes = movementTypesCache.filter(item => item.active);
            const previousAction = actionTypeSelect.value;
            replaceSelectOptions(actionTypeSelect, activeTypes, {
                selectedValue: activeTypes.some(
                    item => item.name === previousAction
                )
                    ? previousAction
                    : (
                        activeTypes.some(item => item.name === 'Diğer')
                            ? 'Diğer'
                            : activeTypes[0]?.name || ''
                    ),
                valueKey: 'name',
                labelKey: 'name',
            });

            const previousFilter = filterActionType.value;
            const reportTypeNames = Array.from(new Set([
                ...movementTypesCache.map(item => item.name),
                ...currentRecords.map(record => record.action_type).filter(Boolean),
            ])).sort((a, b) => a.localeCompare(b, 'tr'));
            const filterItems = [
                { value: 'all', label: 'Tüm Kullanım Amaçları' },
                ...reportTypeNames.map(name => ({ value: name, label: name })),
            ];
            replaceSelectOptions(filterActionType, filterItems, {
                selectedValue: filterItems.some(
                    item => item.value === previousFilter
                )
                    ? previousFilter
                    : 'all',
                valueKey: 'value',
                labelKey: 'label',
            });
        } catch (error) {
            console.warn('Hareket türleri yüklenemedi:', error);
        }
    }

    async function loadDatabaseStatus() {
        if (!state.isAdmin || !databaseStatusText) return;
        try {
            const result = await apiRequest('/api/system/status');
            databaseStatusText.classList.toggle(
                'warning',
                !result.persistent_database
            );
            databaseStatusText.textContent = result.persistent_database
                ? 'Kalıcı PostgreSQL bağlantısı aktif.'
                : 'Yerel SQLite kullanılıyor • Render için DATABASE_URL bağlantısı gerekli.';
        } catch (error) {
            databaseStatusText.classList.add('warning');
            databaseStatusText.textContent =
                'Veritabanı bağlantı durumu alınamadı.';
        }
    }

    function formatElapsedTime(startAt) {
        const startTime = new Date(startAt).getTime();
        if (!Number.isFinite(startTime)) return '-';
        const totalMinutes = Math.max(
            0,
            Math.floor((Date.now() - startTime) / 60000)
        );
        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const minutes = totalMinutes % 60;
        if (days > 0) return `${days} gün ${hours} sa`;
        if (hours > 0) return `${hours} sa ${minutes} dk`;
        return `${minutes} dk`;
    }

    function renderActiveTrips() {
        const searchValue = activeTripSearch.value.trim().toLocaleLowerCase('tr');
        const filteredTrips = activeTripsCache.filter(item => {
            const searchable = [
                item.plate,
                item.display_label,
                item.driver,
                item.action_type,
                item.request_no,
                item.service_form_no,
            ].join(' ').toLocaleLowerCase('tr');
            return searchable.includes(searchValue);
        });

        activeTripList.textContent = '';
        if (filteredTrips.length === 0) {
            showListMessage(
                activeTripList,
                searchValue
                    ? 'Aramanızla eşleşen devam eden kullanım bulunamadı.'
                    : 'Şu anda devam eden bir araç kullanımı bulunmuyor.'
            );
            return;
        }

        filteredTrips.forEach(item => {
            const card = document.createElement('article');
            card.className = 'management-item';

            const header = document.createElement('div');
            header.className = 'management-item-header';
            const titleContainer = document.createElement('div');
            const title = document.createElement('h3');
            const driver = document.createElement('p');
            title.textContent = item.display_label;
            driver.textContent = `Sürücü: ${item.driver}`;
            titleContainer.append(title, driver);
            const purposeBadge = createStatusBadge(true, item.action_type);
            purposeBadge.classList.add('purpose');
            header.append(titleContainer, purposeBadge);

            const details = document.createElement('div');
            details.className = 'management-item-details';
            const detailValues = [
                ['Başlangıç', item.start_date],
                ['Başlangıç KM', item.start_mileage],
                ['Geçen Süre', formatElapsedTime(item.start_at)],
            ];
            if (item.request_no) {
                detailValues.push(['Talep No', item.request_no]);
            }
            if (item.service_form_no) {
                detailValues.push(['Servis Formu', item.service_form_no]);
            }
            detailValues.forEach(([label, value]) => {
                const detail = document.createElement('span');
                const strong = document.createElement('strong');
                strong.textContent = `${label}: `;
                detail.append(strong, document.createTextNode(value || '-'));
                details.appendChild(detail);
            });

            const actions = document.createElement('div');
            actions.className = 'item-actions';
            actions.appendChild(createActionButton(
                'Teslim Et',
                'btn-primary',
                () => startProcess(
                    'Teslim Etme',
                    'dropoff',
                    item.plate,
                    item.action_type
                )
            ));
            card.append(header, details, actions);
            activeTripList.appendChild(card);
        });
    }

    async function loadActiveTrips() {
        showListMessage(activeTripList, 'Yükleniyor...');
        refreshActiveTripsBtn.disabled = true;
        try {
            const result = await apiRequest('/api/active-trips');
            activeTripsCache = Array.from(result.items || []);
            activeTotalCount.textContent = String(result.counts?.total || 0);
            activeTripCount.textContent = String(result.counts?.active || 0);
            availableVehicleCount.textContent = String(
                result.counts?.available || 0
            );
            renderActiveTrips();
        } catch (error) {
            showListMessage(
                activeTripList,
                error.message || 'Devam eden kullanımlar alınamadı.'
            );
        } finally {
            refreshActiveTripsBtn.disabled = false;
        }
    }

    function showActiveVehicles() {
        hideAllSections();
        activeVehiclesSection.classList.remove('hidden');
        activeVehiclesSection.classList.add('active');
        activeTripSearch.value = '';
        loadActiveTrips();
    }

    function showFleetTab(tabName) {
        fleetTabs.forEach(tab => {
            tab.classList.toggle(
                'active',
                tab.dataset.fleetTab === tabName
            );
        });
        ['brands', 'models', 'vehicles'].forEach(name => {
            const panel = document.getElementById(`fleet-${name}-panel`);
            const isActive = name === tabName;
            panel.classList.toggle('hidden', !isActive);
            panel.classList.toggle('active', isActive);
        });
    }

    function resetBrandForm() {
        brandIdInput.value = '';
        brandNameInput.value = '';
        brandActiveInput.checked = true;
        brandCancelBtn.classList.add('hidden');
    }

    function resetModelForm() {
        modelIdInput.value = '';
        modelNameInput.value = '';
        modelActiveInput.checked = true;
        modelCancelBtn.classList.add('hidden');
        if (modelBrandSelect.options.length > 0) {
            modelBrandSelect.selectedIndex = 0;
        }
    }

    function resetVehicleForm() {
        vehicleIdInput.value = '';
        vehiclePlateInput.value = '';
        vehicleYearInput.value = '';
        vehicleActiveInput.checked = true;
        vehicleCancelBtn.classList.add('hidden');
        if (vehicleModelSelect.options.length > 0) {
            vehicleModelSelect.selectedIndex = 0;
        }
    }

    function populateFleetSelects() {
        const brandItems = fleetCatalog.brands.map(brand => ({
            ...brand,
            display_name: brand.active
                ? brand.name
                : `${brand.name} (Pasif)`,
        }));
        replaceSelectOptions(modelBrandSelect, brandItems, {
            placeholder: 'Marka Seçin...',
            selectedValue: modelBrandSelect.value,
            labelKey: 'display_name',
        });

        const modelItems = fleetCatalog.models.map(model => ({
            ...model,
            display_name: model.active
                ? model.display_label
                : `${model.display_label} (Pasif)`,
        }));
        replaceSelectOptions(vehicleModelSelect, modelItems, {
            placeholder: 'Model Seçin...',
            selectedValue: vehicleModelSelect.value,
            labelKey: 'display_name',
        });
    }

    function renderBrandList() {
        brandList.textContent = '';
        if (fleetCatalog.brands.length === 0) {
            showListMessage(brandList, 'Henüz marka tanımlanmamış.');
            return;
        }
        fleetCatalog.brands.forEach(brand => {
            const card = document.createElement('article');
            card.className = 'management-item';
            const header = document.createElement('div');
            header.className = 'management-item-header';
            const text = document.createElement('div');
            const title = document.createElement('h3');
            const subtitle = document.createElement('p');
            const modelCount = fleetCatalog.models.filter(
                model => model.brand_id === brand.id
            ).length;
            title.textContent = brand.name;
            subtitle.textContent = `${modelCount} model tanımlı`;
            text.append(title, subtitle);
            header.append(text, createStatusBadge(brand.active));

            const actions = document.createElement('div');
            actions.className = 'item-actions';
            actions.append(
                createActionButton('Düzenle', 'btn-secondary', () => {
                    brandIdInput.value = String(brand.id);
                    brandNameInput.value = brand.name;
                    brandActiveInput.checked = brand.active;
                    brandCancelBtn.classList.remove('hidden');
                    brandNameInput.focus();
                }),
                createActionButton(
                    brand.active ? 'Pasifleştir' : 'Aktifleştir',
                    'btn-outline',
                    () => toggleCatalogEntity(
                        `/api/brands/${brand.id}`,
                        { active: !brand.active }
                    )
                )
            );
            card.append(header, actions);
            brandList.appendChild(card);
        });
    }

    function renderModelList() {
        modelList.textContent = '';
        if (fleetCatalog.models.length === 0) {
            showListMessage(modelList, 'Henüz model tanımlanmamış.');
            return;
        }
        fleetCatalog.models.forEach(model => {
            const card = document.createElement('article');
            card.className = 'management-item';
            const header = document.createElement('div');
            header.className = 'management-item-header';
            const text = document.createElement('div');
            const title = document.createElement('h3');
            const subtitle = document.createElement('p');
            const vehicleCount = fleetCatalog.vehicles.filter(
                vehicle => vehicle.model_id === model.id
            ).length;
            title.textContent = model.display_label;
            subtitle.textContent = `${vehicleCount} araç tanımlı`;
            text.append(title, subtitle);
            header.append(text, createStatusBadge(model.active));

            const actions = document.createElement('div');
            actions.className = 'item-actions';
            actions.append(
                createActionButton('Düzenle', 'btn-secondary', () => {
                    modelIdInput.value = String(model.id);
                    modelBrandSelect.value = String(model.brand_id);
                    modelNameInput.value = model.name;
                    modelActiveInput.checked = model.active;
                    modelCancelBtn.classList.remove('hidden');
                    modelNameInput.focus();
                }),
                createActionButton(
                    model.active ? 'Pasifleştir' : 'Aktifleştir',
                    'btn-outline',
                    () => toggleCatalogEntity(
                        `/api/models/${model.id}`,
                        { active: !model.active }
                    )
                )
            );
            card.append(header, actions);
            modelList.appendChild(card);
        });
    }

    function renderVehicleList() {
        vehicleList.textContent = '';
        if (fleetCatalog.vehicles.length === 0) {
            showListMessage(vehicleList, 'Henüz araç tanımlanmamış.');
            return;
        }
        fleetCatalog.vehicles.forEach(vehicle => {
            const card = document.createElement('article');
            card.className = 'management-item';
            const header = document.createElement('div');
            header.className = 'management-item-header';
            const text = document.createElement('div');
            const title = document.createElement('h3');
            const subtitle = document.createElement('p');
            title.textContent = vehicle.display_label;
            subtitle.textContent = `Plaka anahtarı: ${vehicle.plate}`;
            text.append(title, subtitle);
            header.append(text, createStatusBadge(vehicle.active));

            const actions = document.createElement('div');
            actions.className = 'item-actions';
            actions.append(
                createActionButton('Düzenle', 'btn-secondary', () => {
                    vehicleIdInput.value = String(vehicle.id);
                    vehiclePlateInput.value = vehicle.display_plate;
                    vehicleModelSelect.value = String(vehicle.model_id);
                    vehicleYearInput.value = vehicle.year || '';
                    vehicleActiveInput.checked = vehicle.active;
                    vehicleCancelBtn.classList.remove('hidden');
                    vehiclePlateInput.focus();
                }),
                createActionButton(
                    vehicle.active ? 'Pasifleştir' : 'Aktifleştir',
                    'btn-outline',
                    () => toggleCatalogEntity(
                        `/api/vehicles/${vehicle.id}`,
                        { active: !vehicle.active }
                    )
                )
            );
            card.append(header, actions);
            vehicleList.appendChild(card);
        });
    }

    async function loadFleetCatalog() {
        showListMessage(brandList, 'Yükleniyor...');
        showListMessage(modelList, 'Yükleniyor...');
        showListMessage(vehicleList, 'Yükleniyor...');
        try {
            const result = await apiRequest('/api/management/catalog');
            fleetCatalog = {
                brands: Array.from(result.brands || []),
                models: Array.from(result.models || []),
                vehicles: Array.from(result.vehicles || []),
            };
            populateFleetSelects();
            renderBrandList();
            renderModelList();
            renderVehicleList();
            await fetchPlatesAPI();
        } catch (error) {
            [brandList, modelList, vehicleList].forEach(container => {
                showListMessage(container, error.message);
            });
        }
    }

    async function toggleCatalogEntity(url, payload) {
        try {
            const result = await apiRequest(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            window.showToast(result.message, 'success');
            await loadFleetCatalog();
        } catch (error) {
            window.showToast(error.message, 'error');
        }
    }

    async function submitCatalogForm(form, url, payload, resetForm) {
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        try {
            const result = await apiRequest(url, {
                method: payload.id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload.data),
            });
            window.showToast(result.message, 'success');
            resetForm();
            await loadFleetCatalog();
        } catch (error) {
            window.showToast(error.message, 'error');
        } finally {
            submitButton.disabled = false;
        }
    }

    function showFleetManagement() {
        if (!state.isAdmin) {
            window.showToast('Bu işlem için yönetici yetkisi gerekiyor.', 'error');
            return;
        }
        hideAllSections();
        fleetManagementSection.classList.remove('hidden');
        fleetManagementSection.classList.add('active');
        showFleetTab('brands');
        resetBrandForm();
        resetModelForm();
        resetVehicleForm();
        loadFleetCatalog();
    }

    function resetMovementTypeForm() {
        movementTypeIdInput.value = '';
        movementTypeNameInput.value = '';
        movementTypeDescriptionInput.value = '';
        movementTypeSortOrderInput.value = '0';
        movementTypeActiveInput.checked = true;
        movementTypeNameInput.disabled = false;
        movementTypeActiveInput.disabled = false;
        movementTypeCancelBtn.classList.add('hidden');
    }

    function renderMovementTypeList() {
        movementTypeList.textContent = '';
        if (movementTypesCache.length === 0) {
            showListMessage(
                movementTypeList,
                'Henüz hareket türü tanımlanmamış.'
            );
            return;
        }

        movementTypesCache.forEach(item => {
            const card = document.createElement('article');
            card.className = 'management-item';
            const header = document.createElement('div');
            header.className = 'management-item-header';
            const text = document.createElement('div');
            const title = document.createElement('h3');
            const description = document.createElement('p');
            title.textContent = item.name;
            description.textContent = item.description || 'Açıklama bulunmuyor.';
            text.append(title, description);
            header.append(text, createStatusBadge(item.active));

            const details = document.createElement('div');
            details.className = 'management-item-details';
            const order = document.createElement('span');
            const orderTitle = document.createElement('strong');
            orderTitle.textContent = 'Sıra: ';
            order.append(orderTitle, document.createTextNode(
                String(item.sort_order)
            ));
            details.appendChild(order);

            const actions = document.createElement('div');
            actions.className = 'item-actions';
            actions.appendChild(createActionButton(
                'Düzenle',
                'btn-secondary',
                () => {
                    movementTypeIdInput.value = String(item.id);
                    movementTypeNameInput.value = item.name;
                    movementTypeDescriptionInput.value =
                        item.description || '';
                    movementTypeSortOrderInput.value =
                        String(item.sort_order);
                    movementTypeActiveInput.checked = item.active;
                    movementTypeNameInput.disabled = item.locked;
                    movementTypeActiveInput.disabled = item.locked;
                    movementTypeCancelBtn.classList.remove('hidden');
                    movementTypeDescriptionInput.focus();
                }
            ));
            if (!item.locked) {
                actions.appendChild(createActionButton(
                    item.active ? 'Pasifleştir' : 'Aktifleştir',
                    'btn-outline',
                    () => toggleMovementType(item)
                ));
            }
            card.append(header, details, actions);
            movementTypeList.appendChild(card);
        });
    }

    async function loadMovementTypeManagement() {
        showListMessage(movementTypeList, 'Yükleniyor...');
        try {
            const result = await apiRequest(
                '/api/movement-types?include_inactive=1'
            );
            movementTypesCache = Array.from(result.movement_types || []);
            renderMovementTypeList();
            await loadMovementTypes();
        } catch (error) {
            showListMessage(movementTypeList, error.message);
        }
    }

    async function toggleMovementType(item) {
        try {
            const result = await apiRequest(
                `/api/movement-types/${item.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ active: !item.active }),
                }
            );
            window.showToast(result.message, 'success');
            await loadMovementTypeManagement();
        } catch (error) {
            window.showToast(error.message, 'error');
        }
    }

    function showMovementTypeManagement() {
        if (!state.isAdmin) {
            window.showToast('Bu işlem için yönetici yetkisi gerekiyor.', 'error');
            return;
        }
        hideAllSections();
        movementTypeManagementSection.classList.remove('hidden');
        movementTypeManagementSection.classList.add('active');
        resetMovementTypeForm();
        loadMovementTypeManagement();
    }

    // ---- DASHBOARD / İŞLEM (KAMERA) AKIŞI ----
    pickupBtn.addEventListener('click', () => startProcess('Araç Alma', 'pickup'));
    dropoffBtn.addEventListener('click', () => startProcess('Teslim Etme', 'dropoff'));
    activeVehiclesBtn.addEventListener('click', showActiveVehicles);
    backFromActiveVehiclesBtn.addEventListener('click', showActionSelection);
    refreshActiveTripsBtn.addEventListener('click', loadActiveTrips);
    activeTripSearch.addEventListener('input', renderActiveTrips);
    fleetManagementBtn.addEventListener('click', showFleetManagement);
    movementTypeManagementBtn.addEventListener(
        'click',
        showMovementTypeManagement
    );
    backFromFleetManagementBtn.addEventListener(
        'click',
        () => reportMenuBtn.click()
    );
    backFromMovementTypeManagementBtn.addEventListener(
        'click',
        () => reportMenuBtn.click()
    );
    fleetTabs.forEach(tab => {
        tab.addEventListener(
            'click',
            () => showFleetTab(tab.dataset.fleetTab)
        );
    });
    brandCancelBtn.addEventListener('click', resetBrandForm);
    modelCancelBtn.addEventListener('click', resetModelForm);
    vehicleCancelBtn.addEventListener('click', resetVehicleForm);
    movementTypeCancelBtn.addEventListener(
        'click',
        resetMovementTypeForm
    );
    brandForm.addEventListener('submit', event => {
        event.preventDefault();
        const id = brandIdInput.value;
        submitCatalogForm(
            brandForm,
            id ? `/api/brands/${id}` : '/api/brands',
            {
                id,
                data: {
                    name: brandNameInput.value,
                    active: brandActiveInput.checked,
                },
            },
            resetBrandForm
        );
    });
    modelForm.addEventListener('submit', event => {
        event.preventDefault();
        const id = modelIdInput.value;
        submitCatalogForm(
            modelForm,
            id ? `/api/models/${id}` : '/api/models',
            {
                id,
                data: {
                    brand_id: Number(modelBrandSelect.value),
                    name: modelNameInput.value,
                    active: modelActiveInput.checked,
                },
            },
            resetModelForm
        );
    });
    vehicleForm.addEventListener('submit', event => {
        event.preventDefault();
        const id = vehicleIdInput.value;
        submitCatalogForm(
            vehicleForm,
            id ? `/api/vehicles/${id}` : '/api/vehicles',
            {
                id,
                data: {
                    plate: vehiclePlateInput.value,
                    model_id: Number(vehicleModelSelect.value),
                    year: vehicleYearInput.value,
                    active: vehicleActiveInput.checked,
                },
            },
            resetVehicleForm
        );
    });
    movementTypeForm.addEventListener('submit', async event => {
        event.preventDefault();
        const id = movementTypeIdInput.value;
        const submitButton = movementTypeForm.querySelector(
            'button[type="submit"]'
        );
        submitButton.disabled = true;
        try {
            const result = await apiRequest(
                id ? `/api/movement-types/${id}` : '/api/movement-types',
                {
                    method: id ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: movementTypeNameInput.value,
                        description: movementTypeDescriptionInput.value,
                        sort_order: movementTypeSortOrderInput.value,
                        active: movementTypeActiveInput.checked,
                    }),
                }
            );
            window.showToast(result.message, 'success');
            resetMovementTypeForm();
            await loadMovementTypeManagement();
        } catch (error) {
            window.showToast(error.message, 'error');
        } finally {
            submitButton.disabled = false;
        }
    });
    backToActionsBtn.addEventListener('click', showActionSelection);
    actionLogoutBtn.addEventListener('click', logout);


    function startProcess(
        title,
        actionTypeStr,
        preselectedPlate = null,
        preselectedActionType = null
    ) {
        state.currentAction = actionTypeStr;
        state.currentStep = 1;
        state.plate = null;
        state.actionType = null;
        state.mileage = null;
        state.requestNo = null;
        state.serviceFormNo = null;
        state.notes = null;
        actionTypeSelect.value = (
            Array.from(actionTypeSelect.options).some(option => (
                option.value === preselectedActionType
            ))
                ? preselectedActionType
                : Array.from(actionTypeSelect.options).some(
                    option => option.value === 'Diğer'
                )
                    ? 'Diğer'
                    : actionTypeSelect.options[0]?.value || ''
        );
        mileageInput.value = '';
        requestNoInput.value = '';
        serviceFormNoInput.value = '';
        notesInput.value = '';
        updateSelectedVehicleInfo('');
        
        dashboardTitle.textContent = title;
        
        hideAllSections();
        dashboardSection.classList.remove('hidden');
        dashboardSection.classList.add('active');
        
        isPlateListReady = false;
        if (triggerOcrBtn) {
            triggerOcrBtn.textContent = '⏳ Kamera hazırlanıyor...';
            triggerOcrBtn.disabled = true;
        }

        const platesPromise = loadPlatesForDashboard()
            .then(() => {
                const parsedPlate = parseTurkishPlate(
                    String(preselectedPlate || ''),
                    { allowOcrCorrections: false }
                );
                if (!parsedPlate) return;
                let option = Array.from(plateSelect.options).find(
                    candidate => candidate.value === parsedPlate.normalized
                );
                if (!option) {
                    option = document.createElement('option');
                    option.value = parsedPlate.normalized;
                    option.dataset.plate = parsedPlate.normalized;
                    option.dataset.ocrTemporary = 'true';
                    option.textContent =
                        `${formatPlateForDisplay(parsedPlate.normalized)} (devam eden kullanım)`;
                    plateSelect.appendChild(option);
                }
                plateSelect.value = parsedPlate.normalized;
                plateSelect.dispatchEvent(new Event('change'));
            })
            .finally(() => {
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
    const OCR_GENERAL_PARAMETERS = Object.freeze({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
        tessedit_pageseg_mode: '7',
        preserve_interword_spaces: '1'
    });
    const OCR_PROVINCE_PARAMETERS = Object.freeze({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: '8',
        preserve_interword_spaces: '0'
    });
    const OCR_PROVINCE_CHARACTER_PARAMETERS = Object.freeze({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: '10',
        preserve_interword_spaces: '0'
    });
    const GEMINI_TIMEOUT_MS = 20000;
    const TESSERACT_STAGE_TIMEOUT_MS = 15000;
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

                await worker.setParameters(OCR_GENERAL_PARAMETERS);

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
    const ocrVehicleInfoContainer = document.getElementById(
        'ocr-vehicle-info-container'
    );
    const ocrVehicleInfo = document.getElementById('ocr-vehicle-info');
    const ocrConfirmBtn = document.getElementById('ocr-confirm-btn');
    const ocrEditBtn = document.getElementById('ocr-edit-btn');
    const ocrRetryBtn = document.getElementById('ocr-retry-btn');
    const ocrManualEditContainer = document.getElementById('ocr-manual-edit-container');
    const ocrManualInput = document.getElementById('ocr-manual-input');
    const ocrDebugCanvas = document.getElementById('ocr-debug-canvas');
    const ocrOriginalCanvas = document.getElementById('ocr-original-crop-canvas'); // Yeni eklendi

    let currentOcrPlate = null;
    let currentOcrSource = null;

    function updateOcrVehicleInfo(plate) {
        if (!ocrVehicleInfoContainer || !ocrVehicleInfo) return;
        const vehicle = getVehicleDetails(plate);
        if (!vehicle?.vehicleName) {
            ocrVehicleInfo.textContent = '';
            ocrVehicleInfoContainer.classList.add('hidden');
            return;
        }

        ocrVehicleInfo.textContent = vehicle.displayLabel;
        ocrVehicleInfoContainer.classList.remove('hidden');
    }

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

    function buildEstimateOnlyUnionCrop(
        candidates,
        {
            detectionWidth,
            detectionHeight,
            sourceWidth,
            sourceHeight,
        }
    ) {
        const anchor = candidates?.[0];
        if (!anchor) {
            return null;
        }

        const neighbours = Array.from(candidates || []).slice(1)
            .map(candidate => {
                const minimumHeight = Math.min(anchor.h, candidate.h);
                const verticalOverlap = Math.max(
                    0,
                    Math.min(anchor.y + anchor.h, candidate.y + candidate.h)
                    - Math.max(anchor.y, candidate.y)
                );
                const x = Math.min(anchor.x, candidate.x);
                const right = Math.max(
                    anchor.x + anchor.w,
                    candidate.x + candidate.w
                );
                const width = right - x;
                const uniqueWidth = width - Math.max(anchor.w, candidate.w);
                return {
                    candidate,
                    verticalOverlapRatio: verticalOverlap / Math.max(1, minimumHeight),
                    x,
                    width,
                    uniqueWidth,
                };
            })
            .filter(entry => (
                entry.verticalOverlapRatio >= 0.58
                && entry.uniqueWidth >= Math.min(anchor.w, entry.candidate.w) * 0.12
                && entry.width / anchor.h >= 2.4
                && entry.width / anchor.h <= 9.5
                && entry.width <= detectionWidth * 0.92
            ))
            .sort((left, right) => (
                right.width - left.width
                || Number(right.candidate.ocrScore ?? right.candidate.score)
                    - Number(left.candidate.ocrScore ?? left.candidate.score)
            ));

        const neighbour = neighbours[0];
        if (!neighbour) {
            return null;
        }

        const mapped = mapPlateCandidatesToSource(
            [{
                x: neighbour.x,
                y: anchor.y,
                w: neighbour.width,
                h: anchor.h,
                score: Math.max(
                    Number(anchor.ocrScore ?? anchor.score) || 0,
                    Number(neighbour.candidate.ocrScore ?? neighbour.candidate.score) || 0
                ),
            }],
            {
                detectionWidth,
                detectionHeight,
                sourceWidth,
                sourceHeight,
                horizontalPadding: 0,
                verticalPadding: 0,
            }
        )[0];

        return mapped ? { ...mapped, estimateOnly: true } : null;
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
        const orderedCrops = orderOcrCropRegions(
            automaticCrops,
            fallbackCrops,
            { automatic }
        );
        const estimateOnlyUnionCrop = buildEstimateOnlyUnionCrop(
            detection.candidates,
            {
                detectionWidth: detection.width,
                detectionHeight: detection.height,
                sourceWidth,
                sourceHeight,
            }
        );
        const sourceCrops = estimateOnlyUnionCrop
            ? [
                ...orderedCrops.slice(0, 2),
                estimateOnlyUnionCrop,
                ...orderedCrops.slice(2),
            ]
            : orderedCrops;

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
        const serverCandidateEntries = cropCaptures
            .map((capture, captureIndex) => ({ capture, captureIndex }))
            .filter(entry => !entry.capture.sourceCrop?.estimateOnly)
            .slice(0, 4);
        const serverCandidates = serverCandidateEntries.map(entry => entry.capture);
        if (!serverCandidates.length) {
            return null;
        }

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

                const serverCandidateIndex = Number.isInteger(data.candidate_index)
                    ? Math.max(0, Math.min(serverCandidates.length - 1, data.candidate_index))
                    : 0;
                return {
                    plate,
                    candidateIndex: serverCandidateEntries[serverCandidateIndex].captureIndex,
                    estimated: Boolean(data.estimated),
                };
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

    function extractLiteralProvinceToken(value) {
        const source = String(value || '').toUpperCase();
        const pattern = /(?:^|[^A-Z0-9])(\d{2})(?!\d)/g;
        let match;

        while ((match = pattern.exec(source)) !== null) {
            const provinceCode = Number(match[1]);
            if (provinceCode >= 1 && provinceCode <= 81) {
                return match[1];
            }
        }
        return null;
    }

    function buildProvinceObservationsFromFullOcr(fullObservations) {
        const suffixVotes = new Map();
        for (const observation of fullObservations) {
            const parsed = parseTurkishPlate(observation.text);
            if (!parsed) continue;

            const suffixKey = `${parsed.letters}|${parsed.digits}`;
            const evidenceKeys = suffixVotes.get(suffixKey) || new Set();
            evidenceKeys.add(observation.evidenceKey);
            suffixVotes.set(suffixKey, evidenceKeys);
        }

        const rankedSuffixes = Array.from(suffixVotes.entries())
            .sort((left, right) => right[1].size - left[1].size);
        const dominantSuffix = (
            rankedSuffixes[0]
            && rankedSuffixes[0][1].size >= 2
            && (
                !rankedSuffixes[1]
                || rankedSuffixes[0][1].size > rankedSuffixes[1][1].size
            )
        )
            ? rankedSuffixes[0][0]
            : null;

        return fullObservations.flatMap(observation => {
            const provinceText = extractLiteralProvinceToken(observation.text);
            if (!provinceText) {
                return [];
            }

            const parsed = parseTurkishPlate(observation.text);
            const suffixKey = parsed ? `${parsed.letters}|${parsed.digits}` : null;
            if (
                dominantSuffix
                && suffixKey
                && suffixKey !== dominantSuffix
                && !parsed.ocrCorrected
            ) {
                return [];
            }

            return [{
                text: provinceText,
                confidence: observation.confidence,
                evidenceKey: `literal-province:${observation.evidenceKey}`,
            }];
        });
    }

    function captureHorizontalOcrSegment(capture, startRatio, endRatio) {
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = capture.canvas.width;
        sourceCanvas.height = capture.canvas.height;
        sourceCanvas
            .getContext('2d')
            .putImageData(capture.originalImageData, 0, 0);

        const startX = Math.max(
            0,
            Math.min(sourceCanvas.width - 1, Math.floor(sourceCanvas.width * startRatio))
        );
        const endX = Math.max(
            startX + 1,
            Math.min(sourceCanvas.width, Math.ceil(sourceCanvas.width * endRatio))
        );
        const canvas = document.createElement('canvas');
        canvas.width = endX - startX;
        canvas.height = sourceCanvas.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            throw new Error('İl kodu OCR görüntüsü hazırlanamadı.');
        }
        ctx.drawImage(
            sourceCanvas,
            startX,
            0,
            endX - startX,
            sourceCanvas.height,
            0,
            0,
            canvas.width,
            canvas.height
        );

        return {
            canvas,
            ctx,
            originalImageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        };
    }

    function capturePaddedOcrCharacter(capture, rectangle) {
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = capture.canvas.width;
        sourceCanvas.height = capture.canvas.height;
        sourceCanvas
            .getContext('2d')
            .putImageData(capture.originalImageData, 0, 0);

        const sourceX = Math.max(
            0,
            Math.floor(sourceCanvas.width * rectangle.x)
        );
        const sourceY = Math.max(
            0,
            Math.floor(sourceCanvas.height * rectangle.y)
        );
        const sourceWidth = Math.max(
            1,
            Math.min(
                sourceCanvas.width - sourceX,
                Math.ceil(sourceCanvas.width * rectangle.w)
            )
        );
        const sourceHeight = Math.max(
            1,
            Math.min(
                sourceCanvas.height - sourceY,
                Math.ceil(sourceCanvas.height * rectangle.h)
            )
        );
        const paddingLeft = Math.round(sourceWidth * 0.125);
        const paddingRight = Math.round(sourceWidth * 0.125);
        const paddingTop = Math.round(sourceHeight * 0.14);
        const paddingBottom = Math.round(sourceHeight * 0.12);
        const canvas = document.createElement('canvas');
        canvas.width = sourceWidth + paddingLeft + paddingRight;
        canvas.height = sourceHeight + paddingTop + paddingBottom;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            throw new Error('İl kodu karakter görüntüsü hazırlanamadı.');
        }
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
            sourceCanvas,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            paddingLeft,
            paddingTop,
            sourceWidth,
            sourceHeight
        );
        return { canvas, ctx };
    }

    async function requestProvinceSegmentObservations(
        worker,
        cropCaptures,
        sessionId
    ) {
        const observations = [];
        let shouldRestoreGeneralParameters = true;
        const prioritizedCaptures = [
            ...cropCaptures.filter(capture => capture.sourceCrop?.estimateOnly),
            ...cropCaptures.filter(capture => !capture.sourceCrop?.estimateOnly),
        ].slice(0, 3);
        const stages = [
            { name: 'AutoContrast', apply: (c, w, h) => processAutoContrast(c, w, h) },
            { name: 'Adaptive', apply: (c, w, h) => processAdaptiveThreshold(c, w, h) },
            { name: 'Otsu', apply: (c, w, h) => processOtsuThreshold(c, w, h) },
            { name: 'Original', apply: () => {} },
        ];

        try {
            const estimateOnlyCapture = prioritizedCaptures.find(
                capture => capture.sourceCrop?.estimateOnly
            );
            if (estimateOnlyCapture) {
                await worker.setParameters(OCR_PROVINCE_CHARACTER_PARAMETERS);
                const provinceCharacterRectangles = [
                    { x: 0.0555, y: 0, w: 0.1268, h: 0.8958 },
                    { x: 0.1680, y: 0, w: 0.1387, h: 0.9042 },
                ];
                const provinceCharacters = [];
                const characterConfidences = [];
                for (
                    let characterIndex = 0;
                    characterIndex < provinceCharacterRectangles.length;
                    characterIndex += 1
                ) {
                    const characterCapture = capturePaddedOcrCharacter(
                        estimateOnlyCapture,
                        provinceCharacterRectangles[characterIndex]
                    );
                    triggerOcrBtn.textContent =
                        `⏳ İl kodu karakteri okunuyor: ${characterIndex + 1}/2`;
                    const result = await recognizeWithTimeout(
                        worker,
                        characterCapture.canvas,
                        TESSERACT_STAGE_TIMEOUT_MS
                    );
                    if (sessionId !== ocrSessionId) {
                        return observations;
                    }
                    const character = String(result.data.text || '').match(/\d/)?.[0];
                    if (!character) {
                        provinceCharacters.length = 0;
                        break;
                    }
                    provinceCharacters.push(character);
                    characterConfidences.push(Number(result.data.confidence) || 0);
                }
                if (provinceCharacters.length === 2) {
                    const provinceText = provinceCharacters.join('');
                    observations.push({
                        text: provinceText,
                        confidence: characterConfidences.reduce(
                            (total, confidence) => total + confidence,
                            0
                        ) / characterConfidences.length,
                        evidenceKey: 'province-characters:estimate-union',
                    });
                    const provinceCode = Number(provinceText);
                    if (provinceCode >= 1 && provinceCode <= 81) {
                        return observations;
                    }
                }
            }

            await worker.setParameters(OCR_PROVINCE_PARAMETERS);
            for (
                let captureIndex = 0;
                captureIndex < prioritizedCaptures.length;
                captureIndex += 1
            ) {
                for (const stage of stages) {
                    if (sessionId !== ocrSessionId) {
                        return observations;
                    }

                    const segment = captureHorizontalOcrSegment(
                        prioritizedCaptures[captureIndex],
                        0,
                        0.42
                    );
                    stage.apply(
                        segment.ctx,
                        segment.canvas.width,
                        segment.canvas.height
                    );
                    triggerOcrBtn.textContent =
                        `⏳ İl kodu tahmin ediliyor: ${captureIndex + 1}/${prioritizedCaptures.length}`;
                    const result = await recognizeWithTimeout(
                        worker,
                        segment.canvas,
                        TESSERACT_STAGE_TIMEOUT_MS
                    );
                    const digits = String(result.data.text || '').replace(/\D/g, '');
                    if (digits.length >= 2) {
                        observations.push({
                            text: digits,
                            confidence: Number(result.data.confidence) || 0,
                            evidenceKey: `province-segment:${captureIndex}:${stage.name}`,
                        });
                    }
                }
            }
        } catch (error) {
            if (
                error instanceof OcrTimeoutError
                || error.name === 'OcrTimeoutError'
            ) {
                // The outer OCR handler terminates this worker. Queueing
                // setParameters behind a stuck recognition would hide the timeout.
                shouldRestoreGeneralParameters = false;
            }
            throw error;
        } finally {
            if (shouldRestoreGeneralParameters) {
                await worker.setParameters(OCR_GENERAL_PARAMETERS);
            }
        }

        return observations;
    }

    function buildTentativeOcrMatch(estimate, fullObservations) {
        const observation = (
            fullObservations[estimate.bestFullObservationIndex]
            || fullObservations[0]
        );
        if (!observation) {
            return null;
        }

        return {
            text: estimate.normalized,
            confidence: estimate.confidence,
            corrected: false,
            estimated: true,
            requiresConfirmation: true,
            consensus: estimate.suffixEvidenceCount,
            parts: [
                estimate.provinceCode.toString().padStart(2, '0'),
                estimate.letters,
                estimate.digits,
            ],
            canvasContext: observation.canvasContext,
            originalCanvasContext: observation.originalCanvasContext,
            canvasW: observation.canvasW,
            canvasH: observation.canvasH,
            cropIndex: observation.cropIndex,
            stage: observation.stage,
        };
    }

    async function requestLocalOcr(cropCaptures, sessionId) {
        triggerOcrBtn.textContent = '⏳ Yerel OCR hazırlanıyor...';
        const worker = await ensureOcrWorker();
        const registeredPlates = getRegisteredPlateOptions()
            .map(option => option.dataset.plate || option.value);
        const candidates = [];
        const votes = new Map();
        const fullObservations = [];
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
                const stageImageData = ctx.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );
                fullObservations.push({
                    text: recognizedText,
                    confidence,
                    evidenceKey: `full:${cropIndex}:${stage.name}`,
                    canvasContext: stageImageData,
                    originalCanvasContext: originalImageData,
                    canvasW: canvas.width,
                    canvasH: canvas.height,
                    cropIndex,
                    stage: stage.name,
                });
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
                    !capture.sourceCrop?.estimateOnly
                    && (
                    recognizedCompact.length === 7
                    || recognizedCompact.length === 8
                    )
                )
                    ? matchRegisteredPlate(
                        recognizedText,
                        eligibleRegisteredPlates
                    )
                    : null;
                const parsed = registeredMatch
                    ? parseTurkishPlate(registeredMatch.normalized)
                    : parseTurkishPlate(recognizedText);
                const hasSafeProvinceEvidence = (
                    hasSafeProvinceEvidenceForStrictAutoAcceptance(parsed)
                );

                if (
                    !capture.sourceCrop?.estimateOnly
                    && parsed
                    && hasSafeProvinceEvidence
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
                        canvasContext: stageImageData,
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
        const bestVote = best ? votes.get(best.text) : null;
        if (
            best
            && (
                best.registered
                || shouldAcceptOcrConsensus(bestVote)
            )
        ) {
            return { ...best, consensus: bestVote?.count || 1 };
        }

        let provinceObservations = buildProvinceObservationsFromFullOcr(
            fullObservations
        );
        let estimate = inferTurkishPlateEstimate(
            fullObservations,
            provinceObservations
        );
        if (!estimate || estimate.provinceEvidenceCount < 2) {
            const segmentedProvinceObservations = (
                await requestProvinceSegmentObservations(
                    worker,
                    cropCaptures,
                    sessionId
                )
            );
            if (sessionId !== ocrSessionId) {
                return null;
            }
            provinceObservations = [
                ...provinceObservations,
                ...segmentedProvinceObservations,
            ];
            const corroboratedEstimate = inferTurkishPlateEstimate(
                fullObservations,
                provinceObservations
            );
            if (corroboratedEstimate) {
                estimate = corroboratedEstimate;
            }
        }
        if (!estimate) {
            estimate = inferTurkishPlateEstimate(
                fullObservations,
                provinceObservations,
                { minimumSuffixEvidence: 1 }
            );
        }

        if (estimate) {
            return buildTentativeOcrMatch(estimate, fullObservations);
        }
        if (best) {
            return {
                ...best,
                estimated: true,
                requiresConfirmation: true,
                consensus: bestVote?.count || 1,
            };
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

        if (bestMatch.estimated) {
            ocrConfidence.textContent =
                '⚠️ Tahmini okuma • Onaylamadan önce kontrol edin.';
            ocrConfidence.style.color = '#facc15';
        } else if (source === 'gemini') {
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

        const currentMatchedOption = bestMatch.estimated
            ? resolveOcrPlate(currentOcrPlate)?.option || null
            : findRegisteredPlateOption(currentOcrPlate);
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
        updateOcrVehicleInfo(currentMatchedOption?.value || currentOcrPlate);

        if (bestMatch.estimated) {
            ocrManualEditContainer.classList.remove('hidden');
            ocrManualInput.value = bestMatch.parts.join(' ');
            validateManualInput();
        } else {
            ocrManualEditContainer.classList.add('hidden');
        }
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
                    estimated: Boolean(serverResult.estimated),
                    requiresConfirmation: Boolean(serverResult.estimated),
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
                setAutoScanStatus(
                    bestMatch.estimated
                        ? 'Tahmini plaka bulundu; lütfen kontrol edin.'
                        : 'Plaka otomatik okundu; sonucu onaylayın.',
                    bestMatch.estimated ? 'found' : 'success'
                );
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
                    ? 'Plaka hizalandı. Okutmak için "Şimdi Tara" düğmesine basın.'
                    : 'Plaka bulundu; kısa süre sabit tutun.',
                stable ? 'success' : 'found'
            );

            // OTOMATİK OCR ÇAĞRISI İPTAL EDİLDİ - Yalnızca "Şimdi Tara" ile çalışacak
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
            const transferredLabel = (
                option.dataset.vehicleLabel
                || formatPlateForDisplay(resolvedPlate.normalized)
            );
            window.showToast(
                `Plaka forma aktarıldı: ${transferredLabel}${registrationNote}`,
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
        updateOcrVehicleInfo(
            resolvedPlate?.option?.value || resolvedPlate?.normalized
        );
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
            
            manualTitle.textContent = 'Kilometre ve İşlem Bilgileri';
            manualSubtitle.textContent =
                `Plaka: ${getVehicleDisplayLabel(state.plate)} | Kullanım: ${state.actionType}`;
            
            stepPlateContainer.classList.add('hidden');
            stepMileageContainer.classList.remove('hidden');
            
            processBtnText.textContent = 'İşlemi Tamamla';
            processBtn.disabled = mileageInput.value === "";
        }
    }

    plateSelect.addEventListener('change', (e) => {
        updateSelectedVehicleInfo(e.target.value);
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
            state.requestNo = requestNoInput.value.trim();
            state.serviceFormNo = serviceFormNoInput.value.trim();
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
                        request_no: state.requestNo,
                        service_form_no: state.serviceFormNo,
                        notes: state.notes
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    window.showToast(result.message, 'success');
                    activeTripsCache = [];
                    mileageInput.value = '';
                    requestNoInput.value = '';
                    serviceFormNoInput.value = '';
                    notesInput.value = '';
                    plateSelect.value = '';
                    updateSelectedVehicleInfo('');
                    processBtn.disabled = false;
                    setTimeout(() => showActionSelection(), 2500);
                } else {
                    window.showToast(result.message || 'Kayıt sırasında hata oluştu.', 'error');
                }
            } catch (error) {
                console.error("Kayıt hatası:", error);
                window.showToast('Sunucu ile iletişim kurulamadı.', 'error');
            } finally {
                processBtn.disabled = false;
            }
        }
    });


    // ---- RAPORLAR MENÜSÜ AKIŞI ----
    
    // Rapor state
    let currentRecords = [];
    const REPORT_COLUMN_COUNT = 13;
    const filterActionType = document.getElementById('filter-action-type');
    const globalSearch = document.getElementById('global-search');
    const sortBy = document.getElementById('sort-by');

    reportMenuBtn.addEventListener('click', () => {
        hideAllSections();
        reportsMenuSection.classList.remove('hidden');
        reportsMenuSection.classList.add('active');
        loadDatabaseStatus();
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
            reportTitle.textContent =
                `🚗 Araç Raporu: ${getVehicleDisplayLabel(selectedPlate)}`;
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
        
        reportTableBody.innerHTML =
            `<tr><td colspan="${REPORT_COLUMN_COUNT}" style="text-align:center;">Yükleniyor...</td></tr>`;
        
        // Reset filters
        filterActionType.value = 'all';
        globalSearch.value = '';
        sortBy.value = 'date-desc';

        try {
            const response = await fetch(apiUrl);
            const result = await response.json();
            
            if (response.ok && result.success) {
                currentRecords = result.records; // Veriyi kaydet
                await loadMovementTypes();
                applyFiltersAndSort(); // Tabloyu render et
            } else {
                reportTableBody.innerHTML =
                    `<tr><td colspan="${REPORT_COLUMN_COUNT}" style="text-align:center; color:#ef4444;">Veriler alınamadı.</td></tr>`;
                window.showToast('Raporlar alınamadı.', 'error');
            }
        } catch (error) {
            console.error("Rapor API hatası:", error);
            reportTableBody.innerHTML =
                `<tr><td colspan="${REPORT_COLUMN_COUNT}" style="text-align:center; color:#ef4444;">Sunucu bağlantı hatası.</td></tr>`;
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
            filtered = filtered.filter(r => (r.action_type || '') === typeFilter);
        }

        // Filtreleme - Global Arama (Plaka, Araç, Sürücü, Not)
        const searchVal = globalSearch.value.toLowerCase().trim();
        if (searchVal !== '') {
            filtered = filtered.filter(r => {
                const combinedString = (
                    `${r.plate || ''} ${r.vehicle_name || ''} `
                    + `${r.driver || ''} ${r.request_no || ''} `
                    + `${r.service_form_no || ''} ${r.notes || ''}`
                ).toLowerCase();
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
            reportTableBody.innerHTML =
                `<tr><td colspan="${REPORT_COLUMN_COUNT}" style="text-align:center;">Henüz bir kayıt bulunmuyor.</td></tr>`;
            return;
        }
        
        records.forEach(record => {
            const tr = document.createElement('tr');
            const values = [
                { value: record.action_type || '-' },
                { value: record.add_date || '-' },
                { value: record.vehicle_name || '-' },
                { value: record.plate || '-', strong: true },
                { value: record.driver || '-' },
                { value: record.request_no || '-' },
                { value: record.service_form_no || '-' },
                { value: record.start_mileage || '-' },
                { value: record.end_mileage || '-' },
                { value: record.start_date || '-' },
                { value: record.distance || '0', strong: true },
                { value: record.end_date || '-' },
                { value: record.notes || '' },
            ];
            values.forEach(({ value, strong = false }) => {
                const td = document.createElement('td');
                if (strong) {
                    const strongElement = document.createElement('strong');
                    strongElement.textContent = value;
                    td.appendChild(strongElement);
                } else {
                    td.textContent = value;
                }
                tr.appendChild(td);
            });
            reportTableBody.appendChild(tr);
        });
    }

    // ---- API YARDIMCI FONKSİYONLAR (PLAKALARI GETİRME) ----
    
    async function fetchPlatesAPI() {
        try {
            const response = await fetch('/api/plates');
            const result = await response.json();
            if (response.ok && result.success) {
                const detailedVehicles = (
                    Array.isArray(result.vehicles) ? result.vehicles : []
                )
                    .map(normalizeVehicleDetails)
                    .filter(Boolean);
                const fallbackVehicles = (
                    Array.isArray(result.plates) ? result.plates : []
                )
                    .map(normalizeVehicleDetails)
                    .filter(Boolean);
                const vehicles = detailedVehicles.length > 0
                    ? detailedVehicles
                    : fallbackVehicles;
                registeredVehiclesByPlate = new Map(
                    vehicles.map(vehicle => [vehicle.plate, vehicle])
                );
                return Array.from(registeredVehiclesByPlate.values());
            }
        } catch (error) {
            console.error("Plaka API hatası:", error);
        }
        return [];
    }

    async function loadPlatesForDashboard() {
        const vehicles = await fetchPlatesAPI();
        plateSelect.innerHTML = '<option value="" disabled selected>Plaka Seçin...</option>';
        vehicles.forEach(vehicle => {
            const opt = document.createElement('option');
            opt.value = vehicle.plate;
            opt.dataset.plate = vehicle.plate;
            opt.dataset.vehicleLabel = vehicle.displayLabel;
            opt.textContent = vehicle.displayLabel;
            plateSelect.appendChild(opt);
        });
        if (state.plate) plateSelect.value = state.plate;
        updateSelectedVehicleInfo(plateSelect.value);
    }

    async function loadPlatesForReport() {
        const vehicles = await fetchPlatesAPI();
        reportPlateSelect.innerHTML = '<option value="" disabled selected>Plaka Seçin...</option>';
        vehicles.forEach(vehicle => {
            const opt = document.createElement('option');
            opt.value = vehicle.plate;
            opt.dataset.plate = vehicle.plate;
            opt.dataset.vehicleLabel = vehicle.displayLabel;
            opt.textContent = vehicle.displayLabel;
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

        if (
            fleetManagementSection.classList.contains('active')
            || movementTypeManagementSection.classList.contains('active')
        ) {
            reportMenuBtn.click();
            return true;
        }

        if (activeVehiclesSection.classList.contains('active')) {
            showActionSelection();
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
        state = {
            username: null,
            isAdmin: false,
            currentAction: null,
            currentStep: 1,
            plate: null,
            actionType: null,
            mileage: null,
            requestNo: null,
            serviceFormNo: null,
            notes: null,
        };
        updateAdminVisibility();
        document.getElementById('login-form').reset();
        
        loginSection.classList.remove('hidden');
        loginSection.classList.add('active');
        
        window.showToast('Başarıyla çıkış yapıldı.', 'success');
    }
});
