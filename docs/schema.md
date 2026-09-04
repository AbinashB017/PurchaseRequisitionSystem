# Schema

Here is the exact layout of the database using Prisma.

## Tables and Fields

- **User**: `id` (String UUID), `email` (String), `password_hash` (String), `name` (String), `role` (Enum: requester/approver), `approval_limit` (Float, null for requesters).
- **Requisition**: `id` (String UUID), `title` (String), `vendor_name` (String), `department` (String), `status` (Enum), `needed_by_date` (DateTime), `priority` (Enum), `justification` (String), `owner_id` (String UUID), `archived_at` (DateTime nullable), `created_at`/`updated_at` (DateTime).
- **LineItem**: `id` (String UUID), `requisition_id` (String UUID), `description` (String), `quantity` (Int), `unit_price` (Float), `received_quantity` (Int).
- **RequisitionApprover**: `requisition_id` (String UUID), `approver_id` (String UUID).
- **AuditEvent**: `id` (String UUID), `requisition_id` (String UUID), `actor_id` (String UUID), `type` (Enum: status_change, comment, received), `old_status` (Enum), `new_status` (Enum), `metadata` (JSONB), `created_at` (DateTime).
- **AlertDismissal**: `id` (String UUID), `requisition_id` (String UUID), `user_id` (String UUID), `dismissed_at` (DateTime), `needed_by_snapshot` (DateTime).

## Relationships
- **One-to-Many**: 
  - User -> Requisitions (owner)
  - Requisition -> LineItems
  - Requisition -> AuditEvents
  - Requisition -> AlertDismissals
- **Many-to-Many**: 
  - Requisition <-> User (via the `RequisitionApprover` join table).

## Key Decisions

**1. The unified AuditEvent table**
Instead of having three separate tables for status history, receiving logs, and comments, I deliberately denormalized these into a single append-only `AuditEvent` table using a flexible `metadata` JSONB column. Why? Because when the frontend tries to render the requisition timeline, pulling from three tables and sorting them in memory is a nightmare. This unified table guarantees exact chronological order directly from the database query.

**2. Snapshotting dates in AlertDismissal**
The `AlertDismissal` table tracks when a user dismisses an overdue alert. Instead of just storing a simple boolean or a generic timestamp, it explicitly snapshots the requisition's `needed_by_date` at the exact moment of dismissal (`needed_by_snapshot`). Why? Because if an approver later extends the `needed_by_date` after a dismissal, the alert needs to be capable of re-triggering based on the *new* date. If we just used a boolean, that alert would remain silently dismissed forever.
