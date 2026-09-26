// ค่าที่ใช้ปรับสมดุลเกมทั้งหมดอยู่ที่ไฟล์นี้

// exp ของเควส = มูลค่ารางวัลรวม (1 บาท = 1 exp) ขั้นต่ำ MIN_QUEST_EXP
export const MIN_QUEST_EXP = 10;
export const questExp = (totalValue) => Math.max(MIN_QUEST_EXP, Math.round(totalValue));

export const MAX_LEVEL = 99;

// exp สะสมที่ต้องมีเพื่อถึง level นั้น: Lv1 = 0, Lv2 = 100, Lv3 = 300, Lv5 = 1,000, Lv10 = 4,500, Lv20 = 19,000
export const expForLevel = (level) => 50 * level * (level - 1);

export const levelFromExp = (exp) => {
  let level = 1;
  while (level < MAX_LEVEL && exp >= expForLevel(level + 1)) level++;
  return level;
};

// จำนวนเควสที่รับพร้อมกันได้: Lv1 = 1, Lv5 = 2, Lv10 = 3, Lv15 = 4, Lv20 ขึ้นไป = 5
export const MAX_QUEST_SLOTS = 5;
export const questSlots = (level) => Math.min(MAX_QUEST_SLOTS, 1 + Math.floor(level / 5));

export const levelInfo = (exp) => {
  const level = levelFromExp(exp);
  const isMax = level >= MAX_LEVEL;
  return {
    exp,
    level,
    currentLevelExp: expForLevel(level),
    nextLevelExp: isMax ? null : expForLevel(level + 1),
    questSlots: questSlots(level),
  };
};
