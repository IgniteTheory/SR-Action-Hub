import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

// Public, unauthenticated: this is the page a client lands on from their
// quote link, so it must work without a login.
const actionInclude = {
  client: true,
  requestType: true
};

router.get('/:token', async (req, res) => {
  const action = await prisma.action.findFirst({
    where: { quoteToken: req.params.token, deletedAt: null },
    include: actionInclude
  });
  if (!action) {
    res.status(404).json({ error: 'Quote not found' });
    return;
  }

  res.json({
    quote: {
      ticketNumber: action.ticketNumber,
      clientName: action.client.name,
      requestType: action.requestType.name,
      description: action.description,
      quoteAmount: action.quoteAmount,
      quoteStatus: action.quoteStatus,
      quoteRespondedAt: action.quoteRespondedAt
    }
  });
});

const respondSchema = z.object({ decision: z.enum(['ACCEPTED', 'DECLINED']) });

router.post('/:token/respond', async (req, res) => {
  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'decision must be ACCEPTED or DECLINED' });
    return;
  }

  const action = await prisma.action.findFirst({
    where: { quoteToken: req.params.token, deletedAt: null }
  });
  if (!action) {
    res.status(404).json({ error: 'Quote not found' });
    return;
  }
  if (action.quoteStatus !== 'PENDING_APPROVAL') {
    res.status(400).json({ error: 'This quote has already been responded to.' });
    return;
  }

  const updated = await prisma.action.update({
    where: { id: action.id },
    data: {
      quoteStatus: parsed.data.decision,
      quoteRespondedAt: new Date(),
      statusHistory: {
        create: [{
          fromStatus: action.status,
          toStatus: action.status,
          // No authenticated user on this path — attribute the change to
          // whoever created the action, since the client themself has no account.
          changedById: action.createdById,
          note: `Client ${parsed.data.decision === 'ACCEPTED' ? 'accepted' : 'declined'} the quote`
        }]
      }
    }
  });

  res.json({
    quote: {
      quoteStatus: updated.quoteStatus,
      quoteRespondedAt: updated.quoteRespondedAt
    }
  });
});

export default router;
