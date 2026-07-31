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
    const icon = document.createElement('span');
    const text = document.createElement('p');
    icon.textContent = type === 'error' ? '❌' : '✅';
    text.textContent = String(message || '');
    toast.append(icon, text);
    
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
    const btnText = document.getElementById('auth-btn-text');
    const spinner = loginBtn.querySelector('.spinner');
    
    const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
    const authTitle = document.getElementById('auth-title');
    let isRegisterMode = false;

    if (toggleAuthModeBtn) {
        toggleAuthModeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isRegisterMode = !isRegisterMode;
            const fullnameGroup = document.getElementById('fullname-group');
            const fullnameInput = document.getElementById('fullname');
            
            if (isRegisterMode) {
                authTitle.textContent = 'Yeni Hesap Oluştur';
                btnText.textContent = 'Kayıt Ol';
                toggleAuthModeBtn.textContent = 'Zaten hesabınız var mı? Giriş yapın.';
                fullnameGroup.classList.remove('hidden');
                fullnameInput.required = true;
            } else {
                authTitle.textContent = 'Güvenli Giriş';
                btnText.textContent = 'Giriş Yap';
                toggleAuthModeBtn.textContent = 'Hesabınız yok mu? Yeni kayıt oluşturun.';
                fullnameGroup.classList.add('hidden');
                fullnameInput.required = false;
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Sayfanın yenilenmesini engelle

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            const fullName = document.getElementById('fullname').value.trim();

            if (!username || !password || (isRegisterMode && !fullName)) {
                window.showToast('Lütfen tüm alanları doldurun.', 'error');
                return;
            }

            // Butonu yükleniyor durumuna al
            loginBtn.disabled = true;
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');

            try {
                const endpoint = isRegisterMode ? '/api/register' : '/api/login';
                const payload = { username, password };
                if (isRegisterMode) {
                    payload.full_name = fullName;
                }
                
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    window.showToast(result.message, 'success');
                    
                    if (isRegisterMode) {
                        // Kayıt sonrası otomatik login veya forma döndürme (burada isRegisterMode'u login'e çevirelim)
                        setTimeout(() => {
                            toggleAuthModeBtn.click();
                            document.getElementById('password').value = '';
                        }, 1000);
                    } else {
                        // Giriş başarılı, ana ekrana (dashboard) geçişi tetikle
                        if (typeof window.switchToDashboard === 'function') {
                            setTimeout(
                                () => window.switchToDashboard(
                                    username,
                                    Boolean(result.is_admin),
                                    result.full_name,
                                    result.profile_photo,
                                    result
                                ),
                                500
                            );
                        }
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
