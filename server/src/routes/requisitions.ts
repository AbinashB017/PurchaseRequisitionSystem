import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { computeTotal, TransitionError } from '../lib/stateMachine';
import { Prisma, RequisitionStatus } from '@prisma/client';

const router = Router();
router.use(requireAuth);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_SORT_FIELDS = ['needed_by_date', 'status', 'created_at'] as const;
const VALID_SORT_DIRS = ['asc', 'desc'] as const;
const VALID_STATUSES = ['draft', 'submitted', 'approved', 'ordered', 'received'] as const;

type SortField = typeof VALID_SORT_FIELDS[number];
type SortDir  = typeof VALID_SORT_DIRS[number];

function parseSortField(v: unknown): SortField {
  return VALID_SORT_FIELDS.includes(v as SortField) ? (v as SortField) : 'created_at';
}
function parseSortDir(v: unknown): SortDir {
  return VALID_SORT_DIRS.includes(v as SortDir) ? (v as SortDir) : 'desc';
}

/**
 * Build a Prisma WHERE clause from shared query params.
 *
 * role:      'requester' | 'approver'  — scopes owner filter
 * userId:    the logged-in user's id
 * query params:
 *   q          text search over title + vendor_name
 *   status     comma-separated list of statuses
 *   department exact match
 *   owner_id   filter by owner (approvers only)
 *   overdue    'true' → status=ordered AND needed_by_date < today
 */
function buildWhereClause(
  params: Record<string, any>,
  role: 'requester' | 'approver',
  userId: string
): Prisma.RequisitionWhereInput {
  const where: Prisma.RequisitionWhereInput = {};

  // Requesters always see only their own
  if (role === 'requester') {
    where.owner_id = userId;
  }

  // Text search: title OR vendor_name contains q
  if (params.q && typeof params.q === 'string' && params.q.trim()) {
    const q = params.q.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { vendor_name: { contains: q, mode: 'insensitive' } },
    ];
  }

  // Status filter (comma-separated, e.g. "submitted,approved")
  if (params.status && typeof params.status === 'string') {
    const statuses = params.status
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => VALID_STATUSES.includes(s as any)) as RequisitionStatus[];
    if (statuses.length === 1) {
      where.status = statuses[0];
    } else if (statuses.length > 1) {
      where.status = { in: statuses };
    }
  }

  // Department filter
  if (params.department && typeof params.department === 'string' && params.department.trim()) {
    where.department = { equals: params.department.trim(), mode: 'insensitive' };
  }

  // Owner filter (approvers only)
  if (role === 'approver' && params.owner_id && typeof params.owner_id === 'string') {
    where.owner_id = params.owner_id.trim();
  }

  // Overdue: ordered + needed_by_date < today
  // Uses AND to safely combine with any other existing where conditions
  if (params.overdue === 'true') {
    where.AND = [
      { status: 'ordered' },
      { needed_by_date: { lt: new Date() } },
    ];
  }

  // Archived filter: exclude by default, include if archived=true
  if (params.archived === 'true') {
    where.archived_at = { not: null };
  } else {
    where.archived_at = null;
  }

  return where;
}

