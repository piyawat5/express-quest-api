import prisma from "../config/prisma.js";
import { levelFromExp } from "./level.js";

export const isAdmin = (user) => user?.role === "ADMIN";

// เควสที่กำลังทำอยู่ (นับทุกประเภท) ใช้เทียบกับโควตาตามเลเวล
export const countActiveRuns = (userId, db = prisma) =>
  db.questRunMember.count({
    where: {
      userId,
      run: {
        status: "IN_PROGRESS",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    },
  });

// ส่งกล่องของขวัญเข้า inventory (snapshot ข้อมูลรางวัลไว้ เผื่อรางวัลถูกแก้/ลบภายหลัง)
export const createGiftBox = (tx, { userId, source, runId = null, level = null, title, expiresAt = null, rewards }) =>
  tx.giftBox.create({
    data: {
      userId,
      source,
      runId,
      level,
      title,
      expiresAt,
      totalValue: rewards.reduce((sum, r) => sum + r.price, 0),
      items: {
        create: rewards.map((r, i) => ({
          rewardId: r.id,
          title: r.title,
          description: r.description,
          imageUrl: r.imageUrl,
          price: r.price,
          sortOrder: i,
        })),
      },
    },
  });

// เพิ่ม exp + เลเวลอัพ + แจกกล่องรางวัลเลเวลอัพของทุกเลเวลที่ข้ามไป
// return { from, to } เมื่อเลเวลอัพ, null ถ้าไม่ขึ้น
export const grantExp = async (tx, userId, exp) => {
  const user = await tx.user.update({ where: { id: userId }, data: { exp: { increment: exp } } });
  const from = levelFromExp(user.exp - exp);
  const to = levelFromExp(user.exp);
  if (to !== user.level) await tx.user.update({ where: { id: userId }, data: { level: to } });
  if (to <= from) return null;

  const levelRewards = await tx.levelReward.findMany({
    where: { level: { gt: from, lte: to } },
    include: { reward: true },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
  });
  for (let level = from + 1; level <= to; level++) {
    const rewards = levelRewards.filter((lr) => lr.level === level).map((lr) => lr.reward);
    if (rewards.length) {
      await createGiftBox(tx, { userId, source: "LEVEL_UP", level, title: `รางวัลเลเวลอัพ Lv.${level}`, rewards });
    }
  }
  return { from, to };
};
