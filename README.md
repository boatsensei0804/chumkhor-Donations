# ระบบแสดงผลยอดเงินบริจาค ผ้าป่าเพื่อการศึกษา (CKP 2026)
### โรงเรียนชำฆ้อพิทยาคม จ.ระยอง (ครบรอบ ๓๒ ปี)

ระบบเว็บแอปพลิเคชันสำหรับแสดงผลยอดบริจาคผ้าป่าเพื่อการศึกษา รองรับการทำงานแบบ Full-stack ด้วย **React + TypeScript + Tailwind CSS + Node.js Express + MongoDB** และเชื่อมต่อแบบ Real-time ด้วย **WebSocket** ทำงานบน **Docker & Docker Compose**

---

## 🚀 การรันระบบด้วย Docker (แนะนำ)

### เริ่มต้นรันระบบ
```bash
docker compose up -d
```
*(กรณีแก้ไขโค้ดและต้องการ build ใหม่ ให้ใช้ `docker compose up --build -d`)*

### หยุดการทำงาน
```bash
docker compose down
```

### ดูบันทึกการทำงาน (Logs)
```bash
# ดู log ทั้งหมด
docker compose logs -f

# ดูเฉพาะ log ของ App
docker compose logs -f app

# ดูเฉพาะ log ของ MongoDB
docker compose logs -f mongodb
```

---

## 🌐 ลิงก์เข้าใช้งาน

| ส่วนการทำงาน | URL | รายละเอียด |
| :--- | :--- | :--- |
| **🖥️ จอแสดงผล (Display)** | `http://localhost:5173/?screen=display` หรือ `http://<IP-เครื่อง>:5173/?screen=display` | สำหรับฉายขึ้นจอโปรเจกเตอร์ มียอดรวม, เอฟเฟกต์พลุ, แจ้งเตือน Popup และรายชื่อวิ่ง |
| **⚙️ หน้าแอดมิน (Admin)** | `http://localhost:5173/?screen=admin` หรือ `http://<IP-เครื่อง>:5173/?screen=admin` | สำหรับเจ้าหน้าที่กรอกยอดบริจาค (PIN เริ่มต้น: `1234`) |
| **🍃 MongoDB Server** | `mongodb://localhost:27017/ckp_donations` | สำหรับเชื่อมต่อผ่าน MongoDB Compass หรือเครื่องมือจัดการฐานข้อมูล |

*(หมายเหตุ: สามารถเข้าใช้งานผ่านพอร์ต `3000` ได้เช่นกัน เช่น `http://localhost:3000/`)*

---

## 🏗️ โครงสร้างระบบ (Architecture)

```
├── Dockerfile              # Multi-stage Docker build (Vite frontend -> Node.js runner)
├── docker-compose.yml      # กำหนด service ckp_app และ ckp_mongodb
├── server/
│   └── index.js            # Node.js Express API + WebSocket Server + Mongoose Models
├── src/                    # Frontend React + TypeScript
│   ├── components/         # หน้าจอ Display, Admin, Popup, Ticker, Background
│   ├── utils/              # API Client, WebSocket Channel, Sound, Confetti
│   └── types/              # TypeScript Types
├── public/                 # รูปภาพพื้นหลัง HD
└── package.json            # Dependencies & Scripts
```

---

## 🍃 ฐานข้อมูล MongoDB

- ฐานข้อมูลชื่อ: `ckp_donations`
- Volume เก็บข้อมูล: `ckp_mongodb_data` (ข้อมูลไม่สูญหายเมื่อหยุดคอนเทนเนอร์)
- **Collections:**
  - `donations`: จัดเก็บรายการบริจาคทั้งหมด (ชื่อผู้บริจาค, จำนวนเงิน, วันเวลา, หมายเหตุ)
  - `states`: จัดเก็บยอดรวมสุทธิ (`total`)
  - `settings`: จัดเก็บการตั้งค่าระบบ (ชื่องาน, ระยะเวลา Popup, เสียง, PIN)