// ─── GET /api/requisitions ───────────────────────────────────────────────────
/**
 * Server-side search/filter/sort/paginate.
 * Works for both requesters (own reqs) and approvers (all reqs with default queue filter).
 *
 * Query params:
 *   q, status, department, owner_id, overdue
 *   sortBy (needed_by_date | status | created_at), sortDir (asc | desc)
 *   page (1-based), pageSize (default 20)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const role = req.user!.role;
    const userId = req.user!.id;
    const params = req.query as Record<string, string>;

    const sortBy  = parseSortField(params.sortBy);
    const sortDir = parseSortDir(params.sortDir);
    const page     = Math.max(1, parseInt(params.page     || '1',  10));
    const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '20', 10)));

    const where = buildWhereClause(params, role, userId);

    // We need to sort by "total" (computed from line items) client-side after fetching
    // because it is not a stored column. For all other sort fields we push it to Prisma.
    const sortByTotal = sortBy === ('total' as any); // kept for frontend compat but not in VALID list

    const orderBy: Prisma.RequisitionOrderByWithRelationInput =
      sortByTotal ? { created_at: 'desc' } : { [sortBy]: sortDir };

    const [total, rows] = await prisma.$transaction([
      prisma.requisition.count({ where }),
      prisma.requisition.findMany({
        where,
        include: {
          line_items: true,
          owner: { select: { id: true, name: true, email: true } },
          approvers: { include: { approver: { select: { id: true, name: true } } } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    let enriched = rows.map(r => ({ ...r, total: computeTotal(r.line_items) }));

    // If sorting by total, sort in memory after enriching
    if (sortByTotal) {
      enriched = enriched.sort((a, b) =>
        sortDir === 'asc' ? a.total - b.total : b.total - a.total
      );
    }

    res.json({
      data: enriched,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('List requisitions error:', error);
    res.status(500).json({ error: 'Failed to fetch requisitions' });
  }
});

// ─── POST /api/requisitions ──────────────────────────────────────────────────
router.post('/', requireRole('requester'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, vendor_name, department, needed_by_date } = req.body;
    if (!title || typeof title !== 'string' || !title.trim() ||
        !vendor_name || typeof vendor_name !== 'string' || !vendor_name.trim() ||
        !department || typeof department !== 'string' || !department.trim() ||
        !needed_by_date) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }
    const requisition = await prisma.requisition.create({
      data: {
        title: title.trim(), vendor_name: vendor_name.trim(), department: department.trim(),
        needed_by_date: new Date(needed_by_date),
        owner_id: req.user!.id,
        status: 'draft',
      },
      include: { line_items: true },
    });
    res.status(201).json({ ...requisition, total: 0 });
  } catch (error) {
    console.error('Create requisition error:', error);
    res.status(500).json({ error: 'Failed to create requisition' });
  }
});

// ─── GET /api/requisitions/:id ───────────────────────────────────────────────
router.get('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        line_items: true,
        approvers: { include: { approver: { select: { id: true, name: true, email: true, approval_limit: true } } } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    if (!requisition) { res.status(404).json({ error: 'Requisition not found' }); return; }
    if (requisition.owner_id !== req.user!.id && req.user!.role !== 'approver') {
      res.status(403).json({ error: 'Access denied' }); return;
    }
    res.json({ ...requisition, total: computeTotal(requisition.line_items) });
  } catch (error) {
    console.error('Get requisition error:', error);
    res.status(500).json({ error: 'Failed to fetch requisition' });
  }
});

// ─── PUT /api/requisitions/:id ───────────────────────────────────────────────
router.put('/:id', requireRole('requester'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, vendor_name, department, needed_by_date } = req.body;

    if (!title || typeof title !== 'string' || !title.trim() ||
        !vendor_name || typeof vendor_name !== 'string' || !vendor_name.trim() ||
        !department || typeof department !== 'string' || !department.trim() ||
        !needed_by_date) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    const requisition = await prisma.requisition.findUnique({ where: { id } });
    if (!requisition) { res.status(404).json({ error: 'Requisition not found' }); return; }
    if (requisition.owner_id !== req.user!.id) { res.status(403).json({ error: 'Access denied' }); return; }
    if (requisition.status !== 'draft') { res.status(400).json({ error: 'Only draft requisitions can be edited' }); return; }
    const updated = await prisma.requisition.update({
      where: { id },
      data: { title: title.trim(), vendor_name: vendor_name.trim(), department: department.trim(), needed_by_date: new Date(needed_by_date) },
      include: { line_items: true },
    });
    res.json({ ...updated, total: computeTotal(updated.line_items) });
  } catch (error) {
    console.error('Update requisition error:', error);
    res.status(500).json({ error: 'Failed to update requisition' });
  }
});

// ─── POST /api/requisitions/:id/lines ───────────────────────────────────────
router.post('/:id/lines', requireRole('requester'), async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { description, ordered_qty, unit_price } = req.body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      res.status(400).json({ error: 'Description is required' });
      return;
    }
    const qty = Number(ordered_qty);
    const price = Number(unit_price);
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      res.status(400).json({ error: 'Quantity must be > 0 and price must be >= 0' });
      return;
    }

    const requisition = await prisma.requisition.findUnique({ where: { id } });
    if (!requisition) { res.status(404).json({ error: 'Requisition not found' }); return; }
    if (requisition.owner_id !== req.user!.id) { res.status(403).json({ error: 'Access denied' }); return; }
    if (requisition.status !== 'draft') { res.status(400).json({ error: 'Cannot add line items unless in draft' }); return; }
    await prisma.lineItem.create({
      data: { requisition_id: id, description: description.trim(), ordered_qty: qty, unit_price: price, received_qty: 0 },
    });
    const updated = await prisma.requisition.findUnique({
      where: { id },
      include: { line_items: true, approvers: { include: { approver: { select: { id: true, name: true, email: true, approval_limit: true } } } }, owner: { select: { id: true, name: true, email: true } } },
    });
    res.status(201).json({ ...updated, total: computeTotal(updated!.line_items) });
  } catch (error) {
    console.error('Add line error:', error);
    res.status(500).json({ error: 'Failed to add line item' });
  }
});

// ─── PUT /api/requisitions/:id/lines/:lineId ─────────────────────────────────
router.put('/:id/lines/:lineId', requireRole('requester'), async (req: Request<{ id: string; lineId: string }>, res: Response): Promise<void> => {
  try {
    const { id, lineId } = req.params;
    const { description, ordered_qty, unit_price } = req.body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      res.status(400).json({ error: 'Description is required' });
      return;
    }
    const qty = Number(ordered_qty);
    const price = Number(unit_price);
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      res.status(400).json({ error: 'Quantity must be > 0 and price must be >= 0' });
      return;
    }

    const requisition = await prisma.requisition.findUnique({ where: { id } });
    if (!requisition) { res.status(404).json({ error: 'Requisition not found' }); return; }
    if (requisition.owner_id !== req.user!.id) { res.status(403).json({ error: 'Access denied' }); return; }
    if (requisition.status !== 'draft') { res.status(400).json({ error: 'Cannot edit line items unless in draft' }); return; }
    const line = await prisma.lineItem.findUnique({ where: { id: lineId } });
    if (!line || line.requisition_id !== id) { res.status(404).json({ error: 'Line item not found' }); return; }
    await prisma.lineItem.update({ where: { id: lineId }, data: { description: description.trim(), ordered_qty: qty, unit_price: price } });
    const updated = await prisma.requisition.findUnique({
      where: { id },
      include: { line_items: true, approvers: { include: { approver: { select: { id: true, name: true, email: true, approval_limit: true } } } }, owner: { select: { id: true, name: true, email: true } } },
    });
    res.json({ ...updated, total: computeTotal(updated!.line_items) });
  } catch (error) {
    console.error('Update line error:', error);
    res.status(500).json({ error: 'Failed to update line item' });
  }
});

// ─── DELETE /api/requisitions/:id/lines/:lineId ──────────────────────────────
router.delete('/:id/lines/:lineId', requireRole('requester'), async (req: Request<{ id: string; lineId: string }>, res: Response): Promise<void> => {
  try {
    const { id, lineId } = req.params;
    const requisition = await prisma.requisition.findUnique({ where: { id } });
    if (!requisition) { res.status(404).json({ error: 'Requisition not found' }); return; }
    if (requisition.owner_id !== req.user!.id) { res.status(403).json({ error: 'Access denied' }); return; }
    if (requisition.status !== 'draft') { res.status(400).json({ error: 'Cannot remove line items unless in draft' }); return; }
    const line = await prisma.lineItem.findUnique({ where: { id: lineId } });
    if (!line || line.requisition_id !== id) { res.status(404).json({ error: 'Line item not found' }); return; }
    await prisma.lineItem.delete({ where: { id: lineId } });
    const updated = await prisma.requisition.findUnique({
      where: { id },
      include: { line_items: true, approvers: { include: { approver: { select: { id: true, name: true, email: true, approval_limit: true } } } }, owner: { select: { id: true, name: true, email: true } } },
    });
    res.json({ ...updated, total: computeTotal(updated!.line_items) });
  } catch (error) {
    console.error('Delete line error:', error);
    res.status(500).json({ error: 'Failed to delete line item' });
  }
});

export default router;
