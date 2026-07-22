import { prisma } from '../db';

// Generates ACT-YYYY-NNNNNN, atomically incrementing per calendar year, never reused.
export async function nextTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();

  const counter = await prisma.$transaction(async (tx) => {
    const existing = await tx.ticketCounter.upsert({
      where: { year },
      update: { lastNumber: { increment: 1 } },
      create: { year, lastNumber: 1 }
    });
    return existing;
  });

  return `ACT-${year}-${String(counter.lastNumber).padStart(6, '0')}`;
}
