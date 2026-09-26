import { uploadToCloudinary } from "../config/cloudinary.js";
import createError from "../utils/createError.js";

const toResult = (file, result) => ({
  url: result.secure_url,
  publicId: result.public_id,
  name: file.originalname,
  mimeType: file.mimetype,
});

// POST /upload/single  (field: image) รูปรางวัล
export const uploadImage = async (req, res) => {
  if (!req.file) createError(400, "กรุณาเลือกไฟล์รูปภาพ");

  const result = await uploadToCloudinary(req.file);

  res.json({ message: "อัพโหลดรูปภาพสำเร็จ", data: toResult(req.file, result) });
};

// POST /upload/multiple  (field: files) รูป/เอกสารแนบเควสและหลักฐาน
export const uploadMultipleFiles = async (req, res) => {
  if (!req.files?.length) createError(400, "กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์");

  const results = await Promise.all(req.files.map((file) => uploadToCloudinary(file)));

  res.json({ message: "อัพโหลดไฟล์สำเร็จ", data: results.map((result, i) => toResult(req.files[i], result)) });
};
