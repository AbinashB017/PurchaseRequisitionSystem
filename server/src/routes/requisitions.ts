import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { computeTotal } from '../lib/stateMachine';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * GET /api/requisitions
 * List all requisitions owned by the current user (requesters only)
 */
router.get('/', requireRole('requester'), async (req: Request, res: Response) => {
  try {
    const requisitions = await prisma.requisition.findMany({
      where: { owner_id: req.user!.id },
      include: { line_items: true },
      orderBy: { created_at: 'desc' }
    });

    const enriched = requisitions.map(r => ({
      ...r,
      total: computeTotal(r.line_items)
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching requisitions:', error);
    res.status(500).json({ error: 'Failed to fetch requisitions' });
  }
});

/**
 * POST /api/requisitions
 * Create a new requisition
 */
router.post('/', requireRole('requester'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, vendor_name, department, needed_by_date } = req.body;
    
    if (!title || !vendor_name || !department || !needed_by_date) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const requisition = await prisma.requisition.create({
      data: {
        title,
        vendor_name,
        department,
        needed_by_date: new Date(needed_by_date),
        owner_id: req.user!.id,
        status: 'draft'
      },
      include: { line_items: true }
    });

    res.status(201).json({ ...requisition, total: 0 });
  } catch (error) {
    console.error('Error creating requisition:', error);
    res.status(500).json({ error: 'Failed to create requisition' });
  }
});

/**
 * GET /api/requisitions/:id
 * Get a single requisition by ID.
 * Owner can always view. Approvers can view any requisition.
 */
router.get('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        line_items: true,
        approvers: { include: { approver: { select: { id: true, name: true, email: true, approval_limit: true } } } },
        owner: { select: { id: true, name: true, email: true } }
      }
    });

    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    // Owner can view their own. Approvers can view any.
    if (requisition.owner_id !== req.user!.id && req.user!.role !== 'approver') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ ...requisition, total: computeTotal(requisition.line_items) });
  } catch (error) {
    console.error('Error fetching requisition:', error);
    res.status(500).json({ error: 'Failed to fetch requisition' });
  }
});

/**
 * PUT /api/requisitions/:id
 * Update a requisition (only if draft and owned by user)
 */
router.put('/:id', requireRole('requester'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, vendor_name, department, needed_by_date } = req.body;
    
    const requisition = await prisma.requisition.findUnique({ where: { id } });

    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    if (requisition.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (requisition.status !== 'draft') {
      res.status(400).json({ error: 'Only draft requisitions can be edited' });
      return;
    }

    const updated = await prisma.requisition.update({
      where: { id },
      data: {
        title,
        vendor_name,
        department,
        needed_by_date: new Date(needed_by_date)
      },
      include: { line_items: true }
    });

    res.json({ ...updated, total: computeTotal(updated.line_items) });
  } catch (error) {
    console.error('Error updating requisition:', error);
    res.status(500).json({ error: 'Failed to update requisition' });
  }
});

/**
 * POST /api/requisitions/:id/lines
 * Add a line item to a draft requisition
 */
router.post('/:id/lines', requireRole('requester'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { description, ordered_qty, unit_price } = req.body;

    const requisition = await prisma.requisition.findUnique({ where: { id } });

    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    if (requisition.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (requisition.status !== 'draft') {
      res.status(400).json({ error: 'Cannot add line items unless requisition is in draft status' });
      return;
    }

    await prisma.lineItem.create({
      data: {
        requisition_id: id,
        description,
        ordered_qty: Number(ordered_qty),
        unit_price: Number(unit_price),
        received_qty: 0
      }
    });

    const updatedReq = await prisma.requisition.findUnique({
      where: { id },
      include: {
        line_items: true,
        approvers: { include: { approver: { select: { id: true, name: true, email: true, approval_limit: true } } } },
        owner: { select: { id: true, name: true, email: true } }
      }
    });

    res.status(201).json({ ...updatedReq, total: computeTotal(updatedReq!.line_items) });
  } catch (error) {
    console.error('Error adding line item:', error);
    res.status(500).json({ error: 'Failed to add line item' });
  }
});

/**
 * PUT /api/requisitions/:id/lines/:lineId
 * Edit a line item
 */
router.put('/:id/lines/:lineId', requireRole('requester'), async (req: Request<{ id: string; lineId: string }>, res: Response): Promise<void> => {
  try {
    const { id, lineId } = req.params;
    const { description, ordered_qty, unit_price } = req.body;

    const requisition = await prisma.requisition.findUnique({ where: { id } });

    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    if (requisition.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (requisition.status !== 'draft') {
      res.status(400).json({ error: 'Cannot edit line items unless requisition is in draft status' });
      return;
    }

    const line = await prisma.lineItem.findUnique({ where: { id: lineId } });
    if (!line || line.requisition_id !== id) {
      res.status(404).json({ error: 'Line item not found' });
      return;
    }

    await prisma.lineItem.update({
      where: { id: lineId },
      data: {
        description,
        ordered_qty: Number(ordered_qty),
        unit_price: Number(unit_price)
      }
    });

    const updatedReq = await prisma.requisition.findUnique({
      where: { id },
      include: {
        line_items: true,
        approvers: { include: { approver: { select: { id: true, name: true, email: true, approval_limit: true } } } },
        owner: { select: { id: true, name: true, email: true } }
      }
    });

    res.json({ ...updatedReq, total: computeTotal(updatedReq!.line_items) });
  } catch (error) {
    console.error('Error updating line item:', error);
    res.status(500).json({ error: 'Failed to update line item' });
  }
});

/**
 * DELETE /api/requisitions/:id/lines/:lineId
 * Remove a line item
 */
router.delete('/:id/lines/:lineId', requireRole('requester'), async (req: Request<{ id: string; lineId: string }>, res: Response): Promise<void> => {
  try {
    const { id, lineId } = req.params;

    const requisition = await prisma.requisition.findUnique({ where: { id } });

    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    if (requisition.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (requisition.status !== 'draft') {
      res.status(400).json({ error: 'Cannot remove line items unless requisition is in draft status' });
      return;
    }

    const line = await prisma.lineItem.findUnique({ where: { id: lineId } });
    if (!line || line.requisition_id !== id) {
      res.status(404).json({ error: 'Line item not found' });
      return;
    }

    await prisma.lineItem.delete({ where: { id: lineId } });

    const updatedReq = await prisma.requisition.findUnique({
      where: { id },
      include: {
        line_items: true,
        approvers: { include: { approver: { select: { id: true, name: true, email: true, approval_limit: true } } } },
        owner: { select: { id: true, name: true, email: true } }
      }
    });

    res.json({ ...updatedReq, total: computeTotal(updatedReq!.line_items) });
  } catch (error) {
    console.error('Error deleting line item:', error);
    res.status(500).json({ error: 'Failed to delete line item' });
  }
});

export default router;
