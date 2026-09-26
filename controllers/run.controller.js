import prisma from "../config/prisma.js";
import createError from "../utils/createError.js";
import { createGiftBox, grantExp, isAdmin } from "../utils/game.js";
import { displayName, notify } from "../utils/notify.js";
import { userSelect } from "./user.controller.js";

const questSummarySelect = {
  id: true,
  title: true,
  type: true,
  mode: true,
  unit: true,
  targetAmount: true,
  requireProof: true,
  totalValue: true,
  exp: true,
  boxExpireHours: true,
  rewards: { include: { reward: true }, orderBy: { sortOrder: "asc" } },
};

const membersInclude = { include: { user: { select: userSelect } }, orderBy: { joinedAt: "asc" } };

const pickAttachments = (attachments = []) =>
  attachments.map(({ url, publicId, name, mimeType }) => ({ url, publicId, name, mimeType }));

// โหลดรอบ + เช็คสิทธิ์: ADMIN ดูได้ทุกรอบ, USER ดูได้เฉพาะรอบที่ตัวเองร่วมทำ
const findRunForUser = async (id, user) => {
  const run = await prisma.questRun.findUnique({
    where: { id },
    include: { quest: { select: questSummarySelect }, members: true },
  });
  if (!run) createError(404, "ไม่พบเควส");

  const isMember = run.members.some((m) => m.userId === user.id);
  if (!isAdmin(user) && !isMember) createError(403, "ไม่มีสิทธิ์เข้าถึงเควสนี้");
  return { run, isMember };
};

const assertMember = (isMember) => {
  if (!isMember) createError(403, "เฉพาะผู้ที่รับเควสนี้เท่านั้น");
};

const assertInProgress = (run) => {
  if (run.status !== "IN_PROGRESS") createError(400, "เควสนี้ไม่ได้อยู่ในสถานะกำลังทำ");
  if (run.expiresAt && run.expiresAt <= new Date()) createError(400, "เควสนี้หมดเวลาแล้ว");
};

// เปลี่ยนสถานะแบบ atomic: สำเร็จเฉพาะเมื่อสถานะปัจจุบันยังเป็น fromStatus
const transition = async (tx, id, fromStatus, data) => {
  const { count } = await tx.questRun.updateMany({
    where: { id, status: { in: [].concat(fromStatus) } },
    data,
  });
  if (count === 0) createError(409, "สถานะเควสมีการเปลี่ยนแปลงแล้ว กรุณารีเฟรช");
};

