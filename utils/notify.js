import { sendLineMessage } from "./lineNotify.js";

// ชื่อเล่น > ชื่อจริง > อีเมล
export const displayName = (user) =>
  user?.nickname || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email;

// แจ้งเตือนเข้ากลุ่ม LINE (ถ้าไม่ได้ตั้งค่า env ก็ข้ามไป) ไม่ให้ error กระทบ request หลัก
export const notify = async (message) => {
  if (!process.env.LINE_ACCESS_TOKEN_ASSISTANT || !process.env.LINE_GROUP_ID) return;
  try {
    await sendLineMessage(message);
  } catch {
    // sendLineMessage log error ให้แล้ว
  }
};
