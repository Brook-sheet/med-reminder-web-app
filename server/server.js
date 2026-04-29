/* eslint-disable @typescript-eslint/no-require-imports */
// server.js
// Standalone Express backend for ESP32 pill dispenser
// Place this file in your project ROOT directory
// Run with: node server.js
//
// ESP32 connects to:
//   POST http://<your-ip>:3001        → pill taken/missed event
//   GET  http://<your-ip>:3001/sched  → fetch alarm schedule
//
// Required env vars (add to .env.local or set manually):
//   MONGODB_URI
//   SENSOR_API_KEY          (optional, only enforced in production)
//   DEFAULT_DEVICE_USER_ID  (MongoDB ObjectId of the user this device belongs to)

const http = require('http');
const mongoose = require('mongoose');

// ── Inline env loading (reads .env.local) ──────────────────────────────────
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.warn('[ENV] .env.local not found, using process.env only');
    return;
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
  console.log('[ENV] Loaded .env.local');
}
loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;
const SENSOR_API_KEY = process.env.SENSOR_API_KEY || 'dev-sensor-key-change-me';
const DEFAULT_USER_ID = process.env.DEFAULT_DEVICE_USER_ID || null;
const PORT = 3001;

if (!MONGODB_URI) {
  console.error('[FATAL] MONGODB_URI is not set. Exiting.');
  process.exit(1);
}

// ── Mongoose Schemas ───────────────────────────────────────────────────────

const MedicineSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  dosage: String,
  frequency: String,
  scheduledTimes: [String],
  notes: { type: String, default: '' },
  startDate: String,
  endDate: { type: String, default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const MedicationLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
  medicineName: String,
  dosage: { type: String, default: '' },
  scheduledTime: String,
  scheduledDate: String,
  takenAt: { type: Date, default: null },
  status: { type: String, enum: ['taken', 'missed', 'pending', 'reminder'], default: 'pending' },
  source: { type: String, enum: ['manual', 'sensor', 'auto'], default: 'auto' },
  sensorDeviceId: { type: String, default: null },
}, { timestamps: true });

const SensorDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, default: null },
  deviceId: { type: String, required: true },
  event: { type: String, enum: ['pill_taken', 'pill_dispensed', 'container_opened', 'heartbeat'] },
  medicineId: { type: mongoose.Schema.Types.ObjectId, default: null },
  medicineName: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
  rawData: { type: mongoose.Schema.Types.Mixed, default: {} },
  processed: { type: Boolean, default: false },
}, { timestamps: true });

const Medicine       = mongoose.models.Medicine       || mongoose.model('Medicine',       MedicineSchema);
const MedicationLog  = mongoose.models.MedicationLog  || mongoose.model('MedicationLog',  MedicationLogSchema);
const SensorData     = mongoose.models.SensorData     || mongoose.model('SensorData',     SensorDataSchema);

// ── Connect to MongoDB ─────────────────────────────────────────────────────
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log('[MongoDB] Connected');
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** "HH:MM" → minutes since midnight, or -1 on error */
function hhmmToMinutes(t) {
  const m = String(t).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return -1;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

/** "8:00 AM" / "08:30 PM" / "08:00" → minutes since midnight */
function scheduledTimeToMinutes(t) {
  const ampm = String(t).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const min = parseInt(ampm[2]);
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }
  return hhmmToMinutes(t);
}

