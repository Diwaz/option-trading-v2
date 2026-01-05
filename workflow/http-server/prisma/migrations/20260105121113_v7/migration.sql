/*
  Warnings:

  - You are about to drop the column `closedTIme` on the `Trade` table. All the data in the column will be lost.
  - Added the required column `closedTime` to the `Trade` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Trade" DROP COLUMN "closedTIme",
ADD COLUMN     "closedTime" TEXT NOT NULL;
