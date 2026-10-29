-- AlterTable
ALTER TABLE "public"."Account" ADD COLUMN     "sessionToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Account_sessionToken_key" ON "public"."Account"("sessionToken");