/** "8:00 AM" / "08:30 PM" / "08:00" → { hour, minute } or null */
function parseTime(t) {
  const ampm = String(t).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    if (ampm[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return { hour: h, minute: m };
  }
  const plain = String(t).match(/^(\d{1,2}):(\d{2})$/);
  if (plain) return { hour: parseInt(plain[1]), minute: parseInt(plain[2]) };
  return null;
}

function isAuthorized(req) {
  // In development, allow all requests (easy testing without headers)
  if (process.env.NODE_ENV !== 'production') return true;
  const key = req.headers['x-api-key'] || req.headers['x-sensor-key'];
  return key === SENSOR_API_KEY;
}

/** Read full request body as JSON */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

/** Send JSON response */
function sendJSON(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

// ── Route: GET /sched ──────────────────────────────────────────────────────
// ESP32 fetchSchedule() reads: obj["hour"] and obj["minute"]
async function handleGetSched(req, res) {
  try {
    await connectDB();

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const userId = url.searchParams.get('userId') || DEFAULT_USER_ID;
    const today = new Date().toISOString().split('T')[0];

    const query = { isActive: true };
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.userId = new mongoose.Types.ObjectId(userId);
      query.$or = [
        { startDate: { $lte: today }, endDate: null },
        { startDate: { $lte: today }, endDate: { $gte: today } },
        { startDate: { $exists: false } },
      ];
    }

    const medicines = await Medicine.find(query);

    const alarms = [];
    for (const med of medicines) {
      for (const timeStr of med.scheduledTimes) {
        const parsed = parseTime(timeStr);
        if (parsed) {
          alarms.push({
            hour: parsed.hour,
            minute: parsed.minute,
            medicineId: med._id.toString(),
            medicineName: med.name,
            dosage: med.dosage,
          });
        }
      }
    }

    // Sort ascending by time
    alarms.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));

    // Deduplicate by exact hour:minute
    const seen = new Set();
    const deduplicated = alarms.filter(a => {
      const key = `${a.hour}:${a.minute}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[GET /sched] Returning ${deduplicated.length} alarm(s) for userId=${userId || 'ALL'}`);
    sendJSON(res, 200, deduplicated);
  } catch (err) {
    console.error('[GET /sched]', err);
    sendJSON(res, 500, { error: 'Internal server error' });
  }
}

