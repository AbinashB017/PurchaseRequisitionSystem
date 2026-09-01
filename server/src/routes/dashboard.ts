import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// ─── Helper: get start of a rolling window ────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── GET /api/dashboard ───────────────────────────────────────────────────────
/**
 * Returns all dashboard metrics in one server-side computed response.
 * Works for both requesters (scoped to their own reqs) and approvers (all reqs).
 */
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const isApprover = req.user!.role === 'approver';
    const ownerId = req.user!.id;

    // Scope filter: requesters see only their own, approvers see all
    const scope = isApprover ? {} : { owner_id: ownerId };

    // ── 1. Submitted count ────────────────────────────────────────────────────
    const submittedCount = await prisma.requisition.count({
      where: { ...scope, status: 'submitted' },
    });

    // ── 2. Total value of ordered reqs (open commitments) ────────────────────
    const orderedReqs = await prisma.requisition.findMany({
      where: { ...scope, status: 'ordered' },
      include: { line_items: true },
    });
    const orderedTotal = orderedReqs.reduce((sum, r) => {
      return sum + r.line_items.reduce((s, l) => s + Number(l.ordered_qty) * Number(l.unit_price), 0);
    }, 0);

    // ── 3. Overdue count (ordered + needed_by_date < today) ───────────────────
    const overdueCount = await prisma.requisition.count({
      where: { ...scope, status: 'ordered', needed_by_date: { lt: new Date() } },
    });

    // ── 4. Received in the last 7 days (via AuditEvent log) ──────────────────
    // Count distinct requisitions that transitioned to "received" in last 7 days
    const sevenDaysAgo = daysAgo(7);
    const recentlyReceivedEvents = await prisma.auditEvent.findMany({
      where: {
        type: 'status_change',
        new_status: 'received',
        created_at: { gte: sevenDaysAgo },
        // Scope: if requester, only their requisitions
        ...(isApprover ? {} : { requisition: { owner_id: ownerId } }),
      },
      distinct: ['requisition_id'],
    });
    const receivedLast7Days = recentlyReceivedEvents.length;

    // ── 5. Status breakdown (count per status) ────────────────────────────────
    const allReqs = await prisma.requisition.groupBy({
      by: ['status'],
      where: scope,
      _count: { status: true },
    });
    const statusBreakdown: Record<string, number> = {};
    for (const r of allReqs) {
      statusBreakdown[r.status] = r._count.status;
    }

    // ── 6. Department breakdown ───────────────────────────────────────────────
    const deptGroups = await prisma.requisition.groupBy({
      by: ['department'],
      where: scope,
      _count: { department: true },
      orderBy: { _count: { department: 'desc' } },
    });
    const departmentBreakdown: Record<string, number> = {};
    for (const r of deptGroups) {
      departmentBreakdown[r.department] = r._count.department;
    }

    // ── 7. Received-per-week for the last 8 rolling weeks ────────────────────
    // Build 8 buckets of 7-day windows ending now
    const receivedPerWeek: Array<{ week: string; count: number }> = [];

    for (let w = 7; w >= 0; w--) {
      const end = new Date();
      end.setDate(end.getDate() - w * 7);
      end.setHours(23, 59, 59, 999);

      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const count = await prisma.auditEvent.count({
        where: {
          type: 'status_change',
          new_status: 'received',
          created_at: { gte: start, lte: end },
          ...(isApprover ? {} : { requisition: { owner_id: ownerId } }),
        },
      });

      receivedPerWeek.push({
        week: start.toISOString().split('T')[0], // Label: start date of the week
        count,
      });
    }

    res.json({
      submitted_count: submittedCount,
      ordered_total: orderedTotal,
      overdue_count: overdueCount,
      received_last_7_days: receivedLast7Days,
      status_breakdown: statusBreakdown,
      department_breakdown: departmentBreakdown,
      received_per_week: receivedPerWeek,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ─── GET /api/alerts ─────────────────────────────────────────────────────────
/**
 * Approver-only.
 * Returns overdue requisitions (status=ordered, needed_by_date < today)
 * that are assigned to the current approver AND whose AlertDismissal row
 * does not match the current needed_by_date (or doesn't exist).
 * i.e., dismissed_for_needed_by must equal current needed_by_date to count as dismissed.
 */
router.get('/alerts', requireRole('approver'), async (req: Request, res: Response): Promise<void> => {
  try {
    const approverId = req.user!.id;
    const now = new Date();

    // Find all overdue reqs assigned to this approver
    const overdueAssigned = await prisma.requisition.findMany({
      where: {
        status: 'ordered',
        needed_by_date: { lt: now },
        approvers: { some: { approver_id: approverId } },
      },
      include: {
        line_items: true,
        owner: { select: { id: true, name: true, email: true } },
        alert_dismissals: {
          where: { approver_id: approverId },
        },
      },
      orderBy: { needed_by_date: 'asc' },
    });

    // Filter out those where the dismissal snapshot matches current needed_by_date
    const active = overdueAssigned.filter(r => {
      const dismissal = r.alert_dismissals[0];
      if (!dismissal) return true; // never dismissed → active alert

      // Dismissed snapshot must match current needed_by_date exactly to count as dismissed
      const dismissedFor = new Date(dismissal.dismissed_for_needed_by).toISOString().split('T')[0];
      const currentDate  = new Date(r.needed_by_date).toISOString().split('T')[0];
      return dismissedFor !== currentDate; // if date was extended since dismissal, re-alert
    });

    const enriched = active.map(r => ({
      ...r,
      total: r.line_items.reduce((s, l) => s + Number(l.ordered_qty) * Number(l.unit_price), 0),
      alert_dismissals: undefined, // strip from response
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// ─── GET /api/alerts/count ────────────────────────────────────────────────────
/**
 * Approver-only. Lightweight: returns just the count for the nav badge.
 */
router.get('/alerts/count', requireRole('approver'), async (req: Request, res: Response): Promise<void> => {
  try {
    const approverId = req.user!.id;
    const now = new Date();

    const overdueAssigned = await prisma.requisition.findMany({
      where: {
        status: 'ordered',
        needed_by_date: { lt: now },
        approvers: { some: { approver_id: approverId } },
      },
      include: {
        alert_dismissals: { where: { approver_id: approverId } },
      },
    });

    const count = overdueAssigned.filter(r => {
      const dismissal = r.alert_dismissals[0];
      if (!dismissal) return true;
      const dismissedFor = new Date(dismissal.dismissed_for_needed_by).toISOString().split('T')[0];
      const currentDate  = new Date(r.needed_by_date).toISOString().split('T')[0];
      return dismissedFor !== currentDate;
    }).length;

    res.json({ count });
  } catch (error) {
    console.error('Alert count error:', error);
    res.status(500).json({ error: 'Failed to fetch alert count' });
  }
});

// ─── POST /api/alerts/:requisitionId/dismiss ─────────────────────────────────
/**
 * Approver-only. Creates or updates the AlertDismissal row.
 * Snapshot: dismissed_for_needed_by = current needed_by_date of the requisition.
 */
router.post('/alerts/:requisitionId/dismiss', requireRole('approver'), async (req: Request<{ requisitionId: string }>, res: Response): Promise<void> => {
  try {
    const { requisitionId } = req.params;
    const approverId = req.user!.id;

    const requisition = await prisma.requisition.findUnique({
      where: { id: requisitionId },
    });

    if (!requisition) {
      res.status(404).json({ error: 'Requisition not found' });
      return;
    }

    // Upsert: create or update the dismissal row
    await prisma.alertDismissal.upsert({
      where: {
        requisition_id_approver_id: {
          requisition_id: requisitionId,
          approver_id: approverId,
        },
      },
      create: {
        requisition_id: requisitionId,
        approver_id: approverId,
        dismissed_for_needed_by: requisition.needed_by_date,
      },
      update: {
        dismissed_for_needed_by: requisition.needed_by_date,
        dismissed_at: new Date(),
      },
    });

    res.json({ ok: true, dismissed_for: requisition.needed_by_date });
  } catch (error) {
    console.error('Dismiss error:', error);
    res.status(500).json({ error: 'Failed to dismiss alert' });
  }
});

export default router;
