import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { computeTotal } from '../lib/stateMachine';

const router = Router();

router.use(requireAuth);

/**
 * POST /api/requisitions/:id/approvers
 * Approver-only: assign an approver to a requisition.
 * Body: { approver_id: string }
 */
router.post('/:id/approvers', requireRole('approver'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { approver_id } = req.body;

    if (!approver_id) {
      res.status(400).json({ error: 'approver_id is required' });
      return;
    }

    const requisition = await prisma.requisition.findUnique({ where: { id } });
    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    // Verify the target user is actually an approver
    const targetUser = await prisma.user.findUnique({ where: { id: String(approver_id) } });
    if (!targetUser || targetUser.role !== 'approver') {
      res.status(400).json({ error: 'Target user is not an approver' });
      return;
    }

    // Check if already assigned
    const existing = await prisma.requisitionApprover.findUnique({
      where: { requisition_id_approver_id: { requisition_id: id, approver_id: String(approver_id) } }
    });

    if (existing) {
      res.status(400).json({ error: 'This approver is already assigned to this requisition' });
      return;
    }

    await prisma.requisitionApprover.create({
      data: { requisition_id: id, approver_id: String(approver_id) }
    });

    // Return updated approver list
    const approvers = await prisma.requisitionApprover.findMany({
      where: { requisition_id: id },
      include: { approver: { select: { id: true, name: true, email: true, approval_limit: true } } }
    });

    res.status(201).json(approvers);
  } catch (error) {
    console.error('Add approver error:', error);
    res.status(500).json({ error: 'Failed to add approver' });
  }
});

/**
 * DELETE /api/requisitions/:id/approvers/:approverId
 * Approver-only: remove an approver assignment.
 */
router.delete('/:id/approvers/:approverId', requireRole('approver'), async (req: Request<{ id: string; approverId: string }>, res: Response): Promise<void> => {
  try {
    const { id, approverId } = req.params;

    const existing = await prisma.requisitionApprover.findUnique({
      where: { requisition_id_approver_id: { requisition_id: id, approver_id: approverId } }
    });

    if (!existing) {
      res.status(404).json({ error: 'Approver assignment not found' });
      return;
    }

    await prisma.requisitionApprover.delete({
      where: { requisition_id_approver_id: { requisition_id: id, approver_id: approverId } }
    });

    // Return updated approver list
    const approvers = await prisma.requisitionApprover.findMany({
      where: { requisition_id: id },
      include: { approver: { select: { id: true, name: true, email: true, approval_limit: true } } }
    });

    res.json(approvers);
  } catch (error) {
    console.error('Remove approver error:', error);
    res.status(500).json({ error: 'Failed to remove approver' });
  }
});

/**
 * GET /api/requisitions/:id/approvers
 * Any authenticated user who is the owner or an approver can view the list.
 */
router.get('/:id/approvers', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const requisition = await prisma.requisition.findUnique({ where: { id } });
    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    // Owner or any approver can view
    if (req.user!.role !== 'approver' && requisition.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const approvers = await prisma.requisitionApprover.findMany({
      where: { requisition_id: id },
      include: { approver: { select: { id: true, name: true, email: true, approval_limit: true } } }
    });

    res.json(approvers);
  } catch (error) {
    console.error('List approvers error:', error);
    res.status(500).json({ error: 'Failed to list approvers' });
  }
});

/**
 * GET /api/queues/submitted
 * Approver-only: all requisitions with status "submitted".
 */
router.get('/queues/submitted', requireRole('approver'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const requisitions = await prisma.requisition.findMany({
      where: { status: 'submitted' },
      include: {
        line_items: true,
        owner: { select: { id: true, name: true, email: true } },
        approvers: { include: { approver: { select: { id: true, name: true, email: true } } } }
      },
      orderBy: { created_at: 'desc' }
    });

    const enriched = requisitions.map(r => ({
      ...r,
      total: computeTotal(r.line_items)
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Submitted queue error:', error);
    res.status(500).json({ error: 'Failed to fetch submitted queue' });
  }
});

/**
 * GET /api/queues/assigned-to-me
 * Approver-only: submitted requisitions where the current user is in the approvers list.
 */
router.get('/queues/assigned-to-me', requireRole('approver'), async (req: Request, res: Response): Promise<void> => {
  try {
    const requisitions = await prisma.requisition.findMany({
      where: {
        status: 'submitted',
        approvers: {
          some: { approver_id: req.user!.id }
        }
      },
      include: {
        line_items: true,
        owner: { select: { id: true, name: true, email: true } },
        approvers: { include: { approver: { select: { id: true, name: true, email: true } } } }
      },
      orderBy: { created_at: 'desc' }
    });

    const enriched = requisitions.map(r => ({
      ...r,
      total: computeTotal(r.line_items)
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Assigned queue error:', error);
    res.status(500).json({ error: 'Failed to fetch assigned queue' });
  }
});

export default router;
