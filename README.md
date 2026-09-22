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

## ▲ Deploy บน Vercel

Vercel ตรวจจับ Next.js ให้อัตโนมัติ ไม่ต้องตั้งค่า Build Command / Output Directory / `vercel.json` ใดๆ

### ขั้นตอน

1. Import repository เข้า Vercel (New Project → เลือก repo นี้)
2. **Framework Preset** ต้องขึ้นเป็น **Next.js** และ **Root Directory** ต้องเว้นว่าง (repo root)
3. ตั้งค่า Environment Variables ใน Vercel Dashboard ให้ครบตามหัวข้อ [Environment Variables](#️-environment-variables-env) ด้านบน
4. `APP_URL` ให้ตั้งเป็นโดเมนจริง (เช่น `https://mhnk-pd.online`)
5. Deploy

> **หมายเหตุ:** memory cache อยู่ใน instance เดียวเท่านั้น — serverless ไม่มี disk ที่เขียนร่วมกันได้ file cache เดิมจึงถูกตัดออก

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

Stack: **Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Elysia**

```
mhnk-police-department/
├── app/                      # Next.js App Router
│   ├── api/[[...slugs]]/     # Elysia mounted as one catch-all function
│   ├── layout.tsx            # Root layout (fonts, background effects)
│   ├── page.tsx              # Main SPA
│   └── globals.css           # Tailwind v4 @theme design tokens
├── server/                   # Elysia backend (TypeScript)
│   ├── app.ts                # Root instance + error handling; exports type Api
│   ├── config.ts             # Environment configuration
│   ├── errors.ts             # ApiError + admin PIN guard
│   ├── routes/               # roster, rules, admin, poi
│   └── services/             # Google Sheets, cache, CSV, auth, payment store
├── components/               # React components
│   ├── ui/                   # Loading, empty and error states
│   └── views/                # Roster, Cases, Rules, Fines, Schedule
├── lib/                      # Shared code
│   ├── client/               # Eden typed client, queries, fetch hook
│   ├── types.ts              # Data models
│   ├── format.ts             # Ranks, currency, grouping, search
│   └── sanitize.ts           # Allowlist sanitizer for Sheets rich text
├── public/                   # Static assets served at /
│   ├── logo.gif, vs.png
│   └── map-module/           # Leaflet map + Challenge game (still vanilla)
├── data/                     # schedule.json, poi-cache.json
└── legacy/                   # v2 code, kept for reference during the port
    ├── express/              # Old Express backend
    ├── html/                 # Old HTML pages
    ├── src/                  # Old vanilla JS/CSS frontend
    ├── map-module-server/    # Old POI routes
    └── deploy/               # Old vercel.json / render.yaml / serverless entry
```

### Why Elysia behind Next.js

Elysia is normally a Bun framework, but Vercel's serverless runtime is Node. It
is mounted through `api.handle(request)` instead of `.listen()` — Elysia and
Next route handlers both speak the standard `Request`/`Response` pair, so no Bun
runtime is required and the whole app still deploys as one Next.js project.

The payoff is **Eden Treaty**: `lib/client/eden.ts` derives a fully typed client
from the server's `Api` type, so routes, params and response shapes are checked
at compile time. Renaming a route breaks the build instead of 404-ing in
production. Request bodies and query strings are validated by Elysia's schemas
before reaching handler code.

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