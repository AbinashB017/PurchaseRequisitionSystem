import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { computeTotal } from '../lib/stateMachine';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/queues/submitted
 * Approver-only: all submitted requisitions with search/sort/paginate.
 */
router.get('/submitted', requireRole('approver'), async (req: Request, res: Response): Promise<void> => {
  try {
    const params = req.query as Record<string, string>;
    const page     = Math.max(1, parseInt(params.page     || '1',  10));
    const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '20', 10)));
    const sortDir  = (params.sortDir === 'asc' ? 'asc' : 'desc') as Prisma.SortOrder;

    const where: Prisma.RequisitionWhereInput = { status: 'submitted' };

    if (params.archived === 'true') {
      where.archived_at = { not: null };
    } else {
      where.archived_at = null;
    }

    if (params.q && params.q.trim()) {
      const q = params.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { vendor_name: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (params.department && params.department.trim()) {
      where.department = { equals: params.department.trim(), mode: 'insensitive' };
    }
    if (params.owner_id && params.owner_id.trim()) {
      where.owner_id = params.owner_id.trim();
    }

    const [total, rows] = await prisma.$transaction([
      prisma.requisition.count({ where }),
      prisma.requisition.findMany({
        where,
        include: {
          line_items: true,
          owner: { select: { id: true, name: true, email: true } },
          approvers: { include: { approver: { select: { id: true, name: true } } } },
        },
        orderBy: { needed_by_date: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const enriched = rows.map(r => ({ ...r, total: computeTotal(r.line_items) }));
    res.json({ data: enriched, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error('Submitted queue error:', error);
    res.status(500).json({ error: 'Failed to fetch submitted queue' });
  }
});

/**
 * GET /api/queues/assigned-to-me
 * Approver-only: submitted requisitions where the current user is assigned.
 */
router.get('/assigned-to-me', requireRole('approver'), async (req: Request, res: Response): Promise<void> => {
  try {
    const params = req.query as Record<string, string>;
    const page     = Math.max(1, parseInt(params.page     || '1',  10));
    const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '20', 10)));
    const sortDir  = (params.sortDir === 'asc' ? 'asc' : 'desc') as Prisma.SortOrder;

    const where: Prisma.RequisitionWhereInput = {
      status: 'submitted',
      approvers: { some: { approver_id: req.user!.id } },
    };

    if (params.archived === 'true') {
      where.archived_at = { not: null };
    } else {
      where.archived_at = null;
    }

    if (params.q && params.q.trim()) {
      const q = params.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { vendor_name: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await prisma.$transaction([
      prisma.requisition.count({ where }),
      prisma.requisition.findMany({
        where,
        include: {
          line_items: true,
          owner: { select: { id: true, name: true, email: true } },
          approvers: { include: { approver: { select: { id: true, name: true } } } },
        },
        orderBy: { needed_by_date: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const enriched = rows.map(r => ({ ...r, total: computeTotal(r.line_items) }));
    res.json({ data: enriched, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error('Assigned queue error:', error);
    res.status(500).json({ error: 'Failed to fetch assigned queue' });
  }
});

export default router;
