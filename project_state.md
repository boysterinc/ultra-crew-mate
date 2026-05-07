# 🏁 AutoLap Scanner: Project State

## 🏗️ Architecture Summary
- **Stack:** Next.js (React), Zustand (State Management), Web Bluetooth API.
- **Core Logic:** สแกน RSSI จาก Bluetooth LE เพื่อหาจุด Peak (Checkpoint) และนับรอบอัตโนมัติ
- **Platform:** เน้นใช้งานบน Tablet (Chrome/Bluefy)

## 🌟 Feature List
- [x] Device Mapping (ผูกชื่ออุปกรณ์กับนักกีฬา)
- [x] Real-time RSSI Scanning & Peak Detection
- [x] Web Bluetooth Watchdog (ระบบกู้คืนเมื่อสแกนหลุด)
- [x] Screen Wake Lock (ป้องกันจอหลับ)
- [x] **Silent Heartbeat (ระบบยึดท่อเสียง Bluetooth Speaker)** <- *อัปเดตล่าสุด*
- [ ] Event Dashboard (ระบบแยกกลุ่มงานวิ่งตามเวลา/ระยะทาง) - *กำลังพัฒนา*

## 🛠️ Current Tech Stack & Files
- `src/lib/store.ts`: หัวใจการเก็บข้อมูล นักกีฬา, รอบวิ่ง, และ Event
- `src/lib/autoLapScanner.ts`: ควบคุมบลูทูธและ Audio Heartbeat
- `src/lib/rssiTracker.ts`: อัลกอริทึมคำนวณคลื่นสัญญาณ (กำลังรออ่านไฟล์นี้)

## 🐞 Known Bugs / Pending Issues
1. **Audio Routing:** เสียงชอบออกลำโพงเครื่องมากกว่าลำโพงบลูทูธ (แก้ไขเบื้องต้นด้วย Silent Heartbeat แล้ว รอผลทดสอบ)
2. **Event Selection:** นักกีฬายังไม่ได้ถูกแยกตาม Event งานวิ่ง

## 📝 Current TODO (ลำดับถัดไป)
1. **Analyze RSSI Tracker:** ตรวจสอบความแม่นยำของอัลกอริทึมใน `rssiTracker.ts`
2. **Event-Driven Development:** เพิ่มหน้า Setting เพื่อสร้าง Event และให้นักกีฬาเลือกสังกัด
