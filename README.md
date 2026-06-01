# MHNK Police Department Web System

ระบบจัดการข้อมูลเจ้าหน้าที่ตำรวจ สรุปยอดเงินรายสัปดาห์ และตารางเวร เชื่อมต่อกับ Google Sheets API

## การตั้งค่าบน Render.com

เมื่อ Deploy บน Render ให้ตั้งค่า **Environment Variables** ดังนี้:

1.  `SHEET_ID`: ID ของ Google Sheet หลัก (ที่มีหน้า NamePD)
2.  `CASES_SHEET_ID`: ID ของ Google Sheet ที่ใช้เก็บข้อมูลเคสและยอดเงิน
3.  `ADMIN_PIN`: รหัสผ่านสำหรับยืนยันการจ่ายเงิน (เช่น `1234`)
4.  `GOOGLE_APPLICATION_CREDENTIALS`: ใส่ค่าเป็น `credentials.json`
5.  **Secret Files**: อัปโหลดไฟล์ `credentials.json` ผ่านเมนู Secret Files ของ Render
5.  `NODE_VERSION`: `18.0.0` หรือสูงกว่า

## คำสั่งสำหรับพัฒนา

```bash
# ติดตั้ง dependencies
npm install

# รันเซิร์ฟเวอร์ (Development)
npm run dev

# รันเซิร์ฟเวอร์ (Production)
npm start
```

*หมายเหตุ: อย่าลืมแชร์สิทธิ์การแก้ไข (Editor) ใน Google Sheets ให้กับอีเมลของ Service Account ด้วย*