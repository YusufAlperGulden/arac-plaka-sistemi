from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Dummy veri tabanı simülasyonu - Kullanıcılar
# Şifreler basitlik adına plain-text (düz metin) olarak tutulmuştur. (Canlı ortamda hashlenmelidir)
USERS_DB = {
    "admin": "admin123",
    "kullanici": "sifre123"
}

# Dummy veri tabanı simülasyonu - Plakalar
# Kameralı sistemin yanı sıra manuel seçilebilecek ön tanımlı plakalar.
PLATES_DB = [
    "34 ABC 123",
    "06 DEF 456",
    "35 GHI 789",
    "07 JKL 012"
]

@app.route('/')
def index():
    """
    Ana sayfayı (Single Page Application iskeletini) render eder.
    Arayüz mantığı tamamen frontend tarafında JavaScript ile yönetilecektir.
    """
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    """
    Kullanıcı girişi için API endpoint'i.
    Gelen JSON verisindeki username ve password'ü kontrol eder.
    """
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"success": False, "message": "Eksik bilgi girdiniz."}), 400
        
    username = data.get('username')
    password = data.get('password')
    
    # Kullanıcı adı ve şifre kontrolü
    if username in USERS_DB and USERS_DB[username] == password:
        return jsonify({"success": True, "message": "Giriş başarılı."}), 200
    else:
        return jsonify({"success": False, "message": "Kullanıcı adı veya şifre hatalı."}), 401

@app.route('/api/plates', methods=['GET'])
def get_plates():
    """
    Sisteme kayıtlı plakaları döndüren API endpoint'i.
    Frontend'deki açılır menüyü (dropdown) doldurmak için kullanılır.
    """
    return jsonify({"success": True, "plates": PLATES_DB}), 200

if __name__ == '__main__':
    # Canlı ortamda (production) debug=False olmalı ve WSGI sunucusu kullanılmalıdır (örn. gunicorn, waitress)
    app.run(debug=True, host='0.0.0.0', port=5000)
