# Resmi hafif Python imajını kullan
FROM python:3.11-slim

# Çalışma dizinini ayarla
WORKDIR /app

# PDF raporlarında Türkçe karakter desteği için Unicode yazı tipi.
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Bağımlılık dosyasını kopyala ve kur
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Proje dosyalarını kopyala
COPY . .

# Flask ve Gunicorn için environment değişkenleri
ENV FLASK_APP=app.py
ENV PORT=5000

# Dışarıya açılacak port (Cloud Run için genellikle 8080 veya PORT env variable kullanılır)
EXPOSE 5000

# Gunicorn ile production sunucusunu başlat
# --bind 0.0.0.0:$PORT -> Cloud platformlarının atadığı dinamik portu dinler (Varsayılan 5000)
CMD exec gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 1 --threads 8 --timeout 0 app:app
