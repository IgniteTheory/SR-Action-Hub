-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "acknowledgementEmailError" TEXT,
ADD COLUMN     "acknowledgementEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "quoteEmailError" TEXT,
ADD COLUMN     "quoteEmailSentAt" TIMESTAMP(3);

