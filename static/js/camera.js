/**
 * camera.js
 * Tarayıcı üzerinden cihaz kamerasına erişimi ve olası hataların (izin reddi, cihaz yokluğu) yönetimini sağlar.
 */

window.cameraController = {
    stream: null,
    videoElement: null,
    errorElement: null,
    errorMsgElement: null,
    requestId: 0,

    init: function() {
        this.videoElement = document.getElementById('camera-stream');
        this.errorElement = document.getElementById('camera-error');
        this.errorMsgElement = document.getElementById('camera-error-msg');
        
        const retryBtn = document.getElementById('retry-camera-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.startCamera());
        }
    },

    startCamera: async function() {
        this.stopCamera();
        const requestId = ++this.requestId;
        this.errorElement?.classList.add('hidden');

        try {
            if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
                const error = new Error('Kamera erişimi için güvenli bağlantı gerekiyor.');
                error.name = 'InsecureContextError';
                throw error;
            }

            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (requestId !== this.requestId) {
                stream.getTracks().forEach(track => track.stop());
                return false;
            }

            this.stream = stream;
            this.videoElement.srcObject = this.stream;
            await this.waitUntilReady(this.videoElement, 8000);
            await this.videoElement.play();
            return true;
        } catch (error) {
            if (requestId !== this.requestId) {
                return false;
            }
            console.error("Kamera erişim hatası:", error);
            this.stopCamera();
            this.handleCameraError(error);
            return false;
        }
    },

    stopCamera: function() {
        this.requestId += 1;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.srcObject = null;
        }
    },

    waitUntilReady: function(video, timeoutMs) {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                cleanup();
                const error = new Error('Kamera görüntüsü zamanında hazırlanamadı.');
                error.name = 'CameraTimeoutError';
                reject(error);
            }, timeoutMs);

            const onReady = () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    cleanup();
                    resolve();
                }
            };

            const cleanup = () => {
                clearTimeout(timeoutId);
                video.removeEventListener('loadedmetadata', onReady);
                video.removeEventListener('canplay', onReady);
            };

            video.addEventListener('loadedmetadata', onReady);
            video.addEventListener('canplay', onReady);
        });
    },

    handleCameraError: function(error) {
        // Edge Cases (Hata Senaryoları) yönetimi
        this.errorElement?.classList.remove('hidden');
        
        let errorMsg = "Kameraya erişilemedi.";
        
        if (error.name === 'InsecureContextError') {
            errorMsg = "Kamera için uygulamayı HTTPS üzerinden veya localhost adresinde açın.";
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMsg = "Kamera erişim izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.";
            window.showToast("Kamera izni verilmedi!", "error");
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMsg = "Cihazınızda bir kamera bulunamadı.";
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMsg = "Kamera başka bir uygulama tarafından kullanılıyor olabilir.";
        } else if (error.name === 'CameraTimeoutError') {
            errorMsg = "Kamera görüntüsü hazırlanamadı. Tekrar deneyin.";
        }
        
        if (this.errorMsgElement) {
            this.errorMsgElement.textContent = errorMsg;
        }
    }
};

// DOM yüklendiğinde başlat (ancak kamerayı hemen açma, ana ekrana geçince aç)
document.addEventListener('DOMContentLoaded', () => {
    window.cameraController.init();
});