// ------------------------ LIST ------------------------
// GET /run?status=IN_PROGRESS,SUBMITTED&scope=all&userId=...&page=1&size=20
// scope=mine (default) เควสที่ฉันร่วมทำ | scope=all (ADMIN) ทุกคน ไว้ใช้หน้าตรวจเควส
export const getRuns = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const size = Math.min(Math.max(Number(req.query.size) || 20, 1), 150);
  const { status, questId } = req.query;
  const all = isAdmin(req.user) && req.query.scope === "all";
  const userId = all ? req.query.userId : req.user.id;

  const where = {
    ...(status ? { status: { in: String(status).split(",") } } : {}),
    ...(questId ? { questId } : {}),
    ...(userId ? { members: { some: { userId } } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.questRun.findMany({
      where,
      include: { quest: { select: questSummarySelect }, members: membersInclude },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.questRun.count({ where }),
  ]);

  res.json({ data, pagination: { total, page, size } });
};

// ------------------------ DETAIL ------------------------
export const getRunById = async (req, res) => {
  await findRunForUser(req.params.id, req.user);

  const run = await prisma.questRun.findUnique({
    where: { id: req.params.id },
    include: {
      quest: { select: { ...questSummarySelect, description: true, createdBy: { select: userSelect } } },
      members: membersInclude,
      submittedBy: { select: userSelect },
      reviewedBy: { select: userSelect },
      attachments: { orderBy: { createdAt: "asc" } },
      progressLogs: {
        include: { attachments: true, createdBy: { select: userSelect } },
        orderBy: { createdAt: "desc" },
      },
      giftBoxes: { include: { user: { select: userSelect } } },
    },
  });

  res.json({ data: run });
};

// ------------------------ PROGRESS ------------------------
// POST /run/:id/progress  { amount, note, attachments }
export const addProgress = async (req, res) => {
  const { run, isMember } = await findRunForUser(req.params.id, req.user);
  assertMember(isMember);
  assertInProgress(run);

  const { amount, note, attachments } = req.body;

  const progress = await prisma.$transaction(async (tx) => {
    const created = await tx.questProgress.create({
      data: {
        runId: run.id,
        amount: Number(amount),
        note,
        createdById: req.user.id,
        attachments: { create: pickAttachments(attachments) },
      },
      include: { attachments: true },
    });
    await transition(tx, run.id, "IN_PROGRESS", { currentAmount: { increment: Number(amount) } });
    return created;
  });

  res.json({ data: progress });
};

// DELETE /run/:id/progress/:progressId  (คนบันทึกเอง หรือ ADMIN แก้กรณีบันทึกผิด)
export const deleteProgress = async (req, res) => {
  const progress = await prisma.questProgress.findFirst({
    where: { id: req.params.progressId, runId: req.params.id },
  });
  if (!progress) createError(404, "ไม่พบรายการ");
  if (progress.createdById !== req.user.id && !isAdmin(req.user)) createError(403, "ไม่มีสิทธิ์ลบรายการนี้");

  // เจ้าของแก้ได้ระหว่างทำ, ADMIN แก้ได้ถึงตอนรอตรวจ
  const editableStatus = isAdmin(req.user) ? ["IN_PROGRESS", "SUBMITTED"] : ["IN_PROGRESS"];

  await prisma.$transaction(async (tx) => {
    await tx.questProgress.delete({ where: { id: progress.id } });
    await transition(tx, req.params.id, editableStatus, {
      currentAmount: { decrement: progress.amount },
    });
  });

  res.json({ message: "ลบรายการเรียบร้อย" });
};

// ------------------------ WORKFLOW ------------------------
// POST /run/:id/submit  { note, attachments }  กดทำเสร็จ -> รอตรวจสอบ
export const submitRun = async (req, res) => {
  const { run, isMember } = await findRunForUser(req.params.id, req.user);
  assertMember(isMember);
  assertInProgress(run);

  const { quest } = run;
  const attachments = pickAttachments(req.body.attachments);

  // เควสที่มีเป้าหมายเป็นจำนวน ต้องบันทึกความคืบหน้าให้ครบก่อน (เป้าหมาย 1 = กดทำเสร็จได้เลย)
  if (quest.targetAmount > 1 && run.currentAmount < quest.targetAmount) {
    createError(400, `ยังทำไม่ครบเป้าหมาย (${run.currentAmount}/${quest.targetAmount} ${quest.unit || ""})`);
  }
  if (quest.requireProof) {
    const proofCount =
      attachments.length +
      (await prisma.attachment.count({ where: { OR: [{ runId: run.id }, { progress: { runId: run.id } }] } }));
    if (proofCount === 0) createError(400, "เควสนี้ต้องแนบหลักฐานอย่างน้อย 1 ไฟล์");
  }

  await prisma.$transaction(async (tx) => {
    await transition(tx, run.id, "IN_PROGRESS", {
      status: "SUBMITTED",
      submitNote: req.body.note || null,
      submittedById: req.user.id,
      submittedAt: new Date(),
      currentAmount: Math.max(run.currentAmount, quest.targetAmount === 1 ? 1 : 0),
    });
    if (attachments.length) {
      await tx.attachment.createMany({ data: attachments.map((a) => ({ ...a, runId: run.id })) });
    }
  });

  notify(`🎯 ${displayName(req.user)} ทำเควส "${quest.title}" เสร็จแล้ว รอตรวจสอบ`);
  res.json({ message: "ส่งเควสแล้ว รอตรวจสอบ" });
};

// POST /run/:id/approve  { comment }  (ADMIN) ผ่าน -> ทุกคนในรอบได้ exp + กล่องของขวัญ
export const approveRun = async (req, res) => {
  const { run } = await findRunForUser(req.params.id, req.user);
  const { quest } = run;
  const now = new Date();
  const rewards = quest.rewards.map((slot) => slot.reward);
  const boxExpiresAt = quest.boxExpireHours ? new Date(now.getTime() + quest.boxExpireHours * 3600 * 1000) : null;

  const levelUps = await prisma.$transaction(
    async (tx) => {
      await transition(tx, run.id, "SUBMITTED", {
        status: "COMPLETED",
        reviewComment: req.body.comment || null,
        reviewedById: req.user.id,
        reviewedAt: now,
        completedAt: now,
      });

      const result = [];
      for (const member of run.members) {
        await tx.questRunMember.update({
          where: { runId_userId: { runId: run.id, userId: member.userId } },
          data: { expEarned: quest.exp },
        });
        if (rewards.length) {
          await createGiftBox(tx, {
            userId: member.userId,
            source: "QUEST",
            runId: run.id,
            title: quest.title,
            expiresAt: boxExpiresAt,
            rewards,
          });
        }
        const levelUp = await grantExp(tx, member.userId, quest.exp);
        if (levelUp) result.push({ userId: member.userId, ...levelUp });
      }
      return result;
    },
    { timeout: 30000 } // DB อยู่ข้างนอก + ทีมหลายคน ใช้เวลาเกิน default 5 วินาทีได้
  );

  const members = await prisma.user.findMany({
    where: { id: { in: run.members.map((m) => m.userId) } },
    select: userSelect,
  });
  const nameOf = (id) => displayName(members.find((m) => m.id === id));
  notify(
    [
      `✅ เควส "${quest.title}" ผ่านแล้ว! ${members.map(displayName).join(", ")} ได้รับ ${quest.exp} EXP${rewards.length ? " + กล่องของขวัญ 🎁" : ""}`,
      ...levelUps.map((l) => `🎉 ${nameOf(l.userId)} เลเวลอัพเป็น Lv.${l.to}`),
    ].join("\n")
  );

  res.json({ message: "ตรวจผ่านเรียบร้อย", data: { levelUps } });
};

// POST /run/:id/reject  { comment }  (ADMIN) ตีกลับไปทำต่อ
export const rejectRun = async (req, res) => {
  const { run } = await findRunForUser(req.params.id, req.user);

  await transition(prisma, run.id, "SUBMITTED", {
    status: "IN_PROGRESS",
    reviewComment: req.body.comment,
    reviewedById: req.user.id,
    reviewedAt: new Date(),
  });

  res.json({ message: "ตีกลับเควสเรียบร้อย" });
};

// POST /run/:id/abandon  ยกเลิกเควสที่รับไว้ (คืนโควตา)
// SOLO = ลบรอบทิ้ง (รับใหม่ได้), TEAM = ออกจากทีม (ถ้าไม่เหลือใครก็ลบรอบ)
export const abandonRun = async (req, res) => {
  const { run, isMember } = await findRunForUser(req.params.id, req.user);
  assertMember(isMember);
  if (run.status !== "IN_PROGRESS") createError(400, "ยกเลิกได้เฉพาะเควสที่กำลังทำ");

  await prisma.$transaction(async (tx) => {
    if (run.ownerKey === "TEAM" && run.members.length > 1) {
      await tx.questRunMember.delete({ where: { runId_userId: { runId: run.id, userId: req.user.id } } });
    } else {
      await tx.questRun.delete({ where: { id: run.id } });
    }
  });

  res.json({ message: "ยกเลิกเควสแล้ว" });
};
