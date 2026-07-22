import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAdmin, requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  const types = await prisma.requestType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });
  res.json({ requestTypes: types });
});

const createSchema = z.object({ name: z.string().min(1) });

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  const type = await prisma.requestType.upsert({
    where: { name: parsed.data.name },
    update: { isActive: true },
    create: { name: parsed.data.name }
  });
  res.status(201).json({ requestType: type });
});

export default router;
