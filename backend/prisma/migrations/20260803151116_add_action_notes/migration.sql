-- CreateTable
CREATE TABLE "action_notes" (
    "id" SERIAL NOT NULL,
    "actionId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "action_notes" ADD CONSTRAINT "action_notes_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_notes" ADD CONSTRAINT "action_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
