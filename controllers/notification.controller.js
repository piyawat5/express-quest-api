import prisma from "../config/prisma.js";

// GET /notification?limit=30  แจ้งเตือนล่าสุดของฉัน + จำนวนที่ยังไม่อ่าน (กระดิ่งที่ topbar)
export const getNotifications = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);

  const [data, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId: req.user.id, readAt: null } }),
  ]);

  res.json({ data, unread });
};

// POST /notification/:id/read
export const readNotification = async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ message: "อ่านแล้ว" });
};

// POST /notification/read-all
export const readAllNotifications = async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ message: "อ่านทั้งหมดแล้ว" });
};
