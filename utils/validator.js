import { array, boolean, date, number, object, string } from "yup";
import createError from "./createError.js";

const attachmentSchema = object({
  url: string().url().required(),
  publicId: string().nullable(),
  name: string().nullable(),
  mimeType: string().nullable(),
});

export const rewardSchema = object({
  title: string().trim().required("กรุณากรอกชื่อรางวัล"),
  description: string().nullable(),
  imageUrl: string().url("รูปแบบ URL ไม่ถูกต้อง").nullable(),
  price: number()
    .integer("มูลค่าต้องเป็นจำนวนเต็ม")
    .min(0, "มูลค่าต้องไม่ติดลบ")
    .required("กรุณากรอกมูลค่ารางวัล"),
});

export const questSchema = object({
  title: string().trim().required("กรุณากรอกชื่อเควส"),
  description: string().nullable(),
  type: string().oneOf(["MAIN", "DAILY"], "ประเภทเควสไม่ถูกต้อง").required(),
  mode: string().oneOf(["SOLO", "TEAM"], "รูปแบบการทำเควสไม่ถูกต้อง").required(),
  openToAll: boolean().required(),
  assigneeIds: array(string()).when("openToAll", {
    is: false,
    then: (s) => s.min(1, "กรุณาเลือกผู้ทำเควสอย่างน้อย 1 คน").required("กรุณาเลือกผู้ทำเควส"),
  }),
  unit: string().nullable(),
  targetAmount: number()
    .integer("เป้าหมายต้องเป็นจำนวนเต็ม")
    .min(1, "เป้าหมายต้องมากกว่า 0")
    .required("กรุณากรอกเป้าหมาย"),
  requireProof: boolean(),
  minLevel: number().integer().min(1, "เลเวลขั้นต่ำต้องมากกว่า 0").nullable(),
  expiresAt: date().nullable(),
  boxExpireHours: number().integer().min(1, "เวลาหมดอายุกล่องต้องมากกว่า 0").nullable(),
  rewardIds: array(string()).max(20, "ใส่รางวัลได้สูงสุด 20 slot"),
  prerequisiteIds: array(string()),
  attachments: array(attachmentSchema),
});

export const progressSchema = object({
  amount: number()
    .integer("จำนวนต้องเป็นจำนวนเต็ม")
    .min(1, "จำนวนต้องมากกว่า 0")
    .required("กรุณากรอกจำนวน"),
  note: string().nullable(),
  attachments: array(attachmentSchema),
});

export const submitSchema = object({
  note: string().nullable(),
  attachments: array(attachmentSchema),
});

export const rejectSchema = object({
  comment: string().trim().required("กรุณาระบุเหตุผล"),
});

export const nicknameSchema = object({
  nickname: string().trim().max(50, "ชื่อเล่นยาวได้ไม่เกิน 50 ตัวอักษร").nullable(),
});

export const levelRewardSchema = object({
  userId: string().required("กรุณาเลือกผู้เล่น"),
  level: number().integer("เลเวลไม่ถูกต้อง").min(2, "เลเวลไม่ถูกต้อง").required("กรุณาระบุเลเวล"),
  rewardId: string().required("กรุณาเลือกรางวัล"),
});

export const validate = (schema) => async (req, res, next) => {
  try {
    await schema.validate(req.body, { abortEarly: true });
  } catch (error) {
    createError(400, error.errors.join(","));
  }
  next();
};
