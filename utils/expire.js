import prisma from "../config/prisma.js";

const SWEEP_INTERVAL_MS = 30 * 1000;
let lastSweep = 0;

export const notExpired = (now = new Date()) => ({
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

// รอบเควสที่เลยเวลาแล้วยังไม่ส่ง -> EXPIRED, กล่องที่ไม่ได้เปิดจนหมดอายุ -> EXPIRED (หายจาก inventory)
export const sweepExpired = async () => {
  const now = new Date();
  lastSweep = now.getTime();
  await prisma.$transaction([
    prisma.questRun.updateMany({
      where: { status: "IN_PROGRESS", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    }),
    prisma.giftBox.updateMany({
      where: { status: "UNOPENED", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    }),
  ]);
};

// ไม่ต้องพึ่ง cron: sweep ก่อนตอบ request อย่างมากทุก 30 วินาที
// (action ที่สำคัญอย่างส่งเควส/เปิดกล่อง เช็ค expiresAt เองอีกชั้น)
export const sweepExpiredMiddleware = async (req, res, next) => {
  if (Date.now() - lastSweep > SWEEP_INTERVAL_MS) await sweepExpired();
  next();
};
