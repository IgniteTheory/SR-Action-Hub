import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { nextTicketNumber } from '../lib/ticketNumber';
import { calculateDueDate } from '../lib/dueDate';
import { generateQuoteToken } from '../lib/quoteToken';
import { sendCompletionEmail } from '../lib/email';

const router = Router();

const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  colour: true,
  requiresTimesheetCheck: true
} satisfies Prisma.UserSelect;

const actionInclude = {
  client: true,
  contact: true,
  requestType: true,
  assignedTo: { select: userSummarySelect },
  createdBy: { select: userSummarySelect }
} satisfies Prisma.ActionInclude;

router.get('/', requireAuth, async (req, res) => {
  const { search, status, assignedToId, priority, filter } = req.query as Record<string, string | undefined>;

  const where: Prisma.ActionWhereInput = { deletedAt: null };
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  if (status) where.status = status as Prisma.EnumActionStatusFilter['equals'];
  if (priority) where.priority = priority as Prisma.EnumPriorityFilter['equals'];
  if (assignedToId) where.assignedToId = Number(assignedToId);

  if (search) {
    where.OR = [
      { ticketNumber: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { contactPerson: { contains: search, mode: 'insensitive' } },
      { telephone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { client: { name: { contains: search, mode: 'insensitive' } } }
    ];
  }

  switch (filter) {
    case 'mine':
      where.assignedToId = req.user!.id;
      break;
    case 'today':
      where.dueAt = { gte: startOfToday, lt: endOfToday };
      break;
    case 'urgent':
      where.priority = { in: ['CRITICAL', 'HIGH'] };
      break;
    case 'overdue':
      where.dueAt = { lt: now };
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
      break;
    case 'completed':
      where.status = 'COMPLETED';
      break;
    case 'waiting':
      where.status = { in: ['WAITING_CLIENT', 'WAITING_SARS', 'WAITING_BANK', 'WAITING_THIRD_PARTY'] };
      break;
    case 'snoozed':
      where.status = 'SNOOZED';
      break;
    case 'unallocated':
      where.assignedToId = null;
      break;
    case 'quote-needed':
      where.quoteStatus = 'NEEDS_MANUAL_QUOTE';
      break;
    case 'needs-internal-approval':
      where.quoteStatus = 'NEEDS_INTERNAL_APPROVAL';
      break;
    case 'approval-pending':
      where.quoteStatus = 'PENDING_APPROVAL';
      break;
  }

  const actions = await prisma.action.findMany({
    where,
    include: actionInclude,
    orderBy: [{ dueAt: 'asc' }],
    take: 200
  });

  res.json({ actions });
});

router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const action = await prisma.action.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...actionInclude,
      statusHistory: { include: { changedBy: { select: userSummarySelect } }, orderBy: { changedAt: 'asc' } }
    }
  });
  if (!action) {
    res.status(404).json({ error: 'Action not found' });
    return;
  }
  res.json({ action });
});

const createSchema = z.object({
  clientId: z.number().optional(),
  newClientName: z.string().optional(),
  contactId: z.number().optional(),
  contactPerson: z.string().min(1),
  telephone: z.string().optional(),
  email: z.string().optional(),
  communicationSource: z.enum(['PHONE', 'EMAIL', 'WHATSAPP', 'WALK_IN', 'TEAMS', 'INTERNAL', 'OTHER']),
  requestTypeId: z.number(),
  otherRequestDetail: z.string().optional(),
  description: z.string().min(1),
  assignedToId: z.number().nullable().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']),
  turnaround: z.enum(['URGENT', 'HOURS_2_3', 'TODAY', 'DAY_1', 'DAYS_2_3', 'WEEK_1', 'CUSTOM', 'CUSTOM_DATE']),
  customTurnaroundHours: z.number().optional(),
  customDueDate: z.string().optional(),
  sendAcknowledgement: z.boolean().optional()
});