// ── Route: POST / ──────────────────────────────────────────────────────────
// ESP32 sendToServer() payload:
// { device_id, status: "taken"|"missed", time: "HH:MM", alarmIndex: 0 }
async function handlePostEvent(req, res) {
  try {
    await connectDB();

    let body;
    try { body = await readBody(req); }
    catch { return sendJSON(res, 400, { error: 'Invalid JSON body' }); }

    const { device_id, status, time, snooze, alarmIndex } = body;

    // Validate
    if (!status || !time) {
      return sendJSON(res, 400, { error: 'status and time are required' });
    }
    if (!['taken', 'missed'].includes(status)) {
      return sendJSON(res, 400, { error: 'status must be "taken" or "missed"' });
    }
    const eventMinutes = hhmmToMinutes(time);
    if (eventMinutes < 0) {
      return sendJSON(res, 400, { error: 'time must be in HH:MM format' });
    }

    const deviceId = device_id || 'esp32-pillbox';
    const today = new Date().toISOString().split('T')[0];

    console.log(`[POST /] Event: device=${deviceId} status=${status} time=${time} alarmIndex=${alarmIndex}`);

    // Save raw sensor record
    const sensorRecord = await SensorData.create({
      deviceId,
      event: status === 'taken' ? 'pill_taken' : 'pill_dispensed',
      timestamp: new Date(),
      rawData: { status, time, snooze, alarmIndex },
      processed: false,
    });

    // ── Strategy A: time-window match (±90 min) ──────────────────────────
    const logQuery = {
      scheduledDate: today,
      status: { $in: ['pending', 'reminder'] },
    };
    if (DEFAULT_USER_ID && mongoose.Types.ObjectId.isValid(DEFAULT_USER_ID)) {
      logQuery.userId = new mongoose.Types.ObjectId(DEFAULT_USER_ID);
    }

    const pendingLogs = await MedicationLog.find(logQuery);

    let targetLog = null;
    let minDiff = Infinity;

    for (const log of pendingLogs) {
      const diff = Math.abs(scheduledTimeToMinutes(log.scheduledTime) - eventMinutes);
      if (diff < minDiff && diff <= 90) {
        minDiff = diff;
        targetLog = log;
      }
    }

    // ── Strategy B: alarmIndex fallback ──────────────────────────────────
    if (!targetLog && alarmIndex != null && alarmIndex >= 0) {
      const medQuery = { isActive: true };
      if (DEFAULT_USER_ID && mongoose.Types.ObjectId.isValid(DEFAULT_USER_ID)) {
        medQuery.userId = new mongoose.Types.ObjectId(DEFAULT_USER_ID);
      }
      const medicines = await Medicine.find(medQuery).sort({ createdAt: 1 });

      const allAlarms = [];
      for (const med of medicines) {
        for (const t of med.scheduledTimes) {
          allAlarms.push({ medicineId: med._id.toString(), time: t });
        }
      }
      allAlarms.sort((a, b) => scheduledTimeToMinutes(a.time) - scheduledTimeToMinutes(b.time));

      if (alarmIndex < allAlarms.length) {
        const alarm = allAlarms[alarmIndex];
        const logQ = {
          scheduledDate: today,
          status: { $in: ['pending', 'reminder'] },
        };
        if (mongoose.Types.ObjectId.isValid(alarm.medicineId)) {
          logQ.medicineId = new mongoose.Types.ObjectId(alarm.medicineId);
        }
        targetLog = await MedicationLog.findOne(logQ);
      }
    }

    // ── Update log ────────────────────────────────────────────────────────
    if (targetLog) {
      await MedicationLog.findByIdAndUpdate(targetLog._id, {
        status: status === 'taken' ? 'taken' : 'missed',
        takenAt: status === 'taken' ? new Date() : null,
        source: 'sensor',
        sensorDeviceId: deviceId,
      });

      await SensorData.findByIdAndUpdate(sensorRecord._id, {
        processed: true,
        medicineId: targetLog.medicineId,
      });

      console.log(`[POST /] ✓ ${targetLog.medicineName} → ${status}${snooze ? ` (after ${snooze} snooze(s))` : ''}`);

      return sendJSON(res, 200, {
        success: true,
        message: `Pill ${status} recorded`,
        data: {
          medicineName: targetLog.medicineName,
          scheduledTime: targetLog.scheduledTime,
          status,
          snoozeCount: snooze || 0,
          logId: targetLog._id,
        },
      });
    }

    // No matching log found — still stored raw event
    console.warn(`[POST /] No matching pending log for time=${time}`);
    return sendJSON(res, 200, {
      success: true,
      message: 'Event recorded (no matching schedule found for today)',
      data: { deviceId, status, time, alarmIndex },
    });

  } catch (err) {
    console.error('[POST /]', err);
    sendJSON(res, 500, { error: 'Internal server error' });
  }
}

// ── HTTP Server ────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-sensor-key',
    });
    return res.end();
  }

  // Auth check
  if (!isAuthorized(req)) {
    return sendJSON(res, 401, { error: 'Unauthorized' });
  }

  // Route: GET /sched
  if (req.method === 'GET' && urlPath === '/sched') {
    return handleGetSched(req, res);
  }

  // Route: GET / (health check)
  if (req.method === 'GET' && urlPath === '/') {
    return sendJSON(res, 200, {
      success: true,
      message: 'ESP32 hardware server is online',
      timestamp: new Date().toISOString(),
    });
  }

  // Route: POST / (pill event)
  if (req.method === 'POST' && urlPath === '/') {
    return handlePostEvent(req, res);
  }

  // 404
  sendJSON(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   ESP32 Hardware Server                  ║`);
  console.log(`╠══════════════════════════════════════════╣`);
  console.log(`║  Listening on  http://0.0.0.0:${PORT}       ║`);
  console.log(`║  POST /        → pill event              ║`);
  console.log(`║  GET  /sched   → alarm schedule          ║`);
  console.log(`║  GET  /        → health check            ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  if (DEFAULT_USER_ID) {
    console.log(`[CONFIG] DEFAULT_DEVICE_USER_ID = ${DEFAULT_USER_ID}`);
  } else {
    console.warn('[CONFIG] DEFAULT_DEVICE_USER_ID not set — matching against ALL users');
  }
});

server.on('error', err => {
  console.error('[Server Error]', err);
  process.exit(1);
});