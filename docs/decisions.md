# Decisions

Here are the specific, non-obvious calls I had to make during this build and why I made them.

**1. Single-event rejection tracking**
When a requisition is rejected, the user provides a rejection reason. Instead of saving this as two separate events in the database (a status change event and a comment event), I bundled them into a single `status_change` audit event with the reason tucked inside the `metadata` JSONB column. This massively simplifies how the frontend parses and renders the timeline, preventing confusing duplicate entries occurring at the exact same millisecond.

**2. "Assigned Approvers" is for visibility, not gating**
I made the call that the `RequisitionApprover` relationship only affects queue visibility. It does *not* restrict permissions. If you are an approver and you have the URL for a requisition, you can approve it (provided it's under your dollar limit), even if you weren't explicitly assigned to it. This prevents bottlenecks where an assigned approver is out sick and the whole procurement process grinds to a halt.

**3. Incremental receiving**
The `/receive` endpoint does not just toggle a "Received" boolean on the requisition. I built it so it takes a specific quantity integer and increments the `received_quantity` on the line items. This deliberately supports partial fulfillments, because in the real world, vendors rarely ship everything in one flawless box. 

**4. Archive/Restore permissions**
I decided to give archiving and restoring permissions to *both* the original requester (the owner) and *any* approver. If a requester leaves the company, an approver needs the ability to clear out their old, stuck drafts from the active database queues without needing database admin access.

**5. Rolling 7-day metric for charts**
For the dashboard's "received this week" metric and the bar chart buckets, I decided to use a rolling 7-day window relative to the current date rather than snapping to strict calendar weeks (like Sunday-Saturday). This provides a much smoother, continuous view of activity, whereas strict calendar weeks often look completely empty if you happen to view the dashboard on a Monday morning.
