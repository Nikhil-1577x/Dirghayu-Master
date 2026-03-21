const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
app.use(cors());

// Your Arduino connection port
const COM_PORT = 'COM3';
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

let latestData = {
  dose: 1,
  setTime: "--:--",
  currentTime: "--:--:--",
  alert: false,
  lastEvent: "NONE" // Tracks EVENT:TAKEN, EVENT:MISSED
};

/** Parse HH:MM:SS to seconds since midnight; return null if invalid. */
function parseRtc(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10), sec = parseInt(m[3], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59 || sec < 0 || sec > 59) return null;
  return h * 3600 + min * 60 + sec;
}
function formatRtc(total) {
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Tick RTC forward every second so /data returns actual live time from hardware
setInterval(() => {
  const sec = parseRtc(latestData.currentTime);
  if (sec !== null) latestData.currentTime = formatRtc((sec + 1) % 86400);
}, 1000);

function connectSerial() {
  console.log(`🔌 Attempting to connect to ${COM_PORT}...`);
  
  const port = new SerialPort({
    path: COM_PORT,
    baudRate: 9600,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  port.on('open', () => {
    console.log(`✅ Successfully connected to Arduino on ${COM_PORT}`);
  });

  parser.on('data', (data) => {
    try {
      data = data.trim();
      
      // Catch instantaneous events (MISSED / TAKEN) sent by Arduino
      if (data.startsWith("EVENT:")) {
        const eventType = data.replace("EVENT:", "");
        latestData.lastEvent = eventType;
        console.log(`📌 Arduino Event Latched: ${eventType} (Slot: ${latestData.dose})`);

        // Fetch active patient from backend (set by frontend when user selects patient)
        const activePatientUrl = `${BACKEND_URL.replace(/\/$/, '')}/iot/active-patient`;
        http.get(activePatientUrl, (getRes) => {
          let body = '';
          getRes.on('data', (chunk) => { body += chunk; });
          getRes.on('end', () => {
            if (getRes.statusCode !== 200) {
              console.log(`❌ Active patient lookup failed (HTTP ${getRes.statusCode}). Event not logged.`);
              return;
            }
            let patientId = null;
            try {
              const json = JSON.parse(body);
              patientId = parseInt(json.patient_id, 10);
            } catch (_) { /* noop */ }
            if (!patientId) {
              console.log('⚠️ No active patient selected yet. Event skipped.');
              return;
            }
            const postData = JSON.stringify({ status: eventType });
            const logUrl = `${BACKEND_URL.replace(/\/$/, '')}/iot/event/${patientId}/slot/${latestData.dose}`;
            const postReq = http.request(logUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
              }
            }, (postRes) => {
              if ((postRes.statusCode || 500) >= 200 && (postRes.statusCode || 500) < 300) {
                console.log(`💾 Saved hardware event for patient ${patientId} (HTTP ${postRes.statusCode})`);
              } else {
                let errBody = '';
                postRes.on('data', (chunk) => { errBody += chunk; });
                postRes.on('end', () => {
                  console.log(`❌ Failed to save event for patient ${patientId} (HTTP ${postRes.statusCode}) ${errBody}`);
                });
              }
            });
            postReq.on('error', (e) => {
              console.log(`❌ Failed to save to Python backend: ${e.message}`);
            });
            postReq.write(postData);
            postReq.end();
          });
        }).on('error', (e) => {
          console.log(`❌ Failed to fetch active patient: ${e.message}. Event not logged.`);
        });

        return;
      }

      if (!data || !data.includes("DOSE:")) return;

      const parts = data.split(",");
      if (parts.length < 4) return;

      const wasAlerting = latestData.alert;
      const isAlerting = parts[3].replace("ALERT:", "") === "1";

      // If a new buzzer alert just started, automatically clear out old TAKEN/MISSED states
      if (isAlerting && !wasAlerting) {
        latestData.lastEvent = "NONE";
      }

      // Update state
      latestData = {
        dose: parseInt(parts[0].replace("DOSE:", ""), 10) || 1,
        setTime: parts[1].replace("SET:", ""),
        currentTime: parts[2].replace("TIME:", ""),
        alert: isAlerting,
        lastEvent: latestData.lastEvent
      };

    } catch (err) {
      console.log("❌ Parsing error:", err.message);
    }
  });

  port.on('error', (err) => {
    console.log("❌ Serial Port Error. Plug in your Arduino.");
  });

  port.on('close', () => {
    console.log("⚠️ Arduino disconnected. Retrying in 5 seconds...");
    setTimeout(connectSerial, 5000); 
  });
}

connectSerial();

app.get('/data', (req, res) => {
  res.json(latestData);
});

const PORT = 3000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 Node.js API server running at http://127.0.0.1:${PORT}/data`);
  console.log(`📺 Listening for Arduino hardware feed...\n`);
});
