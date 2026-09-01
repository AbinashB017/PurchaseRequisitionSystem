import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { executeTransition, writeAuditEvent, TransitionError, computeTotal } from '../lib/stateMachine';

const router = Router();

// All lifecycle routes require authentication
router.use(requireAuth);

/**
 * POST /api/requisitions/:id/submit
 * Owner only. draft -> submitted. Requires at least one line item.
 */
router.post('/:id/submit', requireRole('requester'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: { line_items: true }
    });

    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    if (requisition.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Only the owner can submit a requisition' });
      return;
    }

    if (requisition.line_items.length === 0) {
      res.status(400).json({ error: 'Cannot submit a requisition with no line items' });
      return;
    }

    const updated = await executeTransition({
      requisitionId: id,
      fromStatus: requisition.status,
      toStatus: 'submitted',
      actorId: req.user!.id,
      auditType: 'status_change',
    });

    res.json({ ...updated, total: computeTotal(updated.line_items) });
  } catch (error) {
    if (error instanceof TransitionError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Submit error:', error);
    res.status(500).json({ error: 'Failed to submit requisition' });
  }
});

/**
 * POST /api/requisitions/:id/approve
 * Approver only. submitted -> approved. Checks approval_limit.
 * Any approver can approve — assignment only affects queue visibility.
 */
router.post('/:id/approve', requireRole('approver'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: { line_items: true }
    });

    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    // Check approval_limit
    const total = computeTotal(requisition.line_items);
    const approverLimit = req.user!.approval_limit ? Number(req.user!.approval_limit) : null;

    if (approverLimit !== null && total > approverLimit) {
      res.status(403).json({
        error: `This requisition's total ($${total.toFixed(2)}) exceeds your approval limit ($${approverLimit.toFixed(2)}). A higher-level approver is required.`
      });
      return;
    }

    const updated = await executeTransition({
      requisitionId: id,
      fromStatus: requisition.status,
      toStatus: 'approved',
      actorId: req.user!.id,
      auditType: 'status_change',
      metadata: { approved_total: total }
    });

    res.json({ ...updated, total: computeTotal(updated.line_items) });
  } catch (error) {
    if (error instanceof TransitionError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Failed to approve requisition' });
  }
});

/**
 * POST /api/requisitions/:id/reject
 * Approver only. submitted -> draft. Requires a non-empty reason.
 * Single atomic AuditEvent with old_status="submitted", new_status="draft",
 * reason populated, metadata: { action: "rejected" }.
 */
router.post('/:id/reject', requireRole('approver'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ error: 'A rejection reason is required' });
      return;
    }

    const requisition = await prisma.requisition.findUnique({ where: { id } });

    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    const updated = await executeTransition({
      requisitionId: id,
      fromStatus: requisition.status,
      toStatus: 'draft',
      actorId: req.user!.id,
      auditType: 'status_change',
      reason: reason.trim(),
      metadata: { action: 'rejected' }
    });

    res.json({ ...updated, total: computeTotal(updated.line_items) });
  } catch (error) {
    if (error instanceof TransitionError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Failed to reject requisition' });
  }
});

/**
 * POST /api/requisitions/:id/order
 * Approver only. approved -> ordered.
 */
router.post('/:id/order', requireRole('approver'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requisition = await prisma.requisition.findUnique({ where: { id } });

    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    const updated = await executeTransition({
      requisitionId: id,
      fromStatus: requisition.status,
      toStatus: 'ordered',
      actorId: req.user!.id,
      auditType: 'status_change',
    });

    res.json({ ...updated, total: computeTotal(updated.line_items) });
  } catch (error) {
    if (error instanceof TransitionError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Order error:', error);
    res.status(500).json({ error: 'Failed to mark requisition as ordered' });
  }
});

/**
 * POST /api/requisitions/:id/extend-needed-by
 * Approver only. Only when status is "ordered".
 * New date must be later than the current needed_by_date.
 */
