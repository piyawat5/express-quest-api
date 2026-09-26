import prisma from "../config/prisma.js";
import createError from "../utils/createError.js";
import { countActiveRuns, isAdmin } from "../utils/game.js";
import { levelFromExp, levelInfo } from "../utils/level.js";

export const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  nickname: true,
  avatar: true,
  role: true,
  level: true,
  exp: true,
};

// user + ข้อมูลเลเวล (exp ที่ต้องใช้, โควตาเควส, เควสที่กำลังทำ)
export const profileOf = async (user) => ({
  ...user,
  ...levelInfo(user.exp),
  activeQuests: await countActiveRuns(user.id),
});

const assertSelfOrAdmin = (req) => {
  if (req.params.id !== req.user.id && !isAdmin(req.user)) createError(403, "ไม่มีสิทธิ์");
};

// GET /users?role=USER
export const getUsers = async (req, res) => {
  const { role } = req.query;

  const users = await prisma.user.findMany({
    where: { status: true, ...(role ? { role } : {}) },
    select: userSelect,
    orderBy: [{ nickname: "asc" }, { firstName: "asc" }],
  });

  res.json({ data: users });
};

// PUT /users/:id/role  { role: "USER" | "ADMIN" }
// ห้ามเปลี่ยนของตัวเอง -> ระบบจะเหลือ ADMIN อย่างน้อย 1 คนเสมอ
export const updateUserRole = async (req, res) => {
  const { role } = req.body;
  if (!["USER", "ADMIN"].includes(role)) createError(400, "role ไม่ถูกต้อง");
  if (req.params.id === req.user.id) createError(400, "ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้");

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: userSelect,
  });

  res.json({ data: user });
};

// PUT /users/:id/nickname  { nickname }  (ตัวเอง หรือ ADMIN)
export const updateNickname = async (req, res) => {
  assertSelfOrAdmin(req);

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { nickname: req.body.nickname?.trim() || null },
    select: userSelect,
  });

  res.json({ data: user });
};

// ------------------------ JOURNEY ------------------------
// GET /users/:id/journey  เส้นทางการผจญภัย: เควสที่สำเร็จ + จุดที่เลเวลอัพ (เรียงจากเก่าไปใหม่)
export const getJourney = async (req, res) => {
  assertSelfOrAdmin(req);

  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { ...userSelect, createdAt: true } });
  if (!user) createError(404, "ไม่พบผู้ใช้");

  const completed = await prisma.questRunMember.findMany({
    where: { userId: user.id, run: { status: "COMPLETED" } },
    include: {
      run: {
        select: {
          id: true,
          periodKey: true,
          completedAt: true,
          quest: { select: { id: true, title: true, type: true, mode: true, totalValue: true } },
          members: { select: { user: { select: userSelect } } },
          giftBoxes: { where: { userId: user.id }, select: { id: true, status: true, totalValue: true } },
        },
      },
    },
    orderBy: { run: { completedAt: "asc" } },
  });

  const events = [{ type: "START", at: user.createdAt }];
  let totalExp = 0;
  let level = 1;
  for (const { run, expEarned } of completed) {
    totalExp += expEarned;
    events.push({
      type: "QUEST",
      at: run.completedAt,
      runId: run.id,
      quest: run.quest,
      exp: expEarned,
      teammates: run.members.map((m) => m.user).filter((u) => u.id !== user.id),
      giftBox: run.giftBoxes[0] || null,
    });

    const newLevel = levelFromExp(totalExp);
    if (newLevel > level) {
      events.push({ type: "LEVEL_UP", at: run.completedAt, from: level, to: newLevel });
      level = newLevel;
    }
  }

  res.json({
    data: {
      user: { ...user, ...levelInfo(user.exp) },
      stats: {
        completed: completed.length,
        main: completed.filter((c) => c.run.quest.type === "MAIN").length,
        daily: completed.filter((c) => c.run.quest.type === "DAILY").length,
        totalExp,
      },
      events,
    },
  });
};
