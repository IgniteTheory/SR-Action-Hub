import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/kpis', requireAuth, async (req, res) => {
  const assignedToId = req.query.assignedToId ? Number(req.query.assignedToId) : undefined;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const baseWhere = { deletedAt: null, ...(assignedToId ? { assignedToId } : {}) };

  const [overdue, dueToday, waiting, completedToday, newActions, approvalPending, completedForAvg] = await Promise.all([
    prisma.action.count({
      where: { ...baseWhere, dueAt: { lt: now }, status: { notIn: ['COMPLETED', 'CANCELLED'] } }
    }),
    prisma.action.count({
      where: { ...baseWhere, dueAt: { gte: startOfToday, lt: endOfToday }, status: { notIn: ['COMPLETED', 'CANCELLED'] } }
    }),
    prisma.action.count({
      where: { ...baseWhere, status: { in: ['WAITING_CLIENT', 'WAITING_SARS', 'WAITING_BANK', 'WAITING_THIRD_PARTY'] } }
    }),
    prisma.action.count({
      where: { ...baseWhere, status: 'COMPLETED', completedAt: { gte: startOfToday, lt: endOfToday } }
    }),
    prisma.action.count({
      where: { ...baseWhere, status: 'NEW' }
    }),
    prisma.action.count({
      where: { ...baseWhere, quoteStatus: { in: ['NEEDS_MANUAL_QUOTE', 'NEEDS_INTERNAL_APPROVAL', 'PENDING_APPROVAL'] } }
    }),
    prisma.action.findMany({
      where: { ...baseWhere, status: 'COMPLETED', completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
      take: 200,
      orderBy: { completedAt: 'desc' }
    })
  ]);

  let avgTurnaroundHours: number | null = null;
  if (completedForAvg.length) {
    const totalMs = completedForAvg.reduce((sum, a) => sum + (a.completedAt!.getTime() - a.createdAt.getTime()), 0);
    avgTurnaroundHours = Math.round((totalMs / completedForAvg.length / (1000 * 60 * 60)) * 10) / 10;
  }

  res.json({
    overdue,
    dueToday,
    waiting,
    completedToday,
    newActions,
    approvalPending,
    avgTurnaroundHours
  });
});

export default router;
