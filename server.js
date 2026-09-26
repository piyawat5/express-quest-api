/*
npx prisma migrate dev --name init
npx prisma migrate reset
*/

import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { MAX_FILE_SIZE_MB } from "./middlewares/upload.js";

const app = express();

const corsOptions = {
  origin: (process.env.CORS_ORIGINS || "http://localhost:5174")
    .split(",")
    .map((o) => o.trim()),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.use("/", routes);

// Express 5 ส่ง error จาก async handler มาที่นี่ให้อัตโนมัติ
app.use((err, req, res, next) => {
  // Prisma error มี code เป็น string (เช่น P2025) ห้ามส่งเข้า res.status ตรงๆ
  let status = Number.isInteger(err.code) ? err.code : 500;
  let message = err.message || "something wrong!!!";

  if (err.code === "P2025") {
    status = 404;
    message = "ไม่พบข้อมูล";
  }
  if (err.code === "P2002") {
    status = 409;
    message = "ข้อมูลซ้ำหรือมีการทำรายการพร้อมกัน กรุณาลองใหม่";
  }
  if (err.code === "P2003") {
    status = 400;
    message = "ข้อมูลอ้างอิงไม่ถูกต้อง";
  }
  if (err.name === "MulterError" && err.code === "LIMIT_FILE_SIZE") {
    status = 400;
    message = `ไฟล์มีขนาดใหญ่เกิน ${MAX_FILE_SIZE_MB}MB`;
  }

  if (status === 500) console.error(err);
  res.status(status).json({ message });
});

const port = process.env.PORT || 8001;
app.listen(port, () => {
  console.log(`Quest API running on port ${port}`);
});