router.post('/:id/extend-needed-by', requireRole('approver'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { needed_by_date } = req.body;

    if (!needed_by_date) {
      res.status(400).json({ error: 'New needed_by_date is required' });
      return;
    }

    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: { line_items: true }
    });

    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    if (requisition.status !== 'ordered') {
      res.status(400).json({ error: 'Can only extend the needed-by date for ordered requisitions' });
      return;
    }

    const newDate = new Date(needed_by_date);
    const currentDate = new Date(requisition.needed_by_date);

    if (newDate <= currentDate) {
      res.status(400).json({
        error: `New date must be later than the current needed-by date (${currentDate.toISOString().split('T')[0]})`
      });
      return;
    }

    // Update the date and write an audit event
    const updated = await prisma.$transaction(async (tx) => {
      const updatedReq = await tx.requisition.update({
        where: { id },
        data: { needed_by_date: newDate },
        include: {
          line_items: true,
          approvers: { include: { approver: { select: { id: true, name: true, email: true } } } },
          owner: { select: { id: true, name: true, email: true } }
        }
      });

      await tx.auditEvent.create({
        data: {
          requisition_id: id,
          type: 'status_change',
          actor_id: req.user!.id,
          old_status: 'ordered',
          new_status: 'ordered',
          metadata: {
            action: 'extend_needed_by',
            old_date: currentDate.toISOString().split('T')[0],
            new_date: newDate.toISOString().split('T')[0]
          }
        }
      });

      return updatedReq;
    });

    res.json({ ...updated, total: computeTotal(updated.line_items) });
  } catch (error) {
    console.error('Extend needed-by error:', error);
    res.status(500).json({ error: 'Failed to extend needed-by date' });
  }
});

/**
 * POST /api/requisitions/:id/receive
 * Approver only. Status must be "ordered".
 * Incremental: adds received_quantity to the line's existing received_qty.
 * Validates new total never exceeds ordered_qty.
 * Auto-transitions to "received" once every line is fully received.
 */
router.post('/:id/receive', requireRole('approver'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { line_item_id, received_quantity } = req.body;

    if (!line_item_id || received_quantity === undefined || received_quantity === null) {
      res.status(400).json({ error: 'line_item_id and received_quantity are required' });
      return;
    }

    const qty = Number(received_quantity);
    if (isNaN(qty) || qty <= 0) {
      res.status(400).json({ error: 'received_quantity must be a positive number' });
      return;
    }

    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: { line_items: true }
    });

    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    if (requisition.status !== 'ordered') {
      res.status(400).json({ error: 'Can only receive items for ordered requisitions' });
      return;
    }

    const lineItemId = String(line_item_id);
    const line = requisition.line_items.find((l: any) => l.id === lineItemId);
    if (!line) {
      res.status(404).json({ error: 'Line item not found in this requisition' });
      return;
    }

    const currentReceived = Number(line.received_qty);
    const ordered = Number(line.ordered_qty);
    const newTotal = currentReceived + qty;

    if (newTotal > ordered) {
      res.status(400).json({
        error: `Cannot receive ${qty}. Already received ${currentReceived} of ${ordered} ordered. Maximum additional: ${(ordered - currentReceived).toFixed(2)}`
      });
      return;
    }

    // Update the line item and write audit event, possibly transition status
    const result = await prisma.$transaction(async (tx) => {
      // Update received_qty (incremental)
      await tx.lineItem.update({
        where: { id: lineItemId },
        data: { received_qty: newTotal }
      });

      // Write receipt audit event
      await tx.auditEvent.create({
        data: {
          requisition_id: id,
          type: 'receipt',
          actor_id: req.user!.id,
          metadata: {
            line_item_id: lineItemId,
            line_description: line.description,
            quantity_received: qty,
            new_received_total: newTotal,
            ordered_qty: ordered,
          }
        }
      });

      // Check if ALL lines are now fully received
      const allLines = await tx.lineItem.findMany({
        where: { requisition_id: id }
      });

      const allFullyReceived = allLines.every((l) => {
        const recvd = l.id === lineItemId ? newTotal : Number(l.received_qty);
        return recvd >= Number(l.ordered_qty);
      });

      let updatedReq;
      if (allFullyReceived) {
        // Auto-transition to received
        updatedReq = await tx.requisition.update({
          where: { id },
          data: { status: 'received' },
          include: {
            line_items: true,
            approvers: { include: { approver: { select: { id: true, name: true, email: true } } } },
            owner: { select: { id: true, name: true, email: true } }
          }
        });

        // Write the status change audit event
        await tx.auditEvent.create({
          data: {
            requisition_id: id,
            type: 'status_change',
            actor_id: req.user!.id,
            old_status: 'ordered',
            new_status: 'received',
            metadata: { action: 'auto_received', reason: 'All line items fully received' }
          }
        });
      } else {
        updatedReq = await tx.requisition.findUnique({
          where: { id },
          include: {
            line_items: true,
            approvers: { include: { approver: { select: { id: true, name: true, email: true } } } },
            owner: { select: { id: true, name: true, email: true } }
          }
        });
      }

      return updatedReq!;
    });

    res.json({ ...result, total: computeTotal(result.line_items) });
  } catch (error) {
    console.error('Receive error:', error);
    res.status(500).json({ error: 'Failed to record receipt' });
  }
});

