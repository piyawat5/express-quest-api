import prisma from "../config/prisma.js";
import createError from "../utils/createError.js";
import { countActiveRuns, isAdmin } from "../utils/game.js";
import { questExp, questSlots } from "../utils/level.js";
import { notifyUsers } from "../utils/notify.js";
import { MAIN_PERIOD, periodKeyOf, runExpiresAt, todayKey } from "../utils/period.js";
import { userSelect } from "./user.controller.js";

const questInclude = {
  rewards: { include: { reward: true }, orderBy: { sortOrder: "asc" } },
  assignees: { include: { user: { select: userSelect } } },
  prerequisites: { include: { requiredQuest: { select: { id: true, title: true, type: true } } } },
  createdBy: { select: userSelect },
};

const runSummaryInclude = {
  members: { include: { user: { select: userSelect } }, orderBy: { joinedAt: "asc" } },
};

// USER เห็นเฉพาะเควสที่เปิดให้ทุกคน, ถูกเลือกให้ทำ หรือเคยร่วมทำ
const visibleTo = (user) =>
  isAdmin(user)
    ? {}
    : {
        OR: [
          { openToAll: true },
          { assignees: { some: { userId: user.id } } },
          { runs: { some: { members: { some: { userId: user.id } } } } },
        ],
      };

// ------------------------ AVAILABILITY ------------------------
// สถานะของเควสในมุมของ user คนนี้
// state: AVAILABLE | LOCKED | CLOSED (ทีมทำไปแล้ว/หมดเขต) | IN_PROGRESS | SUBMITTED | COMPLETED | EXPIRED
const buildAvailability = async (quests, user) => {
  const questIds = quests.map((q) => q.id);
  const prereqIds = [...new Set(quests.flatMap((q) => q.prerequisites.map((p) => p.requiredQuestId)))];
  const today = todayKey();
  const now = new Date();

  const [myRuns, teamRuns, donePrereqs] = await Promise.all([
    prisma.questRun.findMany({
      where: { questId: { in: questIds }, members: { some: { userId: user.id } } },
      select: { id: true, questId: true, periodKey: true, status: true },
    }),
    prisma.questRun.findMany({
      where: { questId: { in: questIds }, ownerKey: "TEAM", periodKey: { in: [MAIN_PERIOD, today] } },
      include: runSummaryInclude,
    }),
    prisma.questRunMember.findMany({
      where: { userId: user.id, run: { questId: { in: prereqIds }, status: "COMPLETED" } },
      select: { run: { select: { questId: true } } },
    }),
  ]);
  const doneQuestIds = new Set(donePrereqs.map((d) => d.run.questId));

  return quests.map((quest) => {
    const period = quest.type === "DAILY" ? today : MAIN_PERIOD;
    const myRun = myRuns.find((r) => r.questId === quest.id && r.periodKey === period);
    const teamRun = teamRuns.find((r) => r.questId === quest.id && r.periodKey === period) || null;

    const reasons = [];
    if (!quest.isActive) reasons.push("เควสนี้ถูกปิดแล้ว");
    if (quest.expiresAt && quest.expiresAt <= now) reasons.push("เควสนี้หมดอายุแล้ว");
    if (!quest.openToAll && !quest.assignees.some((a) => a.userId === user.id)) {
      reasons.push("เควสนี้ไม่ได้เปิดให้คุณทำ");
    }
    if (user.level < quest.minLevel) reasons.push(`ต้องมีเลเวล ${quest.minLevel} ขึ้นไป`);
    for (const p of quest.prerequisites) {
      if (!doneQuestIds.has(p.requiredQuestId)) {
        reasons.push(`ต้องทำเควส "${p.requiredQuest?.title || "ก่อนหน้า"}" ให้สำเร็จก่อน`);
      }
    }

    let state = reasons.length ? "LOCKED" : "AVAILABLE";
    if (myRun) state = myRun.status;
    else if (teamRun && teamRun.status !== "IN_PROGRESS") state = "CLOSED";
    else if (quest.isActive === false || (quest.expiresAt && quest.expiresAt <= now)) state = "CLOSED";

    return { state, runId: myRun?.id || null, reasons, teamRun };
  });
};

const withAvailability = async (quests, user) => {
  const availability = await buildAvailability(quests, user);
  return quests.map(({ favorites, ...quest }, i) => ({
    ...quest,
    isFavorite: !!favorites?.length,
    availability: availability[i],
  }));
};

