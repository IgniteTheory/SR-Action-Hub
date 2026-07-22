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

const updateSchema = z.object({
  quoteBehavior: z.enum(['NEVER', 'MANUAL', 'AUTO']).optional(),
  price: z.number().nullable().optional(),
  isActive: z.boolean().optional()
});

// Chanel (admin) uses this to decide which request types need a quote at all,
// and to put a price on file for the ones the system should auto-quote.
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid update', details: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.requestType.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Request type not found' });
    return;
  }

  // "Other" is inherently unclassified/unpriced work — it must always route to
  // Stephan for a manual quote, so it can't be switched to NEVER or AUTO.
  if (existing.name === 'Other' && parsed.data.quoteBehavior && parsed.data.quoteBehavior !== 'MANUAL') {
    res.status(400).json({ error: '"Other" must stay set to Manual — it always needs Stephan to review and quote.' });
    return;
  }

  const type = await prisma.requestType.update({
    where: { id },
    data: parsed.data
  });
  res.json({ requestType: type });
});

export default router;
