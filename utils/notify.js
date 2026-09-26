import prisma from "../config/prisma.js";
import { sendLineMessage } from "./lineNotify.js";

// ชื่อเล่น > ชื่อจริง > อีเมล
export const displayName = (user) =>
  user?.nickname || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email;

// แจ้งเตือนเข้ากลุ่ม LINE (ถ้าไม่ได้ตั้งค่า env ก็ข้ามไป) ไม่ให้ error กระทบ request หลัก
// ปิดไว้ก่อน: ต้องตั้ง NOTIFY_ENABLED=true ถึงจะส่ง
export const notify = async (message) => {
  if (process.env.NOTIFY_ENABLED !== "true") return;
  if (!process.env.LINE_ACCESS_TOKEN_ASSISTANT || !process.env.LINE_GROUP_ID) return;
  try {
    await sendLineMessage(message);
  } catch {
    // sendLineMessage log error ให้แล้ว
  }
};

// คอลัมน์ title เป็น VARCHAR(191) ตัดไว้ก่อนเผื่อชื่อเควส/ชื่อคนยาว
const clip = (text, max = 180) => ([...text].length > max ? [...text].slice(0, max - 1).join("") + "…" : text);

// แจ้งเตือนในเว็บ (กระดิ่ง) ไม่ให้ error กระทบ request หลัก
// to = [userId] หรือ where ของ user เช่น { role: "ADMIN" }, {} = ทุกคน | except = ไม่ต้องแจ้งคนนี้ (คนที่ทำ action เอง)
export const notifyUsers = async (to, { title, message = null, link = null, except = null }) => {
  try {
    const userIds = Array.isArray(to)
      ? to
      : (await prisma.user.findMany({ where: { status: true, ...to }, select: { id: true } })).map((u) => u.id);
    const ids = [...new Set(userIds)].filter((id) => id && id !== except);
    if (!ids.length) return;
    await prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, title: clip(title), message, link })),
    });
  } catch (error) {
    console.error("Error creating notifications:", error);
  }
};
