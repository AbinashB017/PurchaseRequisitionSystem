# Architecture

Here's how this app is actually built under the hood.

## The Stack
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL accessed via Prisma ORM
- **Frontend:** React, Vite, TypeScript, styled with TailwindCSS
- **Auth:** JWT stored in HTTP-only cookies, with bcrypt for password hashing

## Folder Structure
This is a standard monorepo setup:
- `/client/` - Everything frontend-related. React components, pages, routing, API client logic.
- `/server/` - Everything backend-related. Express routes, Prisma schema, core business logic.
- `/docs/` - Where these writeups live.

## Client-Server Communication
The frontend talks to the backend via a set of REST endpoints mounted under `/api`. I'm using React Query alongside a pre-configured Axios instance (`client/src/lib/api.ts`) to handle fetching, caching, and automatically attaching the JWT cookies (via `withCredentials: true`). This ensures we don't have to manually pass tokens around in frontend state.

## Centralized State Machine
All requisition lifecycle transitions (submitting, approving, rejecting, ordering, receiving) are locked down in a single centralized module: `server/src/lib/stateMachine.ts`.

I did this deliberately. If I scattered the logic for updating statuses across all the different API routes, it would be way too easy to miss an audit log entry or accidentally allow an illegal transition (like trying to approve a draft). By keeping it centralized, every state change goes through the same strict validation rules and automatically generates the exact same format of `AuditEvent`, ensuring the timeline stays completely bulletproof.
