# Plan

This is how we actually built the system, step by step based on the real conversation history.

- **Phase 1: Foundation & Database**
  Set up the monorepo structure, wired up the Express server and Vite frontend, and designed the Prisma schema. We locked down the PostgreSQL models and ran the initial migrations.

- **Phase 2: Authentication**
  Built the JWT and bcrypt-based auth system. Implemented the HTTP-only cookie policies, created the login/registration API routes, and built the React AuthContext on the frontend so the app knows who is logged in.

- **Phase 3: Core API (CRUD)**
  Built the heavy lifting for requisitions. We implemented the ability to create drafts, edit them, add line items, and fetch them from the database based on the user's role.

- **Phase 4: State Machine & Auditing**
  This is where the actual business logic got implemented. We built the centralized `stateMachine.ts` module to handle status transitions securely (submitting, approving, ordering) and ensured every transition automatically generated the proper chronological `AuditEvent` in the database.

- **Phase 5: Queues & Dashboards**
  Built the list views, search, and filtering APIs. Wired up the frontend dashboard to display accurate aggregations (like total pending counts) and built out the specific tabs for approvers to find requisitions assigned to them.

- **Phase 6: E2E Integration & Edge Cases**
  A massive testing phase. We wired everything up end-to-end, tested role boundaries, ensured requesters couldn't see other people's stuff, and implemented the granular bulk approval logic and CSV exports.

- **Phase 7: Aesthetic Overhaul**
  Scrapped the generic styling and applied a custom, premium "ledger" design system. This involved updating the Tailwind config to use a forest-green and off-white palette, adding glassmorphism effects, and refining typography to make the app look significantly better than a typical MVP.

- **Phase 8: Dashboard Interactivity**
  The final polish phase. We made the dashboard charts and metrics clickable so they seamlessly route the user to the requisitions list, pre-filtered with the correct URL parameters based on what was clicked.
