import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const search = String(req.query.search || '').trim();
  const clients = await prisma.client.findMany({
    where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
    include: { contacts: true },
    orderBy: { name: 'asc' },
    take: 50
  });
  res.json({ clients });
});

router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: true,
      actions: {
        orderBy: { createdAt: 'desc' },
        include: { assignedTo: true, requestType: true }
      }
    }
  });
  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }
  res.json({ client });
});

const createSchema = z.object({
  name: z.string().min(1),
  contact: z
    .object({
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().optional()
    })
    .optional()
});

router.post('/', requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Client name is required' });
    return;
  }
  const { name, contact } = parsed.data;
  const client = await prisma.client.create({
    data: {
      name,
      contacts: contact ? { create: [contact] } : undefined
    },
    include: { contacts: true }
  });
  res.status(201).json({ client });
});

const contactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional()
});

router.post('/:id/contacts', requireAuth, async (req, res) => {
  const clientId = Number(req.params.id);
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Contact name is required' });
    return;
  }
  const contact = await prisma.contact.create({ data: { ...parsed.data, clientId } });
  res.status(201).json({ contact });
});

export default router;
