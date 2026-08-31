import prisma from './prisma';
import { RequisitionStatus, AuditEventType } from '@prisma/client';

/**
 * Centralized state machine for requisition status transitions.
 * Every status change goes through this module to ensure:
 * 1. The transition is valid per the state machine rules
 * 2. An AuditEvent is always written atomically with the change
 * 3. Error messages are consistent
 */

// Valid transitions: from -> [allowed destinations]
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'draft'],   // draft = rejection
  approved: ['ordered'],
  ordered: ['received'],              // auto-transition when all lines fully received
};

export class TransitionError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'TransitionError';
    this.statusCode = statusCode;
  }
}

interface TransitionOptions {
  requisitionId: string;
  fromStatus: RequisitionStatus;
  toStatus: RequisitionStatus;
  actorId: string;
  auditType: AuditEventType;
  reason?: string;
  commentText?: string;
  metadata?: Record<string, any>;
}

/**
 * Validates and executes a status transition inside a Prisma transaction.
 * Returns the updated requisition with line items.
 */
export async function executeTransition(options: TransitionOptions) {
  const { requisitionId, fromStatus, toStatus, actorId, auditType, reason, commentText, metadata } = options;

  // Validate the transition is allowed
  const allowed = VALID_TRANSITIONS[fromStatus];
  if (!allowed || !allowed.includes(toStatus)) {
    throw new TransitionError(
      `Invalid transition: cannot move from "${fromStatus}" to "${toStatus}"`
    );
  }

  // Perform status update + audit event atomically
  const result = await prisma.$transaction(async (tx) => {
    // Verify current status hasn't changed (optimistic locking)
    const current = await tx.requisition.findUnique({ where: { id: requisitionId } });
    if (!current) {
      throw new TransitionError('Requisition not found', 404);
    }
    if (current.status !== fromStatus) {
      throw new TransitionError(
        `Requisition is currently "${current.status}", expected "${fromStatus}". It may have been modified by another user.`
      );
    }

    // Update the status
    const updated = await tx.requisition.update({
      where: { id: requisitionId },
      data: { status: toStatus },
      include: {
        line_items: true,
        approvers: { include: { approver: { select: { id: true, name: true, email: true } } } },
        owner: { select: { id: true, name: true, email: true } }
      }
    });

    // Write the audit event
    await tx.auditEvent.create({
      data: {
        requisition_id: requisitionId,
        type: auditType,
        actor_id: actorId,
        old_status: fromStatus,
        new_status: toStatus,
        reason: reason || undefined,
        comment_text: commentText || undefined,
        metadata: metadata || undefined,
      }
    });

    return updated;
  });

  return result;
}

/**
 * Write an audit event WITHOUT a status change (e.g. comments, receipts, date extensions).
 */
export async function writeAuditEvent(options: {
  requisitionId: string;
  actorId: string;
  type: AuditEventType;
  reason?: string;
  commentText?: string;
  metadata?: Record<string, any>;
  oldStatus?: RequisitionStatus;
  newStatus?: RequisitionStatus;
}) {
  return prisma.auditEvent.create({
    data: {
      requisition_id: options.requisitionId,
      type: options.type,
      actor_id: options.actorId,
      old_status: options.oldStatus || undefined,
      new_status: options.newStatus || undefined,
      reason: options.reason || undefined,
      comment_text: options.commentText || undefined,
      metadata: options.metadata || undefined,
    }
  });
}

/**
 * Helper: compute the total of a requisition from its line items.
 */
export function computeTotal(lineItems: { ordered_qty: any; unit_price: any }[]): number {
  return lineItems.reduce((acc, line) => {
    return acc + (Number(line.ordered_qty) * Number(line.unit_price));
  }, 0);
}
