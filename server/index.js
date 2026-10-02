import express from 'express';
import mongoose from 'mongoose';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ckp_donations';

// ===== WebSocket Server =====
const wss = new WebSocketServer({ server, path: '/ws' });

// ===== MongoDB Schemas & Models =====
const donationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    donorName: { type: String, required: true },
    amount: { type: Number, required: true },
    timestamp: { type: String, required: true },
    note: { type: String, default: null },
    showPopup: { type: Boolean, default: true },
  },
  { versionKey: false }
);

const stateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
  },
  { versionKey: false }
);

const settingSchema = new mongoose.Schema(
  {
    id: { type: Number, default: 1, unique: true },
    title: { type: String, default: 'คณะผ้าป่าเพื่อการศึกษา' },
    subtitle: { type: String, default: '๓๒ ปี โรงเรียนชำฆ้อพิทยาคม จ.ระยอง' },
    soundEnabled: { type: Boolean, default: true },
    popupDurationSeconds: { type: Number, default: 5 },
    currencySymbol: { type: String, default: '฿' },
    adminPin: { type: String, default: '1234' },
    customBackgroundUrl: { type: String, default: null },
    countdownEnabled: { type: Boolean, default: true },
    countdownTargetDate: { type: String, default: '2026-10-03T12:00:00' },
    countdownTitle: { type: String, default: 'นับถอยหลังปิดรับยอด: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น.' },
  },
  { versionKey: false }
);

const Donation = mongoose.model('Donation', donationSchema);
const State = mongoose.model('State', stateSchema);
const Setting = mongoose.model('Setting', settingSchema);

// ===== Helpers =====
async function getTotal() {
  const doc = await State.findOne({ key: 'total' }).lean();
  return doc ? parseFloat(doc.value) : 0;
}

async function setTotal(val) {
  await State.findOneAndUpdate(
    { key: 'total' },
    { key: 'total', value: val.toString() },
    { upsert: true, returnDocument: 'after' }
  );
}

async function getSettings() {
  let doc = await Setting.findOne({ id: 1 }).lean();
  if (!doc) {
    doc = await Setting.create({ id: 1 });
  }
  return {
    title: doc.title,
    subtitle: doc.subtitle || undefined,
    soundEnabled: !!doc.soundEnabled,
    popupDurationSeconds: doc.popupDurationSeconds,
    currencySymbol: doc.currencySymbol,
    adminPin: doc.adminPin,
    customBackgroundUrl: doc.customBackgroundUrl || undefined,
    countdownEnabled: doc.countdownEnabled !== undefined ? !!doc.countdownEnabled : true,
    countdownTargetDate: doc.countdownTargetDate || '2026-10-03T12:00:00',
    countdownTitle: doc.countdownTitle || 'นับถอยหลังปิดรับยอด: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น.',
  };
}

async function getDonations() {
  const list = await Donation.find().sort({ timestamp: -1 }).lean();
  return list.map((item) => ({
    id: item.id,
    donorName: item.donorName,
    amount: item.amount,
    timestamp: item.timestamp,
    note: item.note || undefined,
    showPopup: !!item.showPopup,
  }));
}

async function getFullState() {
  const [total, donations, settings] = await Promise.all([
    getTotal(),
    getDonations(),
    getSettings(),
  ]);
  return { total, donations, settings };
}

// Broadcast SYNC to all connected WebSocket clients
async function broadcastSync(extra = {}) {
  try {
    const state = await getFullState();
    const msg = JSON.stringify({ type: 'SYNC', payload: state, ...extra });
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(msg);
    }
  } catch (err) {
    console.error('broadcastSync error:', err);
  }
}

// Broadcast a specific action (e.g. TRIGGER_POPUP)
function broadcastAction(action) {
  const msg = JSON.stringify(action);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// Send initial state on new WebSocket connection
wss.on('connection', async (ws) => {
  try {
    const state = await getFullState();
    ws.send(JSON.stringify({ type: 'SYNC', payload: state }));
  } catch (err) {
    console.error('Failed to send initial SYNC over ws:', err);
  }

  ws.on('error', (err) => {
    console.warn('WebSocket client socket error:', err);
  });
});

// ===== Express Middlewares =====
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '15mb' }));

// ===== API Routes =====

