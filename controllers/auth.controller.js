import prisma from "../config/prisma.js";
import { decodeToken, getBearerToken } from "../middlewares/verifyToken.js";
import { profileOf } from "./user.controller.js";

// ทุกคนเริ่มเป็น USER ยกเว้นอีเมลใน ADMIN_EMAILS ที่เป็น ADMIN เสมอทุกครั้งที่ login
// (กันกรณีไม่เหลือ ADMIN แล้วไม่มีใครเข้าเมนูกำหนดสิทธิ์ได้)
const isOwnerEmail = (email) => {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email?.toLowerCase());
};

// ------------------------ BYPASS LOGIN (จาก HomePass) ------------------------
// FE ส่ง token ที่ได้จาก HomePass มาทาง Authorization header
export const login = async (req, res) => {
  const decoded = decodeToken(getBearerToken(req));

  const profile = {
    email: decoded.email,
    firstName: decoded.firstName || null,
    lastName: decoded.lastName || null,
    avatar: decoded.avatar || null,
  };

  // sync ชื่อจาก HomePass ทุกครั้ง แต่ role (ยกเว้น ADMIN_EMAILS)/ชื่อเล่นของระบบนี้ไม่ทับ
  const isOwner = isOwnerEmail(decoded.email);
  const user = await prisma.user.upsert({
    where: { id: decoded.id },
    update: { ...profile, ...(isOwner ? { role: "ADMIN" } : {}) },
    create: { id: decoded.id, ...profile, role: isOwner ? "ADMIN" : "USER" },
  });

  res.json({ user: await profileOf(user) });
};

// ------------------------ ME ------------------------
export const me = async (req, res) => {
  res.json({ user: await profileOf(req.user) });
};
