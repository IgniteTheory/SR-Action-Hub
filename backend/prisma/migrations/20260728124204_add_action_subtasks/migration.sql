-- CreateTable
CREATE TABLE "action_subtasks" (
    "id" SERIAL NOT NULL,
    "actionId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_subtasks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "action_subtasks" ADD CONSTRAINT "action_subtasks_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

