from flask import Flask, render_template, request, jsonify
from datetime import datetime

app = Flask(__name__)

# Dummy veri tabanı simülasyonu - Kullanıcılar
USERS_DB = {
    "admin": "admin123",
    "kullanici": "sifre123"
}

# Dummy veri tabanı simülasyonu - Plakalar
PLATES_DB = [
    "34 ABC 123",
    "06 DEF 456",
    "35 GHI 789",
    "07 JKL 012"
]

# Bellek tabanlı (In-memory) kayıt veritabanı (Sunucu kapanınca sıfırlanır)
# Örnek yapı: {"plate": "34 ABC 123", "action": "Araç Alma", "mileage": 145000, "user": "admin", "timestamp": "2026-07-28 14:40:00"}
RECORDS_DB = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"success": False, "message": "Eksik bilgi girdiniz."}), 400
        
    username = data.get('username')
    password = data.get('password')
    
    if username in USERS_DB and USERS_DB[username] == password:
        return jsonify({"success": True, "message": "Giriş başarılı."}), 200
    else:
        return jsonify({"success": False, "message": "Kullanıcı adı veya şifre hatalı."}), 401

@app.route('/api/plates', methods=['GET'])
def get_plates():
    return jsonify({"success": True, "plates": PLATES_DB}), 200

@app.route('/api/record', methods=['POST'])
def save_record():
    """
    Kullanıcının yaptığı işlemi (Araç Alma/Teslim ve Kilometre) kaydeder.
    """
    data = request.get_json()
    
    plate = data.get('plate')
    action = data.get('action')
    mileage = data.get('mileage')
    user = data.get('user')
    
    if not plate or not action or not mileage or not user:
        return jsonify({"success": False, "message": "Eksik veri gönderildi."}), 400
        
    # Geçerli zaman damgasını oluştur
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    record = {
        "plate": plate,
        "action": action,
        "mileage": mileage,
        "user": user,
        "timestamp": timestamp
    }
    
    # Yeni kaydı listeye ekle
    RECORDS_DB.append(record)
    
    return jsonify({"success": True, "message": "Kayıt başarıyla oluşturuldu."}), 201

@app.route('/api/reports/recent', methods=['GET'])
def get_recent_reports():
    """
    Kayıtları tarihe göre yeniden eskiye (descending) sıralayarak döndürür.
    """
    # Kayıtları en sondan başa doğru (yeniden eskiye) sırala
    sorted_records = list(reversed(RECORDS_DB))
    
    return jsonify({
        "success": True, 
        "records": sorted_records
    }), 200

@app.route('/api/reports/plate/<plate>', methods=['GET'])
def get_plate_reports(plate):
    """
    Belirli bir plakaya ait kayıtları tarihe göre yeniden eskiye sıralayarak döndürür.
    """
    filtered_records = [r for r in RECORDS_DB if r['plate'] == plate]
    sorted_records = list(reversed(filtered_records))
    
    return jsonify({
        "success": True, 
        "records": sorted_records
    }), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
