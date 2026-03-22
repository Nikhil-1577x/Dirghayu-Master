```
$$$$$$$\  $$$$$$\ $$$$$$$\   $$$$$$\  $$\   $$\  $$$$$$\ $$\     $$\ $$\   $$\ 
$$  __$$\ \_$$  _|$$  __$$\ $$  __$$\ $$ |  $$ |$$  __$$\\$$\   $$  |$$ |  $$ |
$$ |  $$ |  $$ |  $$ |  $$ |$$ /  \__|$$ |  $$ |$$ /  $$ |\$$\ $$  / $$ |  $$ |
$$ |  $$ |  $$ |  $$$$$$$  |$$ |$$$$\ $$$$$$$$ |$$$$$$$$ | \$$$$  /  $$ |  $$ |
$$ |  $$ |  $$ |  $$  __$$< $$ |\_$$ |$$  __$$ |$$  __$$ |  \$$  /   $$ |  $$ |
$$ |  $$ |  $$ |  $$ |  $$ |$$ |  $$ |$$ |  $$ |$$ |  $$ |   $$ |    $$ |  $$ |
$$$$$$$  |$$$$$$\ $$ |  $$ |\$$$$$$  |$$ |  $$ |$$ |  $$ |   $$ |    \$$$$$$  |
\_______/ \______|\__|  \__| \______/ \__|  \__|\__|  \__|   \__|     \______/ 
```

# 🏥 Smart Healthcare Monitoring System

A full-stack intelligent healthcare platform that integrates **AI-based risk prediction**, **OCR-driven biomarker extraction**, and **IoT-enabled medication tracking** to provide real-time patient monitoring and clinical insights.

---

## 🚀 Features

### 🧠 AI Risk Prediction Engine
- Combines:
  - LSTM-based time-series prediction
  - Clinical risk scoring (QRISK-style logic)
  - Behavioral pattern analysis
- Generates real-time patient risk scores
- Detects early deterioration signals

---

### 📄 OCR-Based Report Processing
- Upload lab reports (images/PDFs)
- Automatically extracts:
  - Glucose (fasting/random)
  - HbA1c
  - Blood Pressure
- Features:
  - Multi-rotation OCR
  - Smart regex parsing
  - Noise-tolerant numeric extraction

---

### 📊 Patient Dashboard
- Biomarker trends (graphs)
- Risk visualization
- Behavioral alerts
- Medication adherence insights
- Deterioration signals

---

### 💊 IoT Integration (Hardware-Ready)
- Smart medication dispenser support
- Tracks:
  - Dose taken / missed
  - Hardware alerts (buzzer, etc.)
- MQTT-based communication
- Designed for cloud + edge interaction

---

### 🧾 PDF Patient Summary
Auto-generated report including:
- Health summary
- 1-month biomarker trends
- Medication adherence rate
- Behavioral anomalies (timestamped)
- Risk & deterioration signals

---

### 💬 Real-Time Communication
- WebSocket-based chat:
  - Doctor ↔ Caretaker
  - Doctor ↔ CHO
- Live updates and alerts

---

### 📲 SMS Alerts
- Integrated with Twilio
- Sends alerts for:
  - Missed medication
  - Critical risk detection

---

## 🏗️ Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- Charting libraries

### Backend
- FastAPI
- WebSockets
- MQTT integration

### Database
- PostgreSQL (Render)

### AI/ML
- LSTM (time-series prediction)
- Rule-based behavioral analysis
- Clinical scoring logic

### IoT
- Arduino / ESP devices
- MQTT protocol (HiveMQ / public broker)

### Integrations
- Twilio (SMS)
- OCR Engine (Tesseract or equivalent)

---

## ⚙️ Architecture

IoT Device (Dispenser)
↓ (MQTT)
MQTT Broker
↓
Backend (FastAPI)
├── OCR Engine
├── Risk Engine (LSTM + Rules)
├── Alert System
↓
PostgreSQL Database
↓
WebSocket/API Layer
↓
Frontend Dashboard

---

## 🌐 Deployment

### Backend (Render)
- Python FastAPI service
- Connected to PostgreSQL

### Frontend (Vercel)
- React app

---

## 🔑 Environment Variables

### Backend (.env)
DATABASE_URL=your_postgres_url
ENABLE_IOT=false
MQTT_BROKER=broker.hivemq.com
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token

### Frontend (.env)
VITE_API_BASE_URL=https://your-backend-url

---

## 🧪 Run Locally

### Backend
cd Backend
pip install -r requirements.txt
uvicorn app.main:app --reload

### Frontend
cd Frontend
npm install
npm run dev

---

## 🧠 How It Works

1. Data Collection
   - OCR extracts biomarkers
   - IoT sends medication data

2. Processing
   - Stored in PostgreSQL
   - Feature engineering applied

3. Risk Analysis
   - LSTM predicts future risk
   - Clinical model evaluates baseline
   - Behavioral engine detects anomalies

4. Output
   - Dashboard updates
   - Alerts triggered
   - PDF summaries generated

---

## 🔒 IoT Mode

ENABLE_IOT=true   → Full hardware integration  
ENABLE_IOT=false  → Cloud-only mode  

---

## 📈 Future Improvements

- Personalized LSTM models
- Explainable AI
- Private MQTT broker
- ABHA integration
- Advanced anomaly detection
- Mobile app support

---

## 🎯 Use Cases

- Remote patient monitoring
- Chronic disease management
- Rural healthcare systems
- Preventive analytics

---

## 👨‍⚕️ Users

- Doctors
- CHOs
- Caretakers
- Patients

---

## 🧾 License

Academic and research use only.  
Production healthcare deployment requires compliance.

---

## 💡 One-Line Summary

An AI-powered healthcare platform combining OCR, IoT, and predictive analytics to monitor and prevent patient health deterioration in real time.
