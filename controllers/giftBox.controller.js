import prisma from "../config/prisma.js";
import createError from "../utils/createError.js";
import { notExpired } from "../utils/expire.js";
import { isAdmin } from "../utils/game.js";
import { displayName, notify, notifyUsers } from "../utils/notify.js";
import { userSelect } from "./user.controller.js";

const boxInclude = {
  items: { include: { givenBy: { select: userSelect } }, orderBy: { sortOrder: "asc" } },
  run: { select: { id: true, quest: { select: { id: true, title: true, createdById: true } } } },
  user: { select: userSelect },
};

// GET /inventory?status=UNOPENED&userId=...
// USER เห็นแค่ของตัวเอง, ADMIN ดูของทุกคนได้ (ไว้เช็คตอนมายื่นรับรางวัล) ส่ง userId=me เพื่อดูของตัวเอง
export const getGiftBoxes = async (req, res) => {
  const { status } = req.query;
  const userId = isAdmin(req.user) && req.query.userId !== "me" ? req.query.userId : req.user.id;

  const boxes = await prisma.giftBox.findMany({
    where: {
      ...(userId ? { userId } : {}),
      ...(status ? { status: { in: String(status).split(",") } } : {}),
      // กล่องที่หมดอายุแล้วแต่ sweep ยังไม่ทันเปลี่ยนสถานะ ไม่ต้องโชว์ใน inventory
      ...(status === "UNOPENED" ? notExpired() : {}),
    },
    include: boxInclude,
    orderBy: [{ openedAt: "desc" }, { createdAt: "desc" }],
  });

  res.json({ data: boxes });
};

// POST /inventory/:id/open  เปิดกล่อง = ใช้รางวัลแล้ว (เจ้าของกล่องเท่านั้น)
export const openGiftBox = async (req, res) => {
  const { count } = await prisma.giftBox.updateMany({
    where: { id: req.params.id, userId: req.user.id, status: "UNOPENED", ...notExpired() },
    data: { status: "OPENED", openedAt: new Date() },
  });

  const box = await prisma.giftBox.findUnique({ where: { id: req.params.id }, include: boxInclude });
  if (!box || box.userId !== req.user.id) createError(404, "ไม่พบกล่องของขวัญ");
  if (count === 0) {
    createError(409, box.status === "OPENED" ? "กล่องนี้ถูกเปิดใช้ไปแล้ว" : "กล่องนี้หมดอายุแล้ว");
  }

  notify(`🎁 ${displayName(req.user)} เปิดกล่อง "${box.title}" ได้รับ ${box.items.map((i) => i.title).join(", ")}`);

  // ผู้ให้แต่ละคนเห็นเฉพาะของที่ตัวเองต้องเตรียมให้
  for (const giverId of new Set(box.items.map((i) => i.givenById))) {
    const items = box.items.filter((i) => i.givenById === giverId).map((i) => i.title);
    await notifyUsers([giverId], {
      title: `🎁 ${displayName(req.user)} เปิดกล่อง "${box.title}"`,
      message: `เตรียมรางวัลให้ด้วยนะ: ${items.join(", ")}`,
      except: req.user.id,
    });
  }
  res.json({ data: box });
};
