// เควสประจำวันตัดรอบตามเวลาไทย (UTC+7) ไม่ขึ้นกับ timezone ของเซิร์ฟเวอร์
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

export const MAIN_PERIOD = "MAIN";

// "YYYY-MM-DD" ของวันนี้ตามเวลาไทย
export const todayKey = (now = new Date()) =>
  new Date(now.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);

// เที่ยงคืนของวันถัดไป (เวลาไทย) = เวลาหมดอายุของเควสประจำวันที่รับวันนี้
export const endOfToday = (now = new Date()) =>
  new Date(Date.parse(`${todayKey(now)}T00:00:00Z`) + 24 * 60 * 60 * 1000 - TZ_OFFSET_MS);

export const periodKeyOf = (quest) => (quest.type === "DAILY" ? todayKey() : MAIN_PERIOD);

// รอบนี้หมดอายุเมื่อไร: เควสประจำวัน = จบวัน (หรือวันหมดอายุเควสถ้ามาก่อน), เควสหลัก = วันหมดอายุเควส
export const runExpiresAt = (quest) => {
  const questEnd = quest.expiresAt ? new Date(quest.expiresAt) : null;
  if (quest.type !== "DAILY") return questEnd;
  const dayEnd = endOfToday();
  return questEnd && questEnd < dayEnd ? questEnd : dayEnd;
};