// GET /api/state
app.get('/api/state', async (_req, res) => {
  try {
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/donations
app.post('/api/donations', async (req, res) => {
  try {
    const { id, donorName, amount, timestamp, note, showPopup } = req.body;

    await Donation.findOneAndUpdate(
      { id },
      { id, donorName, amount, timestamp, note: note || null, showPopup: !!showPopup },
      { upsert: true, new: true }
    );

    const currentTotal = await getTotal();
    await setTotal(currentTotal + amount);

    await broadcastSync();
    if (showPopup) {
      const settings = await getSettings();
      broadcastAction({
        type: 'TRIGGER_POPUP',
        payload: { id, donorName, amount, timestamp, duration: settings.popupDurationSeconds },
      });
    }

    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/donations/:id
app.delete('/api/donations/:id', async (req, res) => {
  try {
    const doc = await Donation.findOneAndDelete({ id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const currentTotal = await getTotal();
    await setTotal(Math.max(0, currentTotal - doc.amount));

    await broadcastSync();
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/total
app.put('/api/total', async (req, res) => {
  try {
    const { total } = req.body;
    await setTotal(total);
    await broadcastSync();
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trigger-popup
app.post('/api/trigger-popup', (req, res) => {
  broadcastAction({ type: 'TRIGGER_POPUP', payload: req.body });
  res.json({ ok: true });
});

// GET /api/settings
app.get('/api/settings', async (_req, res) => {
  try {
    const s = await getSettings();
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
app.put('/api/settings', async (req, res) => {
  try {
    const s = req.body;
    await Setting.findOneAndUpdate(
      { id: 1 },
      {
        id: 1,
        title: s.title,
        subtitle: s.subtitle || null,
        soundEnabled: !!s.soundEnabled,
        popupDurationSeconds: s.popupDurationSeconds,
        currencySymbol: s.currencySymbol,
        adminPin: s.adminPin || '1234',
        customBackgroundUrl: s.customBackgroundUrl || null,
        countdownEnabled: s.countdownEnabled !== undefined ? !!s.countdownEnabled : true,
        countdownTargetDate: s.countdownTargetDate || '2026-10-03T12:00:00',
        countdownTitle: s.countdownTitle || 'นับถอยหลังปิดรับยอด: วันเสาร์ที่ ๓ ตุลาคม เวลา ๑๒:๐๐ น.',
      },
      { upsert: true, returnDocument: 'after' }
    );

    await broadcastSync();
    const updated = await getSettings();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reset
app.post('/api/reset', async (req, res) => {
  try {
    const { initialTotal = 0, initialTitle = 'คณะผ้าป่าเพื่อการศึกษา' } = req.body;

    await Donation.deleteMany({});
    await setTotal(initialTotal);
    await Setting.findOneAndUpdate(
      { id: 1 },
      { title: initialTitle },
      { upsert: true, new: true }
    );

    await broadcastSync();
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Serve Frontend in Production =====
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ===== Initial Database Seed Function =====
async function seedInitialDataIfEmpty() {
  try {
    const count = await Donation.countDocuments();
    if (count === 0) {
      console.log('🌱 Seeding initial sample donations into MongoDB...');
      const sampleDonations = [
        {
          id: 'sample-1',
          donorName: 'คุณสมชาย ใจดี',
          amount: 5000,
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          note: 'กองบุญเพื่อทุนการศึกษา',
          showPopup: true,
        },
        {
          id: 'sample-2',
          donorName: 'คุณวิภา และครอบครัวรัตนศิริ',
          amount: 10000,
          timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
          note: 'ร่วมสมทบทุนจัดซื้ออุปกรณ์การเรียน',
          showPopup: true,
        },
        {
          id: 'sample-3',
          donorName: 'ผู้ไม่ประสงค์ออกนาม',
          amount: 2500,
          timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          note: null,
          showPopup: false,
        },
        {
          id: 'sample-4',
          donorName: 'คณะศิษย์เก่า รุ่นที่ ๑๒',
          amount: 50000,
          timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
          note: 'ประธานสายผ้าป่า',
          showPopup: true,
        },
      ];

      await Donation.insertMany(sampleDonations);
      await setTotal(67500);
      await Setting.findOneAndUpdate(
        { id: 1 },
        {
          id: 1,
          title: 'คณะผ้าป่าเพื่อการศึกษา',
          subtitle: '๓๒ ปี โรงเรียนชำฆ้อพิทยาคม จ.ระยอง',
          soundEnabled: true,
          popupDurationSeconds: 5,
          currencySymbol: '฿',
          adminPin: '1234',
        },
        { upsert: true }
      );
      console.log('✅ Initial data seeded successfully (฿67,500 with 4 items)');
    }
  } catch (err) {
    console.error('Seeding error:', err);
  }
}

// ===== Start Server and Connect DB =====
async function start() {
  try {
    console.log(`🔌 Connecting to MongoDB: ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log('✅ Connected to MongoDB successfully');

    await seedInitialDataIfEmpty();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 CKP Donation Server with MongoDB`);
      console.log(`   🌐 http://0.0.0.0:${PORT}`);
      console.log(`   🍃 Database: ${mongoose.connection.name}`);
      console.log(`   📡 WebSocket: ws://0.0.0.0:${PORT}/ws\n`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    console.log('⚠️ Running HTTP server without DB connection (will retry)...');
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });
  }
}

start();
