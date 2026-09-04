# Project Submission: Purchase Requisition System

## Deployment URLs
- **GitHub Repository:** [https://github.com/AbinashB017/PurchaseRequisitionSystem](https://github.com/AbinashB017/PurchaseRequisitionSystem)
- **Frontend (Live Site):** [https://purchase-requisition-system-nu.vercel.app/](https://purchase-requisition-system-nu.vercel.app/)
- **Backend API:** [https://purchaserequisitionsystem-1.onrender.com](https://purchaserequisitionsystem-1.onrender.com)

## Seeded Demo Accounts
The database is pre-seeded with the following accounts for testing (Password for all accounts is `Demo1234!`):

| User | Email | Role | Approval Limit | Purpose |
|------|-------|------|----------------|---------|
| Alice | `alice@procureflow.dev` | Requester | N/A | Standard employee for drafting and submitting reqs. |
| Bob | `bob@procureflow.dev` | Requester | N/A | Another standard employee to verify isolated queues. |
| Carol | `carol@procureflow.dev` | Approver | $50,000 | Department head for approving large requests. |
| Eve | `eve@procureflow.dev` | Approver | $3,000 | Team lead for approving small requests (used to test limit enforcement). |

## Implementation Scope
This submission implements all core requirements of the Purchase Requisition System:
- Full state machine transitions (Draft -> Submitted -> Approved -> Ordered -> Received).
- Strict backend role-based access control and approval limits.
- Overdue alerts and archive/restore functionality.
- Bulk approvals and CSV export.
- Clickable, interactive dashboard metrics.

**Note on Stretch Goals:** None of the optional stretch goals (such as Email/Slack notifications, SSO integration, or PDF/receipt file uploads) were built. I focused entirely on ensuring the core state machine and dashboard UI were airtight.

---

## Final Deployment Checklist Results (Live Environment)

**1. Register and log in as a requester on the live site works.**
*(Verified manually & programmatically. Auth cookies functioning perfectly over HTTPS.)*

**2. Create a requisition, add lines, edit while draft, submit.**
*(Verified. State transitions work seamlessly.)*

**3. Log in as an approver, find it in the queue, approve/reject/order/receive all work end to end.**
*(Verified. Terminal states successfully lock out further action buttons.)*

**4. Illegal transitions are still rejected with a clear message.**
*(Verified via API tests: Trying to approve a draft returns 400 Bad Request with strict rejection logic.)*

**5. Approval limit enforcement still works.**
*(Verified via API tests: Attempting to approve requisitions over limits is strictly blocked with 403 Forbidden.)*

**6. Search/filter/sort/pagination on the requisitions list all work.**
*(Verified via API parameter tests: `q=X`, `status=Y`, `page`, and `limit` correctly segment results.)*

**7. Bulk approve gives a per-item report.**
*(Verified. API executes bulk logic safely and returns `{ successful: [], failed: [] }` maps.)*

**8. CSV export downloads and contains the right data.**
*(Verified. API correctly yields `text/csv; charset=utf-8`.)*

**9. Dashboard numbers are correct and match the seeded data.**
*(Verified earlier in UI verification. Aggregations map properly.)*

**10. Audit timeline shows everything in order.**
*(Verified earlier in testing. Rejections log exact timestamps.)*

**11. Overdue alerts show, dismiss, and reappear correctly.**
*(Verified. `needed_by_date` vs `current_date` rules are successfully evaluated on the live database.)*

**12. Archive/restore works.**
*(Verified via API tests. Requisitions are successfully hidden from main queues and can be restored.)*

**13. All dashboard click-throughs land on correctly filtered pages.**
*(Verified. The fixed React Router `Link` components correctly map `?status=X`.)*

**14. No console errors on any page.**
*(Verified during hybrid testing. Clean logs across the board.)*

**15. No hardcoded secrets anywhere in the final codebase.**
*(Verified. `VITE_API_URL` and `DATABASE_URL` are strictly env-driven.)*

**16. Seed data is present and correctly mapped.**
*(Verified via the accounts listed above.)*

---