router.post('/', requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid action data', details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;

  if (!data.clientId && !data.newClientName) {
    res.status(400).json({ error: 'clientId or newClientName is required' });
    return;
  }

  let clientId = data.clientId;
  if (!clientId && data.newClientName) {
    const client = await prisma.client.create({ data: { name: data.newClientName } });
    clientId = client.id;
  }

  const requestType = await prisma.requestType.findUnique({ where: { id: data.requestTypeId } });
  if (!requestType) {
    res.status(400).json({ error: 'Invalid request type' });
    return;
  }

  // Quote behaviour drives allocation: MANUAL (new/unpriced work, always true for
  // "Other") force-allocates to Stephan and flags it for him to quote; AUTO (a
  // priced request type) drafts a quote from the price list, but it sits with
  // Stephan for internal approval first — the client-facing link only gets
  // created once he approves (see POST /:id/approve-quote); NEVER leaves the
  // action to be allocated/worked as normal.
  let assignedToId = data.assignedToId ?? null;
  let quoteStatus: 'NOT_NEEDED' | 'NEEDS_MANUAL_QUOTE' | 'NEEDS_INTERNAL_APPROVAL' = 'NOT_NEEDED';
  let quoteAmount: Prisma.Decimal | null = null;
  let quoteNote: string | null = null;

  if (requestType.quoteBehavior === 'MANUAL') {
    const stephan = await prisma.user.findFirst({ where: { name: 'Stephan' } });
    if (stephan) assignedToId = stephan.id;
    quoteStatus = 'NEEDS_MANUAL_QUOTE';
    quoteNote = 'Flagged for Stephan — new/unpriced request, needs a quote drawn up';
  } else if (requestType.quoteBehavior === 'AUTO') {
    quoteAmount = requestType.price;
    quoteStatus = 'NEEDS_INTERNAL_APPROVAL';
    quoteNote = 'Quote drafted from the price list — awaiting Stephan’s approval before it’s sent to the client';
  }

  const ticketNumber = await nextTicketNumber();
  const dueAt = calculateDueDate(
    data.turnaround,
    data.customTurnaroundHours ?? null,
    new Date(),
    data.customDueDate ? new Date(data.customDueDate) : null
  );
  const status: 'ALLOCATED' | 'NEW' = assignedToId ? 'ALLOCATED' : 'NEW';

  const historyEntries: Prisma.StatusHistoryUncheckedCreateWithoutActionInput[] = [
    { toStatus: status, changedById: req.user!.id, note: 'Action created' }
  ];
  if (quoteNote) {
    historyEntries.push({ toStatus: status, changedById: req.user!.id, note: quoteNote });
  }

  const action = await prisma.action.create({
    data: {
      ticketNumber,
      clientId: clientId!,
      contactId: data.contactId,
      contactPerson: data.contactPerson,
      telephone: data.telephone,
      email: data.email,
      communicationSource: data.communicationSource,
      requestTypeId: data.requestTypeId,
      otherRequestDetail: data.otherRequestDetail,
      description: data.description,
      assignedToId,
      priority: data.priority,
      turnaround: data.turnaround,
      customTurnaroundHours: data.customTurnaroundHours,
      dueAt,
      status,
      sendAcknowledgement: data.sendAcknowledgement ?? false,
      quoteStatus,
      quoteAmount,
      createdById: req.user!.id,
      statusHistory: {
        create: historyEntries
      }
    },
    include: actionInclude
  });

  res.status(201).json({ action });
});

const updateSchema = z.object({
  contactPerson: z.string().min(1).optional(),
  telephone: z.string().optional(),
  email: z.string().optional(),
  requestTypeId: z.number().optional(),
  description: z.string().min(1).optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']).optional(),
  assignedToId: z.number().nullable().optional(),
  addedToTimesheet: z.boolean().optional()
});

