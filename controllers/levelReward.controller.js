import prisma from "../config/prisma.js";
import createError from "../utils/createError.js";
import { MAX_LEVEL, expForLevel, questSlots } from "../utils/level.js";

const SHOW_LEVELS = 30;

// GET /level-reward  ตารางเลเวล (exp ที่ต้องใช้, โควตาเควส) + รางวัลที่ตั้งไว้แต่ละเลเวล
export const getLevelRewards = async (req, res) => {
  const levelRewards = await prisma.levelReward.findMany({
    include: { reward: true },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
  });

  const lastLevel = Math.min(MAX_LEVEL, Math.max(SHOW_LEVELS, ...levelRewards.map((lr) => lr.level)));
  const levels = [];
  for (let level = 2; level <= lastLevel; level++) {
    levels.push({
      level,
      exp: expForLevel(level),
      questSlots: questSlots(level),
      rewards: levelRewards.filter((lr) => lr.level === level).map((lr) => lr.reward),
    });
  }

  res.json({ data: levels });
};

// PUT /level-reward/:level  { rewardIds: [] }  แทนที่รางวัลทั้งหมดของเลเวลนั้น
export const updateLevelRewards = async (req, res) => {
  const level = Number(req.params.level);
  if (!Number.isInteger(level) || level < 2 || level > MAX_LEVEL) createError(400, "เลเวลไม่ถูกต้อง");

  const { rewardIds } = req.body;
  const found = await prisma.reward.count({ where: { id: { in: [...new Set(rewardIds)] } } });
  if (found !== new Set(rewardIds).size) createError(400, "ไม่พบรางวัลบางรายการ");

  await prisma.$transaction([
    prisma.levelReward.deleteMany({ where: { level } }),
    prisma.levelReward.createMany({
      data: rewardIds.map((rewardId, i) => ({ level, rewardId, sortOrder: i })),
    }),
  ]);

  res.json({ message: `บันทึกรางวัล Lv.${level} เรียบร้อย` });
};
