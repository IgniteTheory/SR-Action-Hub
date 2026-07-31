-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "linkedActionId" INTEGER;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "assignedAccountantId" INTEGER;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_assignedAccountantId_fkey" FOREIGN KEY ("assignedAccountantId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_linkedActionId_fkey" FOREIGN KEY ("linkedActionId") REFERENCES "actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

