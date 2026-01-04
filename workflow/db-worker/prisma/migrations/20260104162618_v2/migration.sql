/*
  Warnings:

  - Added the required column `leverage` to the `Trade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `margin` to the `Trade` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `buyPrice` on the `Trade` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "leverage" INTEGER NOT NULL,
ADD COLUMN     "margin" INTEGER NOT NULL,
DROP COLUMN "buyPrice",
ADD COLUMN     "buyPrice" INTEGER NOT NULL;
