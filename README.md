# MHNK Police Department Web System

ระบบจัดการข้อมูลเจ้าหน้าที่ตำรวจ สรุปยอดเงินรายสัปดาห์ ตารางเวร สมัครตำรวจ และบันทึกการคุมสอบ เชื่อมต่อกับ Google Sheets API และ Discord Webhook

---

## ⚙️ Environment Variables (.env)

สร้างไฟล์ `.env` ใน root directory และใส่ค่าต่อไปนี้:

| ตัวแปร | คำอธิบาย | จำเป็น |
|--------|----------|--------|
| `PORT` | Port ที่ใช้รันเซิร์ฟเวอร์ (default: `3001`) | ✅ |
| `SHEET_ID` | ID ของ Google Sheet หลัก (ที่มีหน้า NamePD) | ✅ |
| `CASES_SHEET_ID` | ID ของ Google Sheet ที่ใช้เก็บเคสและยอดเงิน | ✅ |
| `RULES_SHEET_ID` | ID ของ Google Sheet ที่ใช้เก็บกฎ/ความประพฤติ/ค่าปรับ | ✅ |
| `ADMIN_PIN` | รหัส PIN สำหรับยืนยันการจ่ายเงิน (admin) | ✅ |
| `DISCORD_CLIENT_ID` | Client ID จาก Discord Developer Portal (สำหรับ OAuth Login) | ✅ |
| `DISCORD_CLIENT_SECRET` | Client Secret จาก Discord Developer Portal | ✅ |
| `DISCORD_REGISTER_WEBHOOK_URL` | Webhook URL สำหรับรับข้อมูลสมัครตำรวจ | ✅ |
| `DISCORD_PROCTOR_WEBHOOK_URL` | Webhook URL สำหรับรับข้อมูลคุมสอบ | ✅ |
| `DISCORD_COUNCIL_WEBHOOK_URL` | Webhook URL สำหรับรับข้อมูลสัญญาสตอรี | ✅ |
| `APP_URL` | URL ของเว็บ (เช่น `https://mhnk-pd.onrender.com`) | ✅ |
| `GOOGLE_JSON_KEY` | (Optional) ใส่ Google Service Account JSON key โดยตรง ถ้าไม่มีให้ใช้ไฟล์ `credentials.json` | 🔶 |

---

## 📦 Deploy บน Render.com

### ขั้นตอน

1. เชื่อมต่อ GitHub repository กับ Render
2. เลือก **Blueprint** (Render จะอ่านไฟล์ `render.yaml` อัตโนมัติ)
3. ตั้งค่า Environment Variables ใน Render Dashboard:

   | ตัวแปร | วิธีการ |
   |--------|---------|
   | `SHEET_ID`, `CASES_SHEET_ID`, `RULES_SHEET_ID`, `ADMIN_PIN` | ตั้งค่าโดยตรง |
   | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | ตั้งค่าโดยตรง |
   | `DISCORD_REGISTER_WEBHOOK_URL`, `DISCORD_PROCTOR_WEBHOOK_URL` | ตั้งค่าโดยตรง |
   | `APP_URL` | ตั้งค่าเป็น URL ที่ Render ให้ (เช่น `https://mhnk-pd.onrender.com`) |
   | `GOOGLE_JSON_KEY` | วาง JSON key ทั้งก้อน หรือใช้ Secret Files อัปโหลด `credentials.json` |
   | `NODE_VERSION` | `18.18.0` (ตั้งไว้ใน `render.yaml` แล้ว) |

4. **อย่าลืม** แชร์สิทธิ์ **Editor** ใน Google Sheets ทุกตัวให้กับ Service Account email

---

## 🧑‍💻 คำสั่งสำหรับพัฒนา

```bash
# ติดตั้ง dependencies
npm install

# รันเซิร์ฟเวอร์ (Development — มี auto-reload)
npm run dev

# รันเซิร์ฟเวอร์ (Production)
npm start
```

---

## 🗂️ โครงสร้างโปรเจค

```
mhnk-police-department/
├── server/                  # Backend (Express.js)
│   ├── index.js             # Entry point (middleware, helmet, rate limit)
│   ├── config/              # Environment config
│   ├── controllers/         # Route handlers
│   ├── middleware/           # Error handler, auth, cache headers
│   ├── routes/              # Route definitions
│   ├── services/            # Discord OAuth, Webhook, Google Sheets
│   └── utils/               # Logger
├── src/                     # Frontend (Vanilla JS SPA)
│   ├── app.js               # Main app entry
│   ├── components/          # Navigation, Search, Sidebar
│   ├── pages/               # Roster, Rules, Conduct, Fines, Schedule
│   ├── profile/             # Profile page (payment)
│   ├── styles/              # CSS
│   └── utils/               # API service, HTML helpers
├── public/                  # Static HTML files
│   ├── index.html           # Main SPA
│   ├── profile.html         # หน้าข้อมูลเจ้าหน้าที่ + จ่ายเงิน
│   ├── register.html        # หน้าสมัครตำรวจ
│   └── proctor.html         # หน้าบันทึกคุมสอบ
├── data/                    # Cache files
└── render.yaml              # Render deploy config
```

---

## 🔒 Security Features

- **Helmet.js** — Security headers (X-Frame-Options, HSTS, X-Content-Type-Options, etc.)
- **Rate Limiting** — จำกัด 100 request/นาที (ทั่วไป), 10 request/นาที (ฟอร์ม), 5 request/นาที (Discord Auth)
- **Body Size Limit** — รับ JSON body สูงสุด 6MB
- **Discord OAuth2** — ยืนยันตัวตนผู้ใช้ผ่าน Discord
- **PIN Auth** — ยืนยันตัวตน admin สำหรับจัดการข้อมูล

---

## 🔗 API Endpoints

| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/api/officers` | รายชื่อเจ้าหน้าที่ |
| GET | `/api/weeks` | รายการสัปดาห์ |
| GET | `/api/week-data` | ข้อมูลรายสัปดาห์ |
| GET | `/api/rules` | กฎระเบียบ |
| GET | `/api/conduct` | ข้อมูลความประพฤติ |
| GET | `/api/fines` | ค่าปรับ |
| GET | `/api/schedule-config` | ค่าตั้งค่าตารางเวร |
| POST | `/api/register` | สมัครตำรวจ |
| POST | `/api/proctor/submit` | บันทึกคุมสอบ |
| GET/POST/PUT/DELETE | `/api/rules-data/:type/:id` | CRUD กฎ/ความประพฤติ/ค่าปรับ |
| GET | `/auth/discord` | Discord OAuth Login |
| GET | `/auth/discord/callback` | Discord OAuth Callback |

---

## 📝 หมายเหตุ

- ระบบนี้พัฒนาสำหรับ **FiveM Server — MHNK Police Department** โดยเฉพาะ
- ใช้ Google Sheets เป็นฐานข้อมูลหลัก (ไม่ต้องมี database server)
- ใช้ Discord Webhook สำหรับรับการแจ้งเตือนการสมัครและบันทึกคุมสอบ