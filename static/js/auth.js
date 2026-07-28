/**
 * auth.js
 * Kullanıcı giriş işlemlerini ve kimlik doğrulamayı yönetir.
 */

// Toast (Bildirim) gösterme fonksiyonu (Ortak kullanım için burada tanımlanıp main.js vs de kullanılabilir, 
// ancak SPA mantığında global window objesine de eklenebilir)
window.showToast = function(message, type = 'error') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'error' ? '❌' : '✅'}</span>
        <p>${message}</p>
    `;
    
    container.appendChild(toast);
    
    // 3 saniye sonra kaybolma animasyonunu başlat
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards ease-in';
        // Animasyon bitince DOM'dan sil
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const spinner = loginBtn.querySelector('.spinner');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Sayfanın yenilenmesini engelle

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            if (!username || !password) {
                window.showToast('Lütfen tüm alanları doldurun.', 'error');
                return;
            }

            // Butonu yükleniyor durumuna al
            loginBtn.disabled = true;
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');

            try {
                // Backend API'sine giriş isteği gönder
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    window.showToast(result.message, 'success');
                    
                    // Giriş başarılı, ana ekrana (dashboard) geçişi tetikle
                    // Bu fonksiyon main.js içinde tanımlı
                    if (typeof window.switchToDashboard === 'function') {
                        setTimeout(() => window.switchToDashboard(username), 500);
                    }
                } else {
                    window.showToast(result.message || 'Giriş başarısız.', 'error');
                }
            } catch (error) {
                console.error("Login hatası:", error);
                window.showToast('Sunucu ile iletişim kurulamadı.', 'error');
            } finally {
                // Butonu eski haline getir
                loginBtn.disabled = false;
                btnText.classList.remove('hidden');
                spinner.classList.add('hidden');
            }
        });
    }
});
