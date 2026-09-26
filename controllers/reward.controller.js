import prisma from "../config/prisma.js";
import createError from "../utils/createError.js";

const pickRewardData = ({ title, description, imageUrl, price }) => ({
  title,
  description,
  imageUrl,
  price: Number(price),
});

// GET /reward?all=true  (default แสดงเฉพาะที่ยังใช้งาน)
// usedCount = ถูกใส่ใน slot เควสกี่ครั้ง ใช้เรียง "ใช้บ่อย" ตอนหยิบรางวัลจากคลัง
export const getRewards = async (req, res) => {
  const rewards = await prisma.reward.findMany({
    where: req.query.all === "true" ? {} : { isActive: true },
    include: { _count: { select: { questSlots: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    data: rewards.map(({ _count, ...r }) => ({ ...r, usedCount: _count.questSlots })),
  });
};

export const getRewardById = async (req, res) => {
  const reward = await prisma.reward.findUnique({ where: { id: req.params.id } });
  if (!reward) createError(404, "ไม่พบรางวัล");
  res.json({ data: reward });
};

export const createReward = async (req, res) => {
  const reward = await prisma.reward.create({
    data: { ...pickRewardData(req.body), createdById: req.user.id },
  });
  res.json({ data: reward });
};

// แก้มูลค่าไม่กระทบเควสเดิมจนกว่าจะกดบันทึกเควสนั้นใหม่ และไม่กระทบกล่องที่แจกไปแล้ว (snapshot)
export const updateReward = async (req, res) => {
  const reward = await prisma.reward.update({
    where: { id: req.params.id },
    data: pickRewardData(req.body),
  });
  res.json({ data: reward });
};

// soft delete: รางวัลอาจถูกผูกกับเควส/กล่องไปแล้ว
export const deleteReward = async (req, res) => {
  await prisma.reward.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  res.json({ message: "ลบรางวัลเรียบร้อย" });
};
