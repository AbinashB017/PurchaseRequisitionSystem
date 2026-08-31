-- CreateEnum
CREATE TYPE "Role" AS ENUM ('requester', 'approver');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'ordered', 'received');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('created', 'status_change', 'receipt', 'comment');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "approval_limit" DECIMAL(14,2),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisitions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "needed_by_date" DATE NOT NULL,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'draft',
    "owner_id" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_items" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ordered_qty" DECIMAL(14,2) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "received_qty" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisition_approvers" (
    "requisition_id" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,

    CONSTRAINT "requisition_approvers_pkey" PRIMARY KEY ("requisition_id","approver_id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "type" "AuditEventType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "old_status" "RequisitionStatus",
    "new_status" "RequisitionStatus",
    "reason" TEXT,
    "comment_text" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_dismissals" (
    "requisition_id" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "dismissed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissed_for_needed_by" DATE NOT NULL,

    CONSTRAINT "alert_dismissals_pkey" PRIMARY KEY ("requisition_id","approver_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_approvers" ADD CONSTRAINT "requisition_approvers_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_approvers" ADD CONSTRAINT "requisition_approvers_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_dismissals" ADD CONSTRAINT "alert_dismissals_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_dismissals" ADD CONSTRAINT "alert_dismissals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
