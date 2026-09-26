import express from "express";

import verifyToken from "../middlewares/verifyToken.js";
import requireAdmin from "../middlewares/requireAdmin.js";
import { uploadFile, uploadImage } from "../middlewares/upload.js";
import { sweepExpiredMiddleware } from "../utils/expire.js";
import {
  levelRewardSchema,
  nicknameSchema,
  progressSchema,
  questSchema,
  rejectSchema,
  rewardSchema,
  submitSchema,
  validate,
} from "../utils/validator.js";

import { login, me } from "../controllers/auth.controller.js";
import { getJourney, getUsers, updateNickname, updateUserRole } from "../controllers/user.controller.js";
import { uploadImage as uploadSingleImage, uploadMultipleFiles } from "../controllers/attachFile.controller.js";
import {
  createReward,
  deleteReward,
  getRewardById,
  getRewards,
  updateReward,
} from "../controllers/reward.controller.js";
import {
  acceptQuest,
  createQuest,
  deleteQuest,
  getQuestById,
  getQuests,
  getTopQuests,
  setQuestActive,
  toggleFavorite,
  updateQuest,
} from "../controllers/quest.controller.js";
import {
  abandonRun,
  addProgress,
  approveRun,
  deleteProgress,
  getRunById,
  getRuns,
  rejectRun,
  submitRun,
} from "../controllers/run.controller.js";
import { getGiftBoxes, openGiftBox } from "../controllers/giftBox.controller.js";
import { getLevelRewards, updateLevelRewards } from "../controllers/levelReward.controller.js";

const router = express.Router();
const admin = [verifyToken, requireAdmin];

// เควส/กล่องที่หมดเวลา -> EXPIRED ก่อนตอบทุก request
router.use(sweepExpiredMiddleware);

//------------- auth --------------
router.post("/auth/login", login); // bypass จาก HomePass
router.post("/auth/verify", verifyToken, me);

//------------- users (เมนูกำหนดสิทธิ์) --------------
router.get("/users", verifyToken, getUsers);
router.put("/users/:id/role", admin, updateUserRole);
router.put("/users/:id/nickname", verifyToken, validate(nicknameSchema), updateNickname);
router.get("/users/:id/journey", verifyToken, getJourney);

// ------------- upload --------------
router.post("/upload/single", verifyToken, uploadImage.single("image"), uploadSingleImage);
router.post("/upload/multiple", verifyToken, uploadFile.array("files", 10), uploadMultipleFiles);

// ------------- reward (คลังรางวัล) --------------
router.get("/reward", verifyToken, getRewards);
router.get("/reward/:id", verifyToken, getRewardById);
router.post("/reward/create", admin, validate(rewardSchema), createReward);
router.put("/reward/update/:id", admin, validate(rewardSchema), updateReward);
router.delete("/reward/delete/:id", admin, deleteReward);

// ------------- level reward --------------
router.get("/level-reward", verifyToken, getLevelRewards);
router.put("/level-reward/:level", admin, validate(levelRewardSchema), updateLevelRewards);

// ------------- quest (ตัวเควส) --------------
router.get("/quest", verifyToken, getQuests);
router.get("/quest/top", verifyToken, getTopQuests);
router.get("/quest/:id", verifyToken, getQuestById);
router.post("/quest/create", admin, validate(questSchema), createQuest);
router.put("/quest/update/:id", admin, validate(questSchema), updateQuest);
router.delete("/quest/delete/:id", admin, deleteQuest);
router.put("/quest/:id/active", admin, setQuestActive);
router.post("/quest/:id/favorite", admin, toggleFavorite);
router.post("/quest/:id/accept", verifyToken, acceptQuest);

// ------------- run (การทำเควสแต่ละรอบ) --------------
router.get("/run", verifyToken, getRuns);
router.get("/run/:id", verifyToken, getRunById);
router.post("/run/:id/progress", verifyToken, validate(progressSchema), addProgress);
router.delete("/run/:id/progress/:progressId", verifyToken, deleteProgress);
router.post("/run/:id/submit", verifyToken, validate(submitSchema), submitRun);
router.post("/run/:id/approve", admin, approveRun);
router.post("/run/:id/reject", admin, validate(rejectSchema), rejectRun);
router.post("/run/:id/abandon", verifyToken, abandonRun);

// ------------- inventory (กล่องของขวัญ) --------------
router.get("/inventory", verifyToken, getGiftBoxes);
router.post("/inventory/:id/open", verifyToken, openGiftBox);

export default router;
