import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import createError from "../utils/createError.js";

export const getBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) createError(401, "No token provided");
  return authHeader.split(" ")[1];
};

// token ถูก sign โดย HomePass ด้วย JWT_SECRET_KEY_QUEST (ค่าเดียวกับ JWT_SECRET_KEY ของระบบนี้)
export const decodeToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch {
    createError(401, "token หมดอายุ");
  }
};

// ใส่ req.user (user จาก DB ของระบบนี้ รวม role USER/ADMIN)
const verifyToken = async (req, res, next) => {
  const decoded = decodeToken(getBearerToken(req));

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || !user.status) createError(401, "ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่");

  req.user = user;
  next();
};

export default verifyToken;
