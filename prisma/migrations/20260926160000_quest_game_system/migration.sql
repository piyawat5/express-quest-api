-- DropForeignKey
ALTER TABLE `Quest` DROP FOREIGN KEY `Quest_assigneeId_fkey`;

-- DropForeignKey
ALTER TABLE `Quest` DROP FOREIGN KEY `Quest_reviewedById_fkey`;

-- DropForeignKey
ALTER TABLE `Quest` DROP FOREIGN KEY `Quest_rewardId_fkey`;

-- DropForeignKey
ALTER TABLE `QuestProgress` DROP FOREIGN KEY `QuestProgress_questId_fkey`;

-- DropForeignKey
ALTER TABLE `Redemption` DROP FOREIGN KEY `Redemption_childId_fkey`;

-- DropForeignKey
ALTER TABLE `Redemption` DROP FOREIGN KEY `Redemption_questId_fkey`;

-- DropForeignKey
ALTER TABLE `Redemption` DROP FOREIGN KEY `Redemption_rewardId_fkey`;

-- DropIndex
DROP INDEX `Quest_assigneeId_status_idx` ON `Quest`;

-- DropIndex
DROP INDEX `Quest_reviewedById_fkey` ON `Quest`;

-- DropIndex
DROP INDEX `Quest_rewardId_fkey` ON `Quest`;

-- DropIndex
DROP INDEX `QuestProgress_questId_fkey` ON `QuestProgress`;

-- AlterTable
ALTER TABLE `Attachment` ADD COLUMN `mimeType` VARCHAR(191) NULL,
    ADD COLUMN `name` VARCHAR(191) NULL,
    ADD COLUMN `questId` VARCHAR(191) NULL,
    ADD COLUMN `runId` VARCHAR(191) NULL,
    MODIFY `url` TEXT NOT NULL,
    MODIFY `progressId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Quest` DROP COLUMN `assigneeId`,
    DROP COLUMN `currentAmount`,
    DROP COLUMN `dueDate`,
    DROP COLUMN `reviewComment`,
    DROP COLUMN `reviewedAt`,
    DROP COLUMN `reviewedById`,
    DROP COLUMN `rewardId`,
    DROP COLUMN `startDate`,
    DROP COLUMN `status`,
    DROP COLUMN `submittedAt`,
    ADD COLUMN `boxExpireHours` INTEGER NULL,
    ADD COLUMN `exp` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `minLevel` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `mode` ENUM('SOLO', 'TEAM') NOT NULL DEFAULT 'SOLO',
    ADD COLUMN `openToAll` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `totalValue` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `type` ENUM('MAIN', 'DAILY') NOT NULL DEFAULT 'MAIN';

-- AlterTable
ALTER TABLE `QuestProgress` DROP COLUMN `questId`,
    ADD COLUMN `runId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Reward` ADD COLUMN `price` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `exp` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `level` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `nickname` VARCHAR(191) NULL,
    MODIFY `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE `Redemption`;

-- CreateTable
CREATE TABLE `QuestAssignee` (
    `questId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`questId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestReward` (
    `id` VARCHAR(191) NOT NULL,
    `questId` VARCHAR(191) NOT NULL,
    `rewardId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `QuestReward_questId_idx`(`questId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestPrerequisite` (
    `questId` VARCHAR(191) NOT NULL,
    `requiredQuestId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`questId`, `requiredQuestId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestFavorite` (
    `questId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`questId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestRun` (
    `id` VARCHAR(191) NOT NULL,
    `questId` VARCHAR(191) NOT NULL,
    `periodKey` VARCHAR(191) NOT NULL,
    `ownerKey` VARCHAR(191) NOT NULL,
    `status` ENUM('IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'EXPIRED') NOT NULL DEFAULT 'IN_PROGRESS',
    `currentAmount` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NULL,
    `submitNote` TEXT NULL,
    `submittedById` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `reviewComment` TEXT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuestRun_status_expiresAt_idx`(`status`, `expiresAt`),
    UNIQUE INDEX `QuestRun_questId_periodKey_ownerKey_key`(`questId`, `periodKey`, `ownerKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestRunMember` (
    `runId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expEarned` INTEGER NOT NULL DEFAULT 0,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuestRunMember_userId_idx`(`userId`),
    PRIMARY KEY (`runId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LevelReward` (
    `id` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL,
    `rewardId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `LevelReward_level_idx`(`level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GiftBox` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `source` ENUM('QUEST', 'LEVEL_UP') NOT NULL,
    `runId` VARCHAR(191) NULL,
    `level` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `totalValue` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('UNOPENED', 'OPENED', 'EXPIRED') NOT NULL DEFAULT 'UNOPENED',
    `expiresAt` DATETIME(3) NULL,
    `openedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GiftBox_userId_status_idx`(`userId`, `status`),
    INDEX `GiftBox_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GiftBoxItem` (
    `id` VARCHAR(191) NOT NULL,
    `boxId` VARCHAR(191) NOT NULL,
    `rewardId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `price` INTEGER NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Quest_isActive_type_idx` ON `Quest`(`isActive`, `type`);

-- AddForeignKey
ALTER TABLE `QuestAssignee` ADD CONSTRAINT `QuestAssignee_questId_fkey` FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestAssignee` ADD CONSTRAINT `QuestAssignee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestReward` ADD CONSTRAINT `QuestReward_questId_fkey` FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestReward` ADD CONSTRAINT `QuestReward_rewardId_fkey` FOREIGN KEY (`rewardId`) REFERENCES `Reward`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestPrerequisite` ADD CONSTRAINT `QuestPrerequisite_questId_fkey` FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestPrerequisite` ADD CONSTRAINT `QuestPrerequisite_requiredQuestId_fkey` FOREIGN KEY (`requiredQuestId`) REFERENCES `Quest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestFavorite` ADD CONSTRAINT `QuestFavorite_questId_fkey` FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestFavorite` ADD CONSTRAINT `QuestFavorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestRun` ADD CONSTRAINT `QuestRun_questId_fkey` FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestRun` ADD CONSTRAINT `QuestRun_submittedById_fkey` FOREIGN KEY (`submittedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestRun` ADD CONSTRAINT `QuestRun_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestRunMember` ADD CONSTRAINT `QuestRunMember_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `QuestRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestRunMember` ADD CONSTRAINT `QuestRunMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestProgress` ADD CONSTRAINT `QuestProgress_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `QuestRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_questId_fkey` FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `QuestRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LevelReward` ADD CONSTRAINT `LevelReward_rewardId_fkey` FOREIGN KEY (`rewardId`) REFERENCES `Reward`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiftBox` ADD CONSTRAINT `GiftBox_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiftBox` ADD CONSTRAINT `GiftBox_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `QuestRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiftBoxItem` ADD CONSTRAINT `GiftBoxItem_boxId_fkey` FOREIGN KEY (`boxId`) REFERENCES `GiftBox`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiftBoxItem` ADD CONSTRAINT `GiftBoxItem_rewardId_fkey` FOREIGN KEY (`rewardId`) REFERENCES `Reward`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