// ------------------------ LIST ------------------------
// GET /quest?type=DAILY&mode=TEAM&favorite=true&q=ล้างจาน&active=false&page=1&size=12
export const getQuests = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const size = Math.min(Math.max(Number(req.query.size) || 12, 1), 150);
  const { type, mode, favorite, q } = req.query;
  // เควสที่ปิดแล้ว ADMIN เท่านั้นที่ดูได้ (ไว้คัดลอกไปใช้ใหม่)
  const active = !(isAdmin(req.user) && req.query.active === "false");

  const where = {
    isActive: active,
    ...(type ? { type } : {}),
    ...(mode ? { mode } : {}),
    ...(q ? { title: { contains: String(q) } } : {}),
    ...(favorite === "true" ? { favorites: { some: { userId: req.user.id } } } : {}),
    ...visibleTo(req.user),
  };

  const [quests, total] = await Promise.all([
    prisma.quest.findMany({
      where,
      include: { ...questInclude, favorites: { where: { userId: req.user.id } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.quest.count({ where }),
  ]);

  res.json({ data: await withAvailability(quests, req.user), pagination: { total, page, size } });
};

// GET /quest/top?limit=10  เควสที่รางวัลมูลค่าสูงสุดที่ยังเปิดรับอยู่ตอนนี้ (หน้า dashboard)
export const getTopQuests = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

  const quests = await prisma.quest.findMany({
    where: {
      isActive: true,
      totalValue: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      // เควสหลักแบบทีมที่ทำสำเร็จ/ส่งแล้ว ไม่เปิดรับอีก
      NOT: { type: "MAIN", mode: "TEAM", runs: { some: { status: { in: ["SUBMITTED", "COMPLETED"] } } } },
      AND: [visibleTo(req.user)],
    },
    include: { ...questInclude, favorites: { where: { userId: req.user.id } } },
    orderBy: [{ totalValue: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  res.json({ data: await withAvailability(quests, req.user) });
};

// ------------------------ DETAIL ------------------------
export const getQuestById = async (req, res) => {
  const quest = await prisma.quest.findFirst({
    where: { id: req.params.id, ...visibleTo(req.user) },
    include: {
      ...questInclude,
      attachments: { orderBy: { createdAt: "asc" } },
      favorites: { where: { userId: req.user.id } },
    },
  });
  if (!quest) createError(404, "ไม่พบเควส");

  // ADMIN เห็นทุกรอบ (ไว้ตรวจ), USER เห็นเฉพาะรอบที่ตัวเองร่วมทำ
  const runs = await prisma.questRun.findMany({
    where: {
      questId: quest.id,
      ...(isAdmin(req.user) ? {} : { members: { some: { userId: req.user.id } } }),
    },
    include: runSummaryInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const [data] = await withAvailability([quest], req.user);
  res.json({ data: { ...data, runs } });
};

// ------------------------ CRUD (ADMIN) ------------------------
const pickQuestData = (body) => ({
  title: body.title,
  description: body.description || null,
  type: body.type,
  mode: body.mode,
  openToAll: !!body.openToAll,
  unit: body.unit || null,
  targetAmount: Number(body.targetAmount),
  requireProof: !!body.requireProof,
  minLevel: Number(body.minLevel) || 1,
  expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
  boxExpireHours: body.boxExpireHours ? Number(body.boxExpireHours) : null,
});

// slot รางวัล (ใส่รางวัลเดิมซ้ำได้) + มูลค่ารวม -> exp
const buildRewardSlots = async (rewardIds = []) => {
  const uniqueIds = [...new Set(rewardIds)];
  const rewards = await prisma.reward.findMany({ where: { id: { in: uniqueIds } } });
  if (rewards.length !== uniqueIds.length) createError(400, "ไม่พบรางวัลบางรายการ");

  const priceOf = Object.fromEntries(rewards.map((r) => [r.id, r.price]));
  const totalValue = rewardIds.reduce((sum, id) => sum + priceOf[id], 0);
  return {
    slots: rewardIds.map((rewardId, sortOrder) => ({ rewardId, sortOrder })),
    totalValue,
    exp: questExp(totalValue),
  };
};

const validateAssignees = async (data, assigneeIds = []) => {
  if (data.openToAll) return [];
  const ids = [...new Set(assigneeIds)];
  const found = await prisma.user.count({ where: { id: { in: ids }, status: true } });
  if (found !== ids.length) createError(400, "ไม่พบผู้ทำเควสบางคน");
  return ids;
};

// เควสที่ต้องทำก่อน ต้องไม่วนกลับมาหาตัวเอง (A ต้องทำ B ก่อน, B ต้องทำ A ก่อน = ไม่มีใครทำได้)
const validatePrerequisites = async (questId, prerequisiteIds = []) => {
  const ids = [...new Set(prerequisiteIds)];
  if (questId && ids.includes(questId)) createError(400, "เควสต้องไม่เป็นเงื่อนไขของตัวเอง");

  const found = await prisma.quest.count({ where: { id: { in: ids } } });
  if (found !== ids.length) createError(400, "ไม่พบเควสที่ต้องทำก่อนบางรายการ");

  if (questId) {
    const seen = new Set();
    let frontier = ids;
    while (frontier.length) {
      const next = await prisma.questPrerequisite.findMany({
        where: { questId: { in: frontier } },
        select: { requiredQuestId: true },
      });
      frontier = [];
      for (const { requiredQuestId } of next) {
        if (requiredQuestId === questId) createError(400, "เงื่อนไขเควสวนกันเป็นวงกลม");
        if (!seen.has(requiredQuestId)) {
          seen.add(requiredQuestId);
          frontier.push(requiredQuestId);
        }
      }
    }
  }
  return ids;
};

const pickAttachments = (attachments = []) =>
  attachments.map(({ url, publicId, name, mimeType }) => ({ url, publicId, name, mimeType }));

const relationData = ({ slots, assigneeIds, prerequisiteIds, attachments }) => ({
  rewards: { create: slots },
  assignees: { create: assigneeIds.map((userId) => ({ userId })) },
  prerequisites: { create: prerequisiteIds.map((requiredQuestId) => ({ requiredQuestId })) },
  attachments: { create: pickAttachments(attachments) },
});

export const createQuest = async (req, res) => {
  const data = pickQuestData(req.body);
  const { slots, totalValue, exp } = await buildRewardSlots(req.body.rewardIds);
  const assigneeIds = await validateAssignees(data, req.body.assigneeIds);
  const prerequisiteIds = await validatePrerequisites(null, req.body.prerequisiteIds);

  const quest = await prisma.quest.create({
    data: {
      ...data,
      totalValue,
      exp,
      createdById: req.user.id,
      ...relationData({ slots, assigneeIds, prerequisiteIds, attachments: req.body.attachments }),
    },
  });

  // แจ้งคนที่รับเควสนี้ได้ (เปิดให้ทุกคน = ทุกคน)
  await notifyUsers(data.openToAll ? {} : assigneeIds, {
    title: `📜 เควสใหม่: ${quest.title}`,
    message: `+${exp} EXP${totalValue ? ` · รางวัลมูลค่า ฿${totalValue.toLocaleString("th-TH")}` : ""}`,
    link: `/quest/${quest.id}`,
    except: req.user.id,
  });
  res.json({ data: quest });
};

export const updateQuest = async (req, res) => {
  const current = await prisma.quest.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { runs: true } } },
  });
  if (!current) createError(404, "ไม่พบเควส");

  const data = pickQuestData(req.body);
  // รอบที่รับไปแล้วผูกกับประเภท/โหมดเดิม (periodKey/ownerKey) เปลี่ยนกลางทางไม่ได้
  if (current._count.runs > 0 && (data.type !== current.type || data.mode !== current.mode)) {
    createError(400, "เควสที่มีคนรับไปแล้วเปลี่ยนประเภท/รูปแบบไม่ได้ ให้คัดลอกเป็นเควสใหม่แทน");
  }

  const { slots, totalValue, exp } = await buildRewardSlots(req.body.rewardIds);
  const assigneeIds = await validateAssignees(data, req.body.assigneeIds);
  const prerequisiteIds = await validatePrerequisites(current.id, req.body.prerequisiteIds);

  const quest = await prisma.$transaction(async (tx) => {
    await tx.questReward.deleteMany({ where: { questId: current.id } });
    await tx.questAssignee.deleteMany({ where: { questId: current.id } });
    await tx.questPrerequisite.deleteMany({ where: { questId: current.id } });
    await tx.attachment.deleteMany({ where: { questId: current.id } });
    const updated = await tx.quest.update({
      where: { id: current.id },
      data: {
        ...data,
        totalValue,
        exp,
        ...relationData({ slots, assigneeIds, prerequisiteIds, attachments: req.body.attachments }),
      },
    });
    // วันหมดอายุเควสเปลี่ยน -> รอบที่กำลังทำอยู่ต้องหมดอายุตามด้วย
    await tx.questRun.updateMany({
      where: { questId: current.id, status: "IN_PROGRESS", periodKey: periodKeyOf(updated) },
      data: { expiresAt: runExpiresAt(updated) },
    });
    return updated;
  });

  res.json({ data: quest });
};

// มีคนเคยรับแล้ว = ปิดเควส (เก็บประวัติ/เส้นทางไว้), ยังไม่มีใครรับ = ลบจริง
export const deleteQuest = async (req, res) => {
  const runs = await prisma.questRun.count({ where: { questId: req.params.id } });
  if (runs > 0) {
    await prisma.quest.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ message: "ปิดเควสเรียบร้อย (เก็บประวัติไว้)" });
  }
  await prisma.quest.delete({ where: { id: req.params.id } });
  res.json({ message: "ลบเควสเรียบร้อย" });
};

// PUT /quest/:id/active  { isActive }  เปิดเควสที่ปิดไปแล้วอีกครั้ง
export const setQuestActive = async (req, res) => {
  const quest = await prisma.quest.update({
    where: { id: req.params.id },
    data: { isActive: !!req.body.isActive },
  });
  res.json({ data: quest });
};

// POST /quest/:id/favorite  toggle
export const toggleFavorite = async (req, res) => {
  const key = { questId_userId: { questId: req.params.id, userId: req.user.id } };
  const existing = await prisma.questFavorite.findUnique({ where: key });

  if (existing) await prisma.questFavorite.delete({ where: key });
  else await prisma.questFavorite.create({ data: { questId: req.params.id, userId: req.user.id } });

  res.json({ data: { isFavorite: !existing } });
};

// ------------------------ ACCEPT ------------------------
// POST /quest/:id/accept  SOLO = สร้างรอบของตัวเอง, TEAM = เข้าร่วมรอบของทีม (ยังไม่มีก็สร้าง)
export const acceptQuest = async (req, res) => {
  const quest = await prisma.quest.findFirst({
    where: { id: req.params.id, ...visibleTo(req.user) },
    include: questInclude,
  });
  if (!quest) createError(404, "ไม่พบเควส");

  const [availability] = await buildAvailability([quest], req.user);
  if (availability.state !== "AVAILABLE") {
    const messages = {
      LOCKED: availability.reasons[0],
      CLOSED: "เควสนี้ปิดรับแล้ว",
      IN_PROGRESS: "คุณรับเควสนี้ไปแล้ว",
      SUBMITTED: "คุณส่งเควสนี้แล้ว รอตรวจสอบ",
      COMPLETED: quest.type === "DAILY" ? "วันนี้ทำเควสนี้สำเร็จแล้ว พรุ่งนี้มาใหม่นะ" : "คุณทำเควสนี้สำเร็จแล้ว",
      EXPIRED: "เควสรอบนี้หมดเวลาแล้ว",
    };
    createError(400, messages[availability.state]);
  }

  const periodKey = periodKeyOf(quest);
  const ownerKey = quest.mode === "TEAM" ? "TEAM" : req.user.id;

  const run = await prisma.$transaction(async (tx) => {
    // lock แถว user กันกดรับพร้อมกันหลายเควสจนเกินโควตา
    const me = await tx.user.update({ where: { id: req.user.id }, data: { updatedAt: new Date() } });
    const slots = questSlots(me.level);
    if ((await countActiveRuns(me.id, tx)) >= slots) {
      createError(400, `เลเวล ${me.level} รับเควสพร้อมกันได้ ${slots} เควส ทำเควสที่รับไว้ให้เสร็จก่อนนะ`);
    }

    const runKey = { questId_periodKey_ownerKey: { questId: quest.id, periodKey, ownerKey } };
    const existing = await tx.questRun.upsert({
      where: runKey,
      update: {},
      create: { questId: quest.id, periodKey, ownerKey, expiresAt: runExpiresAt(quest) },
    });
    if (existing.status !== "IN_PROGRESS") createError(409, "เควสนี้ปิดรับแล้ว");

    await tx.questRunMember.create({ data: { runId: existing.id, userId: me.id } });
    return existing;
  });

  res.json({ message: quest.mode === "TEAM" ? "เข้าร่วมเควสแล้ว" : "รับเควสแล้ว", data: run });
};
