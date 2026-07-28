/**
 * camera.js
 * Tarayıcı üzerinden cihaz kamerasına erişimi ve olası hataların (izin reddi, cihaz yokluğu) yönetimini sağlar.
 */

window.cameraController = {
    stream: null,
    videoElement: null,
    errorElement: null,
    errorMsgElement: null,

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
        // Hata mesajını gizle
        this.errorElement.classList.add('hidden');
        
        // Eğer zaten açık bir kamera varsa kapat (yeniden başlatma durumları için)
        this.stopCamera();

        try {
            // Kamera izni iste ve akışı al
            // video: { facingMode: 'environment' } -> mobil cihazlarda arka kamerayı öncelikli açar
            const constraints = {
                video: {
                    facingMode: 'environment', 
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Akışı video elementine bağla
            this.videoElement.srcObject = this.stream;
            
        } catch (error) {
            console.error("Kamera erişim hatası:", error);
            this.handleCameraError(error);
        }
    },

    stopCamera: function() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
    },

    handleCameraError: function(error) {
        // Edge Cases (Hata Senaryoları) yönetimi
        this.errorElement.classList.remove('hidden');
        
        let errorMsg = "Kameraya erişilemedi.";
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMsg = "Kamera erişim izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.";
            window.showToast("Kamera izni verilmedi!", "error");
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMsg = "Cihazınızda bir kamera bulunamadı.";
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMsg = "Kamera başka bir uygulama tarafından kullanılıyor olabilir.";
        }
        
        this.errorMsgElement.textContent = errorMsg;
    }
};

// DOM yüklendiğinde başlat (ancak kamerayı hemen açma, ana ekrana geçince aç)
document.addEventListener('DOMContentLoaded', () => {
    window.cameraController.init();
});