/**
 * POST /api/requisitions/:id/comments
 * Owner or any approver can add a comment.
 * Written as an AuditEvent of type "comment".
 */
router.post('/:id/comments', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      res.status(400).json({ error: 'Comment text is required' });
      return;
    }

    const requisition = await prisma.requisition.findUnique({ where: { id } });
    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    // Only the owner or approvers can comment
    if (req.user!.role !== 'approver' && requisition.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Only the owner or approvers can add comments' });
      return;
    }

    const event = await writeAuditEvent({
      requisitionId: id,
      actorId: req.user!.id,
      type: 'comment',
      commentText: comment.trim(),
    });

    res.status(201).json(event);
  } catch (error) {
    console.error('Comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * GET /api/requisitions/:id/audit-events
 * Returns the full timeline for a requisition, in chronological order.
 * Read-only — no PUT/DELETE routes exist for audit events.
 */
router.get('/:id/audit-events', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const requisition = await prisma.requisition.findUnique({ where: { id } });
    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    // Check access: owner or any approver
    if (req.user!.role !== 'approver' && requisition.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const events = await prisma.auditEvent.findMany({
      where: { requisition_id: id },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } }
      },
      orderBy: { created_at: 'asc' }
    });

    res.json(events);
  } catch (error) {
    console.error('Audit events error:', error);
    res.status(500).json({ error: 'Failed to fetch audit events' });
  }
});

/**
 * POST /api/requisitions/:id/archive
 * Owner or any approver. Sets archived_at = now().
 */
router.post('/:id/archive', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requisition = await prisma.requisition.findUnique({ where: { id } });
    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }
    // Check access: owner or any approver
    if (req.user!.role !== 'approver' && requisition.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Only the owner or an approver can archive this requisition' });
      return;
    }
    if (requisition.archived_at) {
      res.status(400).json({ error: 'Requisition is already archived' });
      return;
    }
    const updated = await prisma.requisition.update({
      where: { id },
      data: { archived_at: new Date() },
      include: { line_items: true }
    });
    res.json({ ...updated, total: computeTotal(updated.line_items) });
  } catch (error) {
    console.error('Archive error:', error);
    res.status(500).json({ error: 'Failed to archive requisition' });
  }
});

/**
 * POST /api/requisitions/:id/restore
 * Owner or any approver. Sets archived_at = null.
 */
router.post('/:id/restore', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requisition = await prisma.requisition.findUnique({ where: { id } });
    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }
    // Check access: owner or any approver
    if (req.user!.role !== 'approver' && requisition.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Only the owner or an approver can restore this requisition' });
      return;
    }
    if (!requisition.archived_at) {
      res.status(400).json({ error: 'Requisition is not archived' });
      return;
    }
    const updated = await prisma.requisition.update({
      where: { id },
      data: { archived_at: null },
      include: { line_items: true }
    });
    res.json({ ...updated, total: computeTotal(updated.line_items) });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Failed to restore requisition' });
  }
});

export default router;
