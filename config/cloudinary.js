import { randomUUID } from "crypto";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// upload ไฟล์ (จาก multer memoryStorage) ไป Cloudinary
// เอกสารที่ไม่ใช่รูป/PDF จะถูกเก็บเป็น raw ต้องใส่นามสกุลใน public_id ไม่งั้นดาวน์โหลดแล้วเปิดไม่ได้
export const uploadToCloudinary = (file, folder = process.env.CLOUDINARY_FOLDER || "quest") => {
  const isRaw = !file.mimetype.startsWith("image/") && file.mimetype !== "application/pdf";
  const ext = path.extname(file.originalname || "").toLowerCase();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto", ...(isRaw ? { public_id: `${randomUUID()}${ext}` } : {}) },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};

export default cloudinary;
