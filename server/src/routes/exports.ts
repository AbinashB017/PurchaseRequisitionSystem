import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { executeTransition, computeTotal } from '../lib/stateMachine';

const router = Router();
router.use(requireAuth);

/**
 * POST /api/bulk-approve
 * Approver only. Accepts an array of requisition IDs.
 * Checks EACH one individually against the approver's limit.
 * Returns a structured per-item report.
 * Body: { ids: string[] }
 */
router.post('/bulk-approve', requireRole('approver'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids must be a non-empty array of requisition IDs' });
      return;
    }

    const approverLimit = req.user!.approval_limit ? Number(req.user!.approval_limit) : null;

    const approved: Array<{ id: string; title: string; total: number }> = [];
    const refused: Array<{ id: string; title: string; total: number; reason: string }> = [];

    for (const id of ids) {
      // Fetch with lines
      const requisition = await prisma.requisition.findUnique({
        where: { id: String(id) },
        include: { line_items: true },
      });

      if (!requisition) {
        refused.push({ id: String(id), title: '(not found)', total: 0, reason: 'Requisition not found' });
        continue;
      }

      if (requisition.status !== 'submitted') {
        refused.push({
          id: requisition.id,
          title: requisition.title,
          total: computeTotal(requisition.line_items),
          reason: `Cannot approve — current status is "${requisition.status}" (must be "submitted")`,
        });
        continue;
      }

      const total = computeTotal(requisition.line_items);

      if (approverLimit !== null && total > approverLimit) {
        refused.push({
          id: requisition.id,
          title: requisition.title,
          total,
          reason: `Total ($${total.toFixed(2)}) exceeds your approval limit ($${approverLimit.toFixed(2)})`,
        });
        continue;
      }

      // Attempt the transition
      try {
        await executeTransition({
          requisitionId: requisition.id,
          fromStatus: 'submitted',
          toStatus: 'approved',
          actorId: req.user!.id,
          auditType: 'status_change',
          metadata: { approved_total: total, via: 'bulk_approve' },
        });
        approved.push({ id: requisition.id, title: requisition.title, total });
      } catch (transitionErr: any) {
        refused.push({
          id: requisition.id,
          title: requisition.title,
          total,
          reason: transitionErr.message || 'Transition failed',
        });
      }
    }

    res.json({
      approved,
      refused,
      summary: {
        total_submitted: ids.length,
        approved_count: approved.length,
        refused_count: refused.length,
      },
    });
  } catch (error) {
    console.error('Bulk approve error:', error);
    res.status(500).json({ error: 'Bulk approve failed' });
  }
});

/**
 * GET /api/export/ordered.csv
 * Returns a CSV of all "ordered" requisitions.
 * Columns: id, title, vendor_name, department, total, needed_by_date, owner_name
 */
router.get('/export/ordered.csv', requireRole('approver'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const requisitions = await prisma.requisition.findMany({
      where: { status: 'ordered' },
      include: {
        line_items: true,
        owner: { select: { name: true, email: true } },
      },
      orderBy: { needed_by_date: 'asc' },
    });

    const csvEscape = (v: string | number): string => {
      const s = String(v);
      // Wrap in quotes if contains comma, quote, or newline
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = ['ID', 'Title', 'Vendor', 'Department', 'Total', 'Needed By', 'Owner'];
    const rows = requisitions.map(r => {
      const total = computeTotal(r.line_items);
      const neededBy = new Date(r.needed_by_date).toISOString().split('T')[0];
      return [
        csvEscape(r.id),
        csvEscape(r.title),
        csvEscape(r.vendor_name),
        csvEscape(r.department),
        csvEscape(total.toFixed(2)),
        csvEscape(neededBy),
        csvEscape(r.owner?.name || ''),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ordered-requisitions.csv"');
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;
