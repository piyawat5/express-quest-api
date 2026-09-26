-- ============ LevelReward: รางวัลรวมของทุกคน -> รางวัลของ user แต่ละคน + ผู้ให้ ============
-- เพิ่มคอลัมน์แบบ nullable ก่อน เพราะแถวเดิมยังไม่มีเจ้าของ
ALTER TABLE `LevelReward` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `userId` VARCHAR(191) NULL;

-- คัดลอกรางวัลรวมเดิมให้ user ทุกคนที่ยังไปไม่ถึงเลเวลนั้น (ผู้ให้ = คนที่สร้างรางวัลในคลัง)
INSERT INTO `LevelReward` (`id`, `level`, `userId`, `rewardId`, `createdById`, `sortOrder`, `createdAt`)
SELECT UUID(), lr.`level`, u.`id`, lr.`rewardId`, r.`createdById`, lr.`sortOrder`, CURRENT_TIMESTAMP(3)
FROM `LevelReward` lr
JOIN `Reward` r ON r.`id` = lr.`rewardId`
JOIN `User` u ON u.`level` < lr.`level`
WHERE lr.`userId` IS NULL;

-- แถวรางวัลรวมเดิมถูกคัดลอกไปให้ทุกคนแล้ว
DELETE FROM `LevelReward` WHERE `userId` IS NULL;

ALTER TABLE `LevelReward` MODIFY `createdById` VARCHAR(191) NOT NULL,
    MODIFY `userId` VARCHAR(191) NOT NULL;

-- DropIndex
DROP INDEX `LevelReward_level_idx` ON `LevelReward`;

-- CreateIndex
CREATE INDEX `LevelReward_userId_level_idx` ON `LevelReward`(`userId`, `level`);

-- AddForeignKey
ALTER TABLE `LevelReward` ADD CONSTRAINT `LevelReward_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LevelReward` ADD CONSTRAINT `LevelReward_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============ GiftBoxItem: ผู้ให้รางวัล ============
-- AlterTable
ALTER TABLE `GiftBoxItem` ADD COLUMN `givenById` VARCHAR(191) NULL;

-- ของในกล่องที่มีอยู่แล้ว: กล่องเควส = คนสร้างเควส, กล่องเลเวลอัพ = คนที่สร้างรางวัลในคลัง
UPDATE `GiftBoxItem` i
JOIN `GiftBox` b ON b.`id` = i.`boxId`
JOIN `QuestRun` qr ON qr.`id` = b.`runId`
JOIN `Quest` q ON q.`id` = qr.`questId`
SET i.`givenById` = q.`createdById`
WHERE b.`source` = 'QUEST';

UPDATE `GiftBoxItem` i
JOIN `GiftBox` b ON b.`id` = i.`boxId`
JOIN `Reward` r ON r.`id` = i.`rewardId`
SET i.`givenById` = r.`createdById`
WHERE b.`source` = 'LEVEL_UP';

-- AddForeignKey
ALTER TABLE `GiftBoxItem` ADD CONSTRAINT `GiftBoxItem_givenById_fkey` FOREIGN KEY (`givenById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ Notification (กระดิ่งแจ้งเตือน) ============
-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NULL,
    `link` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
