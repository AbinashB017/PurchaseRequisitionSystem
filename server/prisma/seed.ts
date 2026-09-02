/**
 * Prisma Seed Script — ProcureFlow Demo Data
 *
 * Covers:
 *  - 2 requesters, 3 approvers (meaningfully different limits)
 *  - 18 requisitions across all statuses
 *  - At least 1 overdue, 1 archived, 1 partial receipt, 1 full reject-then-resubmit
 *  - Comments spread across several requisitions
 *  - Multiple departments and a spread of dates for dashboard chart variation
 */

import { PrismaClient, AuditEventType, RequisitionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const hash = (pw: string) => bcrypt.hashSync(pw, 10);

/** Return a Date n days ago from today (UTC midnight) */
const daysAgo = (n: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

/** Return a Date n days from now (UTC midnight) */
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

// ──────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────
async function main() {
  console.log('🌱  Starting seed…');

  // Wipe existing data (ordered to respect FK constraints)
  await prisma.alertDismissal.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.requisitionApprover.deleteMany();
  await prisma.lineItem.deleteMany();
  await prisma.requisition.deleteMany();
  await prisma.user.deleteMany();
  console.log('   ✓ Cleared existing data');

  // ── Users ────────────────────────────────────────
  const PASSWORD = 'Demo1234!';

  const alice = await prisma.user.create({
    data: {
      name: 'Alice Chen',
      email: 'alice@procureflow.dev',
      password_hash: hash(PASSWORD),
      role: 'requester',
    },
  });
  const bob = await prisma.user.create({
    data: {
      name: 'Bob Martinez',
      email: 'bob@procureflow.dev',
      password_hash: hash(PASSWORD),
      role: 'requester',
    },
  });
  const carol = await prisma.user.create({
    data: {
      name: 'Carol Thompson',
      email: 'carol@procureflow.dev',
      password_hash: hash(PASSWORD),
      role: 'approver',
      approval_limit: 50000,
    },
  });
  const david = await prisma.user.create({
    data: {
      name: 'David Park',
      email: 'david@procureflow.dev',
      password_hash: hash(PASSWORD),
      role: 'approver',
      approval_limit: 15000,
    },
  });
  const eve = await prisma.user.create({
    data: {
      name: 'Eve Okafor',
      email: 'eve@procureflow.dev',
      password_hash: hash(PASSWORD),
      role: 'approver',
      approval_limit: 3000,
    },
  });

  console.log('   ✓ Created 5 users (2 requesters, 3 approvers)');

  type User = typeof alice;
  type LineItemInput = {
    description: string;
    ordered_qty: number;
    unit_price: number;
    received_qty?: number;
  };
  type AuditEntry = {
    type: AuditEventType;
    actor: User;
    oldStatus?: RequisitionStatus;
    newStatus?: RequisitionStatus;
    reason?: string;
    comment?: string;
    metadata?: object;
    at: Date;
  };

  async function makeReq(opts: {
    owner: User;
    title: string;
    vendor: string;
    dept: string;
    status: RequisitionStatus;
    neededBy: Date;
    createdAt: Date;
    lines: LineItemInput[];
    approvers?: User[];
    archivedAt?: Date;
    auditTrail?: AuditEntry[];
  }) {
    const req = await prisma.requisition.create({
      data: {
        title: opts.title,
        vendor_name: opts.vendor,
        department: opts.dept,
        status: opts.status,
        needed_by_date: opts.neededBy,
        created_at: opts.createdAt,
        updated_at: opts.createdAt,
        archived_at: opts.archivedAt ?? null,
        owner: { connect: { id: opts.owner.id } },
        line_items: {
          create: opts.lines.map(l => ({
            description: l.description,
            ordered_qty: l.ordered_qty,
            unit_price: l.unit_price,
            received_qty: l.received_qty ?? 0,
          })),
        },
        ...(opts.approvers && opts.approvers.length > 0
          ? { approvers: { create: opts.approvers.map(a => ({ approver_id: a.id })) } }
          : {}),
      },
    });

    if (opts.auditTrail) {
      for (const ev of opts.auditTrail) {
        await prisma.auditEvent.create({
          data: {
            requisition_id: req.id,
            type: ev.type,
            actor_id: ev.actor.id,
            old_status: ev.oldStatus ?? null,
            new_status: ev.newStatus ?? null,
            reason: ev.reason ?? null,
            comment_text: ev.comment ?? null,
            metadata: ev.metadata ?? null,
            created_at: ev.at,
          },
        });
      }
    }
    return req;
  }

  // ── 1. DRAFT — Engineering (Alice) ──────────────────────────────────────────
  await makeReq({
    owner: alice, title: 'Standing desk and ergonomic chair',
    vendor: 'ErgoOffice Supplies', dept: 'Engineering',
    status: 'draft', neededBy: daysFromNow(30), createdAt: daysAgo(3),
    lines: [
      { description: 'Sit-stand desk (electric)', ordered_qty: 2, unit_price: 750 },
      { description: 'Ergonomic office chair', ordered_qty: 2, unit_price: 420 },
    ],
    auditTrail: [{ type: 'created', actor: alice, at: daysAgo(3) }],
  });

  // ── 2. DRAFT — Marketing (Bob) ───────────────────────────────────────────────
  await makeReq({
    owner: bob, title: 'Adobe Creative Cloud annual licenses',
    vendor: 'Adobe Systems', dept: 'Marketing',
    status: 'draft', neededBy: daysFromNow(14), createdAt: daysAgo(1),
    lines: [
      { description: 'Creative Cloud All Apps — 12 months', ordered_qty: 5, unit_price: 599.99 },
    ],
    auditTrail: [{ type: 'created', actor: bob, at: daysAgo(1) }],
  });

  // ── 3. SUBMITTED — Finance (Alice → Carol) ───────────────────────────────────
  await makeReq({
    owner: alice, title: 'QuickBooks Enterprise subscription renewal',
    vendor: 'Intuit Inc.', dept: 'Finance',
    status: 'submitted', neededBy: daysFromNow(10), createdAt: daysAgo(8),
    lines: [
      { description: 'QuickBooks Enterprise — annual license', ordered_qty: 1, unit_price: 1340 },
    ],
    approvers: [carol],
    auditTrail: [
      { type: 'created', actor: alice, at: daysAgo(8) },
      { type: 'status_change', actor: alice, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(7) },
      { type: 'comment', actor: carol, comment: 'Looks good — will review contract terms before approving.', at: daysAgo(6) },
    ],
  });

  // ── 4. SUBMITTED — HR (Bob → Eve) ────────────────────────────────────────────
  await makeReq({
    owner: bob, title: 'Onboarding supplies pack — Q4 hires',
    vendor: 'OfficeMax', dept: 'HR',
    status: 'submitted', neededBy: daysFromNow(20), createdAt: daysAgo(5),
    lines: [
      { description: 'Laptop bag (branded)', ordered_qty: 10, unit_price: 45 },
      { description: 'Welcome kit notebook + pen set', ordered_qty: 10, unit_price: 18 },
      { description: 'Desk organiser tray', ordered_qty: 10, unit_price: 22 },
    ],
    approvers: [eve],
    auditTrail: [
      { type: 'created', actor: bob, at: daysAgo(5) },
      { type: 'status_change', actor: bob, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(4) },
    ],
  });

  // ── 5. APPROVED — Engineering (Alice → David) ────────────────────────────────
  await makeReq({
    owner: alice, title: 'AWS Reserved Instances — 1-year compute',
    vendor: 'Amazon Web Services', dept: 'Engineering',
    status: 'approved', neededBy: daysFromNow(5), createdAt: daysAgo(20),
    lines: [
      { description: 'EC2 r6i.2xlarge Reserved Instance, 1yr no-upfront', ordered_qty: 3, unit_price: 2100 },
    ],
    approvers: [david],
    auditTrail: [
      { type: 'created', actor: alice, at: daysAgo(20) },
      { type: 'status_change', actor: alice, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(19) },
      { type: 'comment', actor: david, comment: 'Confirmed with CTO. Approved within Q3 budget.', at: daysAgo(16) },
      { type: 'status_change', actor: david, oldStatus: 'submitted', newStatus: 'approved', at: daysAgo(15) },
    ],
  });

  // ── 6. APPROVED — Operations (Bob → Carol) ───────────────────────────────────
  await makeReq({
    owner: bob, title: 'Industrial printer & copier lease',
    vendor: 'Xerox Corporation', dept: 'Operations',
    status: 'approved', neededBy: daysFromNow(7), createdAt: daysAgo(18),
    lines: [
      { description: 'Xerox VersaLink C7020 — 24-month lease', ordered_qty: 1, unit_price: 4800 },
      { description: 'High-yield toner starter pack', ordered_qty: 4, unit_price: 210 },
    ],
    approvers: [carol],
    auditTrail: [
      { type: 'created', actor: bob, at: daysAgo(18) },
      { type: 'status_change', actor: bob, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(17) },
      { type: 'status_change', actor: carol, oldStatus: 'submitted', newStatus: 'approved', at: daysAgo(14) },
    ],
  });

  // ── 7. ORDERED — Engineering (Alice → Carol) — OVERDUE ───────────────────────
  await makeReq({
    owner: alice, title: 'Replacement SSDs for dev workstations',
    vendor: 'Samsung Business', dept: 'Engineering',
    status: 'ordered', neededBy: daysAgo(5), createdAt: daysAgo(40),
    lines: [
      { description: 'Samsung 990 Pro 2TB NVMe SSD', ordered_qty: 8, unit_price: 189 },
    ],
    approvers: [carol],
    auditTrail: [
      { type: 'created', actor: alice, at: daysAgo(40) },
      { type: 'status_change', actor: alice, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(38) },
      { type: 'status_change', actor: carol, oldStatus: 'submitted', newStatus: 'approved', at: daysAgo(35) },
      { type: 'status_change', actor: alice, oldStatus: 'approved', newStatus: 'ordered', at: daysAgo(30) },
      { type: 'comment', actor: alice, comment: 'PO sent. Vendor confirmed 3-week shipping — now delayed. Chasing supplier.', at: daysAgo(10) },
    ],
  });

  // ── 8. ORDERED — Finance (Bob → David) ───────────────────────────────────────
  await makeReq({
    owner: bob, title: 'Sage Intacct implementation services',
    vendor: 'Sage Group', dept: 'Finance',
    status: 'ordered', neededBy: daysFromNow(45), createdAt: daysAgo(25),
    lines: [
      { description: 'Implementation consulting — 40 hours', ordered_qty: 40, unit_price: 250 },
      { description: 'Data migration package', ordered_qty: 1, unit_price: 3500 },
    ],
    approvers: [david],
    auditTrail: [
      { type: 'created', actor: bob, at: daysAgo(25) },
      { type: 'status_change', actor: bob, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(24) },
      { type: 'status_change', actor: david, oldStatus: 'submitted', newStatus: 'approved', at: daysAgo(21) },
      { type: 'status_change', actor: bob, oldStatus: 'approved', newStatus: 'ordered', at: daysAgo(18) },
    ],
  });

  // ── 9. ORDERED — Marketing (Alice → Eve) ─────────────────────────────────────
  await makeReq({
    owner: alice, title: 'Trade show booth materials',
    vendor: 'Displays2Go', dept: 'Marketing',
    status: 'ordered', neededBy: daysFromNow(21), createdAt: daysAgo(15),
    lines: [
      { description: '10x10 pop-up display banner', ordered_qty: 2, unit_price: 480 },
      { description: 'Branded tablecloth', ordered_qty: 3, unit_price: 95 },
      { description: 'Literature stand', ordered_qty: 2, unit_price: 65 },
    ],
    approvers: [eve],
    auditTrail: [
      { type: 'created', actor: alice, at: daysAgo(15) },
      { type: 'status_change', actor: alice, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(14) },
      { type: 'status_change', actor: eve, oldStatus: 'submitted', newStatus: 'approved', at: daysAgo(12) },
      { type: 'status_change', actor: alice, oldStatus: 'approved', newStatus: 'ordered', at: daysAgo(10) },
    ],
  });

  // ── 10. RECEIVED (PARTIAL) — Engineering (Bob → Carol) ───────────────────────
  await makeReq({
    owner: bob, title: 'Developer laptop refresh — Q3',
    vendor: 'Dell Technologies', dept: 'Engineering',
    status: 'received', neededBy: daysAgo(2), createdAt: daysAgo(55),
    lines: [
      { description: 'Dell XPS 15 9530 laptop', ordered_qty: 4, unit_price: 1899, received_qty: 2 },
      { description: 'Dell 27" 4K monitor (U2723D)', ordered_qty: 4, unit_price: 620, received_qty: 4 },
    ],
    approvers: [carol],
    auditTrail: [
      { type: 'created', actor: bob, at: daysAgo(55) },
      { type: 'status_change', actor: bob, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(53) },
      { type: 'status_change', actor: carol, oldStatus: 'submitted', newStatus: 'approved', at: daysAgo(50) },
      { type: 'status_change', actor: bob, oldStatus: 'approved', newStatus: 'ordered', at: daysAgo(45) },
      {
        type: 'receipt', actor: bob,
        metadata: { description: 'Dell 27" 4K monitor (U2723D)', received_qty: 4, ordered_qty: 4 },
        at: daysAgo(14),
      },
      {
        type: 'receipt', actor: bob,
        metadata: { description: 'Dell XPS 15 9530 laptop', received_qty: 2, ordered_qty: 4 },
        at: daysAgo(7),
      },
      { type: 'status_change', actor: bob, oldStatus: 'ordered', newStatus: 'received', at: daysAgo(7) },
      { type: 'comment', actor: carol, comment: '2 laptops still on backorder — confirmed by Dell for next month.', at: daysAgo(6) },
    ],
  });

  // ── 11. RECEIVED — HR (Alice → Eve) — ~5 weeks ago ───────────────────────────
  await makeReq({
    owner: alice, title: 'Recruitment platform subscription',
    vendor: 'Greenhouse Software', dept: 'HR',
    status: 'received', neededBy: daysAgo(30), createdAt: daysAgo(62),
    lines: [
      { description: 'Greenhouse ATS — annual subscription (50 seats)', ordered_qty: 1, unit_price: 2400, received_qty: 1 },
    ],
    approvers: [eve],
    auditTrail: [
      { type: 'created', actor: alice, at: daysAgo(62) },
      { type: 'status_change', actor: alice, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(60) },
      { type: 'status_change', actor: eve, oldStatus: 'submitted', newStatus: 'approved', at: daysAgo(57) },
      { type: 'status_change', actor: alice, oldStatus: 'approved', newStatus: 'ordered', at: daysAgo(55) },
      { type: 'status_change', actor: alice, oldStatus: 'ordered', newStatus: 'received', at: daysAgo(36) },
    ],
  });

  // ── 12. RECEIVED — Operations (Bob → David) — ~3 weeks ago ───────────────────
  await makeReq({
    owner: bob, title: 'Office kitchen appliances restock',
    vendor: 'Costco Business', dept: 'Operations',
    status: 'received', neededBy: daysAgo(18), createdAt: daysAgo(42),
    lines: [
      { description: 'Commercial coffee machine', ordered_qty: 1, unit_price: 895, received_qty: 1 },
      { description: 'Microwave oven (commercial)', ordered_qty: 2, unit_price: 310, received_qty: 2 },
      { description: 'Refrigerator (under-counter, 24")', ordered_qty: 1, unit_price: 650, received_qty: 1 },
    ],
    approvers: [david],
    auditTrail: [
      { type: 'created', actor: bob, at: daysAgo(42) },
      { type: 'status_change', actor: bob, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(41) },
      { type: 'status_change', actor: david, oldStatus: 'submitted', newStatus: 'approved', at: daysAgo(39) },
      { type: 'status_change', actor: bob, oldStatus: 'approved', newStatus: 'ordered', at: daysAgo(35) },
      { type: 'status_change', actor: bob, oldStatus: 'ordered', newStatus: 'received', at: daysAgo(21) },
    ],
  });

  // ── 13. RECEIVED — Finance (Alice → Carol) — ~1 week ago ─────────────────────
  await makeReq({
    owner: alice, title: 'Accountant CPA conference registrations',
    vendor: 'AICPA', dept: 'Finance',
    status: 'received', neededBy: daysAgo(6), createdAt: daysAgo(32),
    lines: [
      { description: 'ENGAGE conference registration — 2 attendees', ordered_qty: 2, unit_price: 1995, received_qty: 2 },
    ],
    approvers: [carol],
    auditTrail: [
      { type: 'created', actor: alice, at: daysAgo(32) },
      { type: 'status_change', actor: alice, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(31) },
      { type: 'status_change', actor: carol, oldStatus: 'submitted', newStatus: 'approved', at: daysAgo(28) },
      { type: 'status_change', actor: alice, oldStatus: 'approved', newStatus: 'ordered', at: daysAgo(25) },
      { type: 'status_change', actor: alice, oldStatus: 'ordered', newStatus: 'received', at: daysAgo(8) },
    ],
  });

  // ── 14. REJECTED — Engineering (Bob → Carol) ─────────────────────────────────
  await makeReq({
    owner: bob, title: 'High-end audio equipment for dev team',
    vendor: 'Bose Professional', dept: 'Engineering',
    status: 'rejected', neededBy: daysFromNow(15), createdAt: daysAgo(22),
    lines: [
      { description: 'Bose QuietComfort Ultra headphones', ordered_qty: 6, unit_price: 429 },
      { description: 'Bose Soundbar 900', ordered_qty: 2, unit_price: 899 },
    ],
    approvers: [carol],
    auditTrail: [
      { type: 'created', actor: bob, at: daysAgo(22) },
      { type: 'status_change', actor: bob, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(21) },
      {
        type: 'status_change', actor: carol,
        oldStatus: 'submitted', newStatus: 'rejected',
        reason: 'Non-essential luxury spend. Not in Q3 approved budget. Please re-submit in Q4 with manager sign-off memo.',
        at: daysAgo(19),
      },
    ],
  });

  // ── 15. REJECT → RESUBMIT → APPROVED — Engineering (Alice → Carol) ───────────
  await makeReq({
    owner: alice, title: 'Cybersecurity awareness training platform',
    vendor: 'KnowBe4', dept: 'Engineering',
    status: 'approved', neededBy: daysFromNow(20), createdAt: daysAgo(50),
    lines: [
      { description: 'KnowBe4 — 60-seat annual licence (Platinum)', ordered_qty: 1, unit_price: 5600 },
    ],
    approvers: [carol],
    auditTrail: [
      { type: 'created', actor: alice, at: daysAgo(50) },
      { type: 'status_change', actor: alice, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(49) },
      {
        type: 'status_change', actor: carol,
        oldStatus: 'submitted', newStatus: 'rejected',
        reason: 'Seat count too high for current headcount. Please revise to 60 seats and resubmit.',
        at: daysAgo(47),
      },
      { type: 'comment', actor: alice, comment: 'Revised to 60 seats reflecting current headcount (58 staff + 2 contractors).', at: daysAgo(44) },
      { type: 'status_change', actor: alice, oldStatus: 'rejected', newStatus: 'submitted', at: daysAgo(44) },
      { type: 'comment', actor: carol, comment: 'Revised proposal accepted. Approved.', at: daysAgo(42) },
      { type: 'status_change', actor: carol, oldStatus: 'submitted', newStatus: 'approved', at: daysAgo(42) },
    ],
  });

  // ── 16. ARCHIVED — Marketing (Bob) ───────────────────────────────────────────
  await makeReq({
    owner: bob, title: 'Video production equipment — cancelled project',
    vendor: 'B&H Photo Video', dept: 'Marketing',
    status: 'draft', neededBy: daysFromNow(60), createdAt: daysAgo(70),
    archivedAt: daysAgo(50),
    lines: [
      { description: 'Sony FX3 cinema camera', ordered_qty: 1, unit_price: 3900 },
      { description: 'Prime lens kit (24mm/50mm/85mm)', ordered_qty: 1, unit_price: 2200 },
    ],
    auditTrail: [
      { type: 'created', actor: bob, at: daysAgo(70) },
    ],
  });

  // ── 17. SUBMITTED — Operations (Alice → David) ────────────────────────────────
  await makeReq({
    owner: alice, title: 'Pest control & facilities maintenance contract',
    vendor: 'ServPro Commercial', dept: 'Operations',
    status: 'submitted', neededBy: daysFromNow(25), createdAt: daysAgo(6),
    lines: [
      { description: 'Quarterly pest control service — 4 visits', ordered_qty: 4, unit_price: 350 },
      { description: 'HVAC filter replacement kit', ordered_qty: 12, unit_price: 28 },
    ],
    approvers: [david],
    auditTrail: [
      { type: 'created', actor: alice, at: daysAgo(6) },
      { type: 'status_change', actor: alice, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(5) },
      { type: 'comment', actor: alice, comment: 'Submitting now to secure the 8-week availability slot with vendor.', at: daysAgo(5) },
    ],
  });

  // ── 18. RECEIVED — Engineering (Bob → Carol) — ~2 weeks ago ──────────────────
  await makeReq({
    owner: bob, title: 'Network switch upgrade — server room',
    vendor: 'Cisco Systems', dept: 'Engineering',
    status: 'received', neededBy: daysAgo(10), createdAt: daysAgo(48),
    lines: [
      { description: 'Cisco Catalyst 9300 48-port switch', ordered_qty: 2, unit_price: 4750, received_qty: 2 },
      { description: 'SFP+ 10G transceiver modules (pair)', ordered_qty: 4, unit_price: 280, received_qty: 4 },
    ],
    approvers: [carol],
    auditTrail: [
      { type: 'created', actor: bob, at: daysAgo(48) },
      { type: 'status_change', actor: bob, oldStatus: 'draft', newStatus: 'submitted', at: daysAgo(47) },
      { type: 'status_change', actor: carol, oldStatus: 'submitted', newStatus: 'approved', at: daysAgo(44) },
      { type: 'status_change', actor: bob, oldStatus: 'approved', newStatus: 'ordered', at: daysAgo(40) },
      { type: 'status_change', actor: bob, oldStatus: 'ordered', newStatus: 'received', at: daysAgo(13) },
    ],
  });

  console.log('   ✓ Created 18 requisitions across all statuses, departments, and date ranges');

  // Summary
  const counts = await prisma.requisition.groupBy({ by: ['status'], _count: { id: true } });
  console.log('\n📊 Requisition status breakdown:');
  for (const c of counts) {
    console.log(`   ${String(c.status).padEnd(10)} → ${c._count.id}`);
  }

  const auditCount = await prisma.auditEvent.count();
  console.log(`\n📋 Audit events created: ${auditCount}`);
  console.log('\n✅ Seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
