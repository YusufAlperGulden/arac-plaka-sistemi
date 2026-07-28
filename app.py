from flask import Flask, render_template, request, jsonify
from datetime import datetime

app = Flask(__name__)

USERS_DB = {
    "Teknopalas": "123456",
    "admin": "admin123",
    "kullanici": "sifre123"
}

VEHICLES_DB = {
    "34KM4969": "2016 TRANSİT/TOUR...",
    "34EZS794": "RENAULT 2016 CLIO",
    "35 GHI 789": "FIAT EGEA 2020",
    "07 JKL 012": "FORD FOCUS 2018"
}

# Aktif (Başlamış ama bitmemiş) hareketler: plate -> { details }
ACTIVE_TRIPS = {}

# Tamamlanmış (veya mock) kayıtlar
RECORDS_DB = [
    {
        "action_type": "Diğer",
        "add_date": "19.01.2026 15:03:40",
        "vehicle_name": "2016 TRANSİT/TOUR...",
        "plate": "34KM4969",
        "driver": "Koray BAYRAM",
        "start_mileage": "193.286",
        "end_mileage": "193.371",
        "start_date": "02.01.2026 10:40:56",
        "distance": "85",
        "end_date": "02.01.2026 17:50:00",
        "notes": "akçelili"
    },
    {
        "action_type": "Diğer",
        "add_date": "19.01.2026 15:04:13",
        "vehicle_name": "RENAULT 2016 CLIO",
        "plate": "34EZS794",
        "driver": "Halis SAYAN",
        "start_mileage": "151.800",
        "end_mileage": "151.821",
        "start_date": "03.01.2026 18:03:46",
        "distance": "21",
        "end_date": "06.01.2026 08:00:00",
        "notes": "sangari"
    },
    {
        "action_type": "Periyodik Bakım",
        "add_date": "19.01.2026 15:05:29",
        "vehicle_name": "2016 TRANSİT/TOUR...",
        "plate": "34KM4969",
        "driver": "Koray BAYRAM",
        "start_mileage": "193.374",
        "end_mileage": "193.391",
        "start_date": "06.01.2026 11:10:48",
        "distance": "17",
        "end_date": "06.01.2026 12:50:00",
        "notes": "muayene"
    },
    {
        "action_type": "Kurum İçi Operasyon...",
        "add_date": "19.01.2026 15:06:38",
        "vehicle_name": "2016 TRANSİT/TOUR...",
        "plate": "34KM4969",
        "driver": "Koray BAYRAM",
        "start_mileage": "193.391",
        "end_mileage": "193.394",
        "start_date": "06.01.2026 14:30:12",
        "distance": "3",
        "end_date": "06.01.2026 15:10:00",
        "notes": "banka"
    },
    {
        "action_type": "Diğer",
        "add_date": "19.01.2026 15:12:16",
        "vehicle_name": "RENAULT 2016 CLIO",
        "plate": "34EZS794",
        "driver": "Seda K.",
        "start_mileage": "151.821",
        "end_mileage": "152.174",
        "start_date": "06.01.2026 10:00:50",
        "distance": "353",
        "end_date": "06.01.2026 21:05:00",
        "notes": ""
    }
]

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
        return jsonify({"success": False, "message": "Hatalı Kullanıcı Adı veya Şifre!"}), 401

@app.route('/api/plates', methods=['GET'])
def get_plates():
    return jsonify({"success": True, "plates": list(VEHICLES_DB.keys())}), 200

@app.route('/api/record', methods=['POST'])
def save_record():
    """
    Araç Alma (Pickup) -> ACTIVE_TRIPS'e kaydeder.
    Teslim Etme (Dropoff) -> ACTIVE_TRIPS'ten alır, birleştirir ve RECORDS_DB'ye yazar.
    """
    data = request.get_json()
    
    plate = data.get('plate')
    action = data.get('action') # 'pickup' veya 'dropoff'
    action_type = data.get('action_type', 'Diğer') # Hareket tipi (Periyodik Bakım vb.)
    mileage = data.get('mileage', "0")
    user = data.get('user')
    notes = data.get('notes', '')
    
    if not plate or not action or not user:
        return jsonify({"success": False, "message": "Eksik veri gönderildi."}), 400
        
    vehicle_name = VEHICLES_DB.get(plate, "Bilinmeyen Araç")
    now_str = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
    
    if action == 'pickup':
        # Araç Alma - Süreci başlat
        ACTIVE_TRIPS[plate] = {
            "start_mileage": mileage,
            "start_date": now_str,
            "driver": user,
            "action_type": action_type,
            "notes": notes
        }
        return jsonify({"success": True, "message": f"{plate} için Araç Alma kaydedildi. (Başlangıç KM: {mileage})"}), 201
        
    elif action == 'dropoff':
        # Teslim Etme - Süreci bitir ve birleştir
        if plate not in ACTIVE_TRIPS:
            # Eğer daha önce 'Araç Alma' yapılmadan 'Teslim Etme' yapıldıysa
            # varsayılan bir başlangıç uydur veya hata ver. Biz kayıt oluşturacağız.
            start_mileage = mileage
            start_date = now_str
            driver = user
            act_type = action_type
            n = notes
        else:
            trip = ACTIVE_TRIPS.pop(plate)
            start_mileage = trip['start_mileage']
            start_date = trip['start_date']
            driver = trip['driver'] # Aracı ilk alan kişiyi mi yoksa teslim edeni mi baz alalım? İlk alanı alalım.
            act_type = trip['action_type'] if trip['action_type'] != 'Diğer' else action_type
            n = trip['notes'] + (" | " + notes if notes else "")
        
        try:
            dist = float(mileage) - float(start_mileage)
            if dist < 0: dist = 0
        except:
            dist = 0
            
        record = {
            "action_type": act_type,
            "add_date": now_str,
            "vehicle_name": vehicle_name,
            "plate": plate,
            "driver": driver,
            "start_mileage": str(start_mileage),
            "end_mileage": str(mileage),
            "start_date": start_date,
            "distance": str(dist),
            "end_date": now_str,
            "notes": n.strip(" | ")
        }
        
        RECORDS_DB.append(record)
        return jsonify({"success": True, "message": f"{plate} işlemi tamamlandı. (Yapılan KM: {dist})"}), 201
        
    return jsonify({"success": False, "message": "Geçersiz işlem."}), 400

@app.route('/api/reports/recent', methods=['GET'])
def get_recent_reports():
    sorted_records = list(reversed(RECORDS_DB))
    return jsonify({"success": True, "records": sorted_records}), 200

@app.route('/api/reports/plate/<plate>', methods=['GET'])
def get_plate_reports(plate):
    filtered_records = [r for r in RECORDS_DB if r['plate'] == plate]
    sorted_records = list(reversed(filtered_records))
    return jsonify({"success": True, "records": sorted_records}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
