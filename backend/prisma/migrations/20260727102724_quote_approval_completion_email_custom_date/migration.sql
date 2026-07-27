-- AlterEnum
ALTER TYPE "QuoteStatus" ADD VALUE 'NEEDS_INTERNAL_APPROVAL';

-- AlterEnum
ALTER TYPE "Turnaround" ADD VALUE 'CUSTOM_DATE';

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "completionEmailError" TEXT,
ADD COLUMN     "completionEmailSentAt" TIMESTAMP(3);

