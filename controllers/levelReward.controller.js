import prisma from "../config/prisma.js";
import createError from "../utils/createError.js";
import { isAdmin } from "../utils/game.js";
import { MAX_LEVEL, expForLevel, questSlots } from "../utils/level.js";
import { userSelect } from "./user.controller.js";

const SHOW_LEVELS = 30;
const MAX_REWARDS_PER_LEVEL = 20;

// GET /level-reward?userId=...  ตารางเลเวลถัดๆ ไปของ user คนนั้น (exp ที่ต้องใช้, โควตาเควส) + รางวัลที่ตั้งไว้ พร้อมผู้ให้
// USER ดูได้แค่ของตัวเอง
export const getLevelRewards = async (req, res) => {
  const userId = isAdmin(req.user) && req.query.userId ? req.query.userId : req.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) createError(404, "ไม่พบผู้ใช้");

  const levelRewards = await prisma.levelReward.findMany({
    where: { userId, level: { gt: user.level } },
    include: { reward: true, createdBy: { select: userSelect } },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
  });

  const lastLevel = Math.min(MAX_LEVEL, Math.max(user.level + SHOW_LEVELS, ...levelRewards.map((lr) => lr.level)));
  const levels = [];
  for (let level = user.level + 1; level <= lastLevel; level++) {
    levels.push({
      level,
      exp: expForLevel(level),
      questSlots: questSlots(level),
      rewards: levelRewards
        .filter((lr) => lr.level === level)
        .map(({ id, reward, createdBy }) => ({ id, reward, createdBy })),
    });
  }

  res.json({ data: { user: { ...user, questSlots: questSlots(user.level) }, levels } });
};

// POST /level-reward  { userId, level, rewardId }  ADMIN คนที่กดเพิ่ม = ผู้ให้รางวัล
export const addLevelReward = async (req, res) => {
  const { userId, rewardId } = req.body;
  const level = Number(req.body.level);

  const user = await prisma.user.findFirst({ where: { id: userId, status: true } });
  if (!user) createError(404, "ไม่พบผู้ใช้");
  if (level > MAX_LEVEL) createError(400, "เลเวลไม่ถูกต้อง");
  if (level <= user.level) createError(400, `ผู้เล่นคนนี้ผ่าน Lv.${level} ไปแล้ว`);

  const reward = await prisma.reward.findFirst({ where: { id: rewardId, isActive: true } });
  if (!reward) createError(404, "ไม่พบรางวัล");

  const count = await prisma.levelReward.count({ where: { userId, level } });
  if (count >= MAX_REWARDS_PER_LEVEL) createError(400, `ใส่รางวัลได้สูงสุด ${MAX_REWARDS_PER_LEVEL} รายการต่อเลเวล`);

  const levelReward = await prisma.levelReward.create({
    data: { userId, level, rewardId, createdById: req.user.id, sortOrder: count },
    include: { reward: true, createdBy: { select: userSelect } },
  });

  res.json({ message: `เพิ่มรางวัล Lv.${level} เรียบร้อย`, data: levelReward });
};

// DELETE /level-reward/:id
export const deleteLevelReward = async (req, res) => {
  await prisma.levelReward.delete({ where: { id: req.params.id } });
  res.json({ message: "ลบรางวัลเรียบร้อย" });
};
