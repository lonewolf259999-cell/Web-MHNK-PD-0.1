/* TEMP DEBUG - เก็บเหตุการณ์ของขั้นตอนเชื่อมต่อ Discord แบบเรียวไทม์ (หน่วยความจำเซิร์ฟ) */
// ใช้ชั่วคราวขณะแก้ปัญหา OAuth บน Inwcloud เท่านั้น — ใช้เสร็จให้ลบทั้งหมด
const store = [];
const CAP = 300;

function add(event) {
    store.push({ t: Date.now(), ...event });
    if (store.length > CAP) store.shift();
}
function get() {
    return store.slice();
}
function clear() {
    store.length = 0;
}

module.exports = { add, get, clear };
