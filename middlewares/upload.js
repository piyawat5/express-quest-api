import multer from "multer";

export const MAX_FILE_SIZE_MB = 10;

const DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

const reject = (cb, message) => {
  const err = new Error(message);
  err.code = 400;
  cb(err);
};

// เก็บไว้ใน memory ก่อนส่งไป Cloudinary
const createUpload = (isAllowed, message) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
    defParamCharset: "utf8", // ชื่อไฟล์ภาษาไทยไม่เพี้ยน
    fileFilter: (req, file, cb) => (isAllowed(file.mimetype) ? cb(null, true) : reject(cb, message)),
  });

const isImage = (mimetype) => mimetype.startsWith("image/");

// รูปรางวัล
export const uploadImage = createUpload(isImage, "อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น");

// ไฟล์แนบเควส/หลักฐาน: รูป + เอกสาร
export const uploadFile = createUpload(
  (mimetype) => isImage(mimetype) || DOCUMENT_TYPES.includes(mimetype),
  "อนุญาตเฉพาะรูปภาพ, PDF, Word, Excel, PowerPoint หรือไฟล์ข้อความ"
);