router.patch('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid update', details: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.action.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    res.status(404).json({ error: 'Action not found' });
    return;
  }

  const data = parsed.data;
  const reassigned = 'assignedToId' in data && data.assignedToId !== existing.assignedToId;

  const action = await prisma.action.update({
    where: { id },
    data: {
      ...data,
      status: reassigned && data.assignedToId && existing.status === 'NEW' ? 'ALLOCATED' : undefined
    },
    include: actionInclude
  });

  if (reassigned) {
    await prisma.statusHistory.create({
      data: {
        actionId: id,
        toStatus: action.status,
        changedById: req.user!.id,
        note: data.assignedToId
          ? `Allocated to ${(await prisma.user.findUnique({ where: { id: data.assignedToId! } }))?.name ?? 'user'}`
          : 'Unallocated'
      }
    });
  }

  res.json({ action });
});

const statusSchema = z.object({
  status: z.enum([
    'NEW', 'ALLOCATED', 'IN_PROGRESS', 'WAITING_CLIENT', 'WAITING_SARS',
    'WAITING_BANK', 'WAITING_THIRD_PARTY', 'SNOOZED', 'COMPLETED', 'CANCELLED'
  ]),
  note: z.string().optional()
});

router.post('/:id/status', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const existing = await prisma.action.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    res.status(404).json({ error: 'Action not found' });
    return;
  }

  const { status, note } = parsed.data;

  // Main purpose of this app: ad-hoc work for Daniella/Sunanne can't be marked
  // complete until it's been ticked off as added to the time sheet.
  if (status === 'COMPLETED' && existing.assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: existing.assignedToId } });
    if (assignee?.requiresTimesheetCheck && !existing.addedToTimesheet) {
      res.status(400).json({ error: 'Add to Time Sheet must be checked before this action can be completed.' });
      return;
    }
  }

  let action = await prisma.action.update({
    where: { id },
    data: {
      status,
      completedAt: status === 'COMPLETED' ? new Date() : null,
      snoozeUntil: status === 'SNOOZED' ? existing.snoozeUntil : null,
      snoozeReason: status === 'SNOOZED' ? existing.snoozeReason : null,
      statusHistory: {
        create: [{ fromStatus: existing.status, toStatus: status, changedById: req.user!.id, note }]
      }
    },
    include: actionInclude
  });

  // Let the client know as soon as their request is completed/handed over.
  // A mail hiccup shouldn't undo the status change, so failures are recorded
  // on the action instead of failing this request.
  if (status === 'COMPLETED' && action.email) {
    try {
      await sendCompletionEmail({
        ticketNumber: action.ticketNumber,
        clientName: action.client.name,
        contactName: action.contactPerson,
        contactEmail: action.email,
        description: action.description
      });
      action = await prisma.action.update({
        where: { id },
        data: { completionEmailSentAt: new Date(), completionEmailError: null },
        include: actionInclude
      });
    } catch (err) {
      action = await prisma.action.update({
        where: { id },
        data: { completionEmailError: err instanceof Error ? err.message : 'Failed to send completion email' },
        include: actionInclude
      });
    }
  }

  res.json({ action });
});

const snoozeSchema = z.object({
  snoozeUntil: z.string(),
  reason: z.string().min(1)
});

router.post('/:id/snooze', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = snoozeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'snoozeUntil and reason are required' });
    return;
  }
  const existing = await prisma.action.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    res.status(404).json({ error: 'Action not found' });
    return;
  }

  const action = await prisma.action.update({
    where: { id },
    data: {
      status: 'SNOOZED',
      snoozeUntil: new Date(parsed.data.snoozeUntil),
      snoozeReason: parsed.data.reason,
      statusHistory: {
        create: [{
          fromStatus: existing.status,
          toStatus: 'SNOOZED',
          changedById: req.user!.id,
          note: `Snoozed until ${new Date(parsed.data.snoozeUntil).toLocaleDateString()} — ${parsed.data.reason}`
        }]
      }
    },
    include: actionInclude
  });

  res.json({ action });
});

