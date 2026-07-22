-- CreateEnum
CREATE TYPE "QuoteBehavior" AS ENUM ('NEVER', 'MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('NOT_NEEDED', 'NEEDS_MANUAL_QUOTE', 'PENDING_APPROVAL', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "addedToTimesheet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quoteAmount" DECIMAL(10,2),
ADD COLUMN     "quoteRespondedAt" TIMESTAMP(3),
ADD COLUMN     "quoteStatus" "QuoteStatus" NOT NULL DEFAULT 'NOT_NEEDED',
ADD COLUMN     "quoteToken" TEXT;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "payeNr" TEXT,
ADD COLUMN     "registrationNr" TEXT,
ADD COLUMN     "taxNr" TEXT,
ADD COLUMN     "vatNr" TEXT;

-- AlterTable
ALTER TABLE "request_types" ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "quoteBehavior" "QuoteBehavior" NOT NULL DEFAULT 'NEVER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "requiresTimesheetCheck" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "actions_quoteToken_key" ON "actions"("quoteToken");

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");

