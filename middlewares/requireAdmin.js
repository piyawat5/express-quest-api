import createError from "../utils/createError.js";

// ใช้ต่อจาก verifyToken
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "ADMIN") createError(403, "เฉพาะ ADMIN เท่านั้น");
  next();
};

export default requireAdmin;