const quoteStatusSchema = z.object({
  quoteStatus: z.enum(['NOT_NEEDED', 'NEEDS_MANUAL_QUOTE', 'NEEDS_INTERNAL_APPROVAL', 'PENDING_APPROVAL', 'ACCEPTED', 'DECLINED']),
  quoteAmount: z.number().nullable().optional(),
  // Lets Stephan give the client an estimated timeline as part of a manual
  // quote — reuses the action's own due date rather than a parallel field.
  dueDate: z.string().nullable().optional()
});

// Lets Stephan (or an admin) move a manually-quoted action through its
// lifecycle by hand, since a MANUAL quote has no client-facing accept/decline
// link — e.g. clear NEEDS_MANUAL_QUOTE to PENDING_APPROVAL once he's sent the
// quote himself, then later record ACCEPTED/DECLINED after following up.
router.post('/:id/quote-status', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = quoteStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid quote status' });
    return;
  }
  const existing = await prisma.action.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    res.status(404).json({ error: 'Action not found' });
    return;
  }

  const { quoteStatus, quoteAmount, dueDate } = parsed.data;
  const isResponse = quoteStatus === 'ACCEPTED' || quoteStatus === 'DECLINED';

  const action = await prisma.action.update({
    where: { id },
    data: {
      quoteStatus,
      quoteAmount: quoteAmount === undefined ? undefined : quoteAmount,
      quoteRespondedAt: isResponse ? new Date() : existing.quoteRespondedAt,
      dueAt: dueDate ? new Date(dueDate) : undefined,
      turnaround: dueDate ? 'CUSTOM_DATE' : undefined,
      statusHistory: {
        create: [{
          fromStatus: existing.status,
          toStatus: existing.status,
          changedById: req.user!.id,
          note: dueDate
            ? `Quote status updated to ${quoteStatus} — estimated due ${new Date(dueDate).toLocaleDateString()}`
            : `Quote status updated to ${quoteStatus}`
        }]
      }
    },
    include: actionInclude
  });

  res.json({ action });
});

const approveQuoteSchema = z.object({ quoteAmount: z.number().nullable().optional() });

// The one place a client-facing quote token gets created: Stephan approving
// an AUTO-drafted quote. Nothing else on an AUTO quote is client-visible
// until this fires, so the public link genuinely doesn't exist until then.
router.post('/:id/approve-quote', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = approveQuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  const existing = await prisma.action.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    res.status(404).json({ error: 'Action not found' });
    return;
  }
  if (existing.quoteStatus !== 'NEEDS_INTERNAL_APPROVAL') {
    res.status(400).json({ error: 'This quote is not awaiting approval.' });
    return;
  }

  const action = await prisma.action.update({
    where: { id },
    data: {
      quoteStatus: 'PENDING_APPROVAL',
      quoteToken: generateQuoteToken(),
      quoteAmount: parsed.data.quoteAmount === undefined ? undefined : parsed.data.quoteAmount,
      statusHistory: {
        create: [{
          fromStatus: existing.status,
          toStatus: existing.status,
          changedById: req.user!.id,
          note: 'Quote approved by Stephan and sent to the client'
        }]
      }
    },
    include: actionInclude
  });

  res.json({ action });
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.action.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    res.status(404).json({ error: 'Action not found' });
    return;
  }
  await prisma.action.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: req.user!.id }
  });
  res.json({ ok: true });
});

router.post('/:id/restore', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const action = await prisma.action.update({
    where: { id },
    data: { deletedAt: null, deletedById: null },
    include: actionInclude
  });
  res.json({ action });
});

router.get('/deleted/list', requireAuth, requireAdmin, async (_req, res) => {
  const actions = await prisma.action.findMany({
    where: { deletedAt: { not: null } },
    include: actionInclude,
    orderBy: { deletedAt: 'desc' }
  });
  res.json({ actions });
});

export default router;
