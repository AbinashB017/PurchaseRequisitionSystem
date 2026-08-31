# Assignment 20 — Procurement & Purchase Requisitions

## The scenario

Picture a mid-sized manufacturing company where anyone who needs to buy something — a part, a
tool, a service contract — fills out a paper requisition form, walks it around the building for
a signature, and hands it to purchasing once it has enough initials on it. Purchasing then
emails the vendor, promises a delivery date nobody tracks anywhere, and waits for a box to show
up before anyone checks whether the order was ever placed at all.

The result is predictable. A department head signs off on a request without ever seeing how
much the department has already committed to spend this quarter, because that number lives in
nobody's head and no spreadsheet is current enough to trust. A large order sails through on one
manager's signature when it should have gone to someone with the authority to approve that
much. When a shipment arrives short, the only record of what was actually ordered is the same
paper form, now buried in a drawer, and finance cannot say with any confidence what the company
still owes against orders already placed.

They want one system: requesters submit what they need with the items and quantities spelled
out, approval is automatic up to a limit and escalates above it instead of depending on whose
desk the paper lands on, and every order's progress from request to delivery is tracked in one
place instead of a drawer. Anyone should be able to tell what has been committed but not yet
delivered without chasing purchasing for an answer. That is the system you are building.

## What it must do

Everything below is required. Several of the ten spell out exact rules — what happens on an
illegal move, what a bulk action must report back, when a dismissed alert is allowed to
reappear — and those specifics are the actual ask, not just the bold headline in front of them.

1. **Accounts and roles.** People sign in with an email and password, and there are at least two
roles — a requester role and an approver role. Requesters create, edit and submit their own
requisitions, and see only their own; they cannot approve, order or receive any requisition.
Approvers review requisitions submitted by requesters and decide on them, then move approved ones
through ordering and receiving, but cannot create or edit a requisition or its lines, except for
extending a requisition's needed-by date once it is ordered. Every approver account carries an
approval limit, an exact decimal amount, and an approver with a higher limit than another counts as
a higher approver. The difference must be enforced on the server, not just hidden in the interface.

2. **Requisitions.** Requesters create requisitions with a title, a vendor name, a department, and a
needed-by date, and can edit them before submitting. Every requisition belongs to exactly one
requester, its owner. Once a requisition is ordered, an approver may extend its needed-by date.
Requisitions can be archived and restored. Archiving hides a requisition from the default views
without destroying its line items or its history.

3. **Line items.** Every line item belongs to exactly one requisition and carries an item
description, an ordered quantity, a unit price as an exact decimal amount, and a received
quantity that starts at zero. Lines can be added, edited or removed until the requisition is
submitted. A requisition's total is always the sum of its lines' ordered quantity multiplied by
unit price, calculated by the server, never a value the client can set directly. Opening a
requisition shows its line items.

4. **A requisition lifecycle.** A requisition runs *Draft → Submitted → Approved* or *Rejected*, and
an Approved requisition later moves through *Ordered* to *Received*. Only the requisition's owner
may submit it, and only an approver may approve or reject a Submitted requisition. Approval fails
when the total exceeds that approver's own approval limit, sending it to a higher approver instead,
while a rejection requires a reason and returns the requisition to Draft for its owner to amend and
resubmit. An approver moves an Approved requisition to Ordered once it is placed with the vendor,
then records receipt against each line without exceeding its ordered quantity; the requisition moves
to Received only once every line's received quantity equals its ordered quantity, and a partial
receipt leaves it Ordered, still open. An Ordered requisition past its needed-by date with any line
still short of its ordered quantity counts as overdue, though it remains Ordered until receiving is
complete. Any other move must be rejected by the server with a message explaining why.

5. **Assigned approvers.** Any number of approvers can be assigned to a requisition as its
eligible approvers, and an approver can be assigned to any number of requisitions. Any approver
can add or remove another approver's eligibility on a requisition. Every approver can see the
full queue of Submitted requisitions awaiting a decision, as well as a filtered list of just the
requisitions assigned to them.

6. **Finding requisitions.** One list shows every requisition the viewer can see, with a text
search over title and vendor name, filters for status, department, owner and overdue, sorting by
needed-by date, total or status, and pagination showing the total number of matches. All of this
must happen on the server — do not load every requisition into the browser and filter there.

7. **Acting on many requisitions at once.** An approver selects several Submitted requisitions
and bulk-approves them in one action. The server checks each individually against the approver's
own approval limit: those at or below it are approved, and those above it are refused, with the
per-requisition report naming which succeeded and which exceeded the limit. Separately, export
open commitments — every requisition still Ordered, with its vendor, total and needed-by date —
as a CSV file.

8. **A dashboard.** A landing view shows headline numbers — requisitions awaiting approval, the
value of open commitments, requisitions overdue, and requisitions received this week. It also
breaks requisitions down by status and by department, and charts requisitions received per week
over the last eight weeks.

9. **History you cannot rewrite.** Every requisition has a timeline showing when it was created,
every status change with the old and new status, who made it, and the reason on any rejection,
every receipt recorded against its lines, and any comments left on it by the requester or an
approver. Nothing in this timeline can be edited or deleted after the fact, including by approvers.

10. **Overdue receipt alerts.** A requisition that counts as overdue appears in an alerts area,
with a count badge visible in the navigation. An approver can dismiss the alert for a requisition
assigned to them. If the needed-by date later changes and then passes again before receiving is
complete, the alert returns.

## Stretch ideas (optional)

None of these are required, and none substitute for a goal above. If you finish all ten with
time left over, pick whichever of these sounds most useful and build it:

- Multi-level approval chains beyond a single escalation step.
- A vendor catalog with preferred items and negotiated pricing.
- Three-way matching between requisition, receipt and vendor invoice.
- Budget tracking against each department's quarterly allocation.
- Vendor performance scoring based on delivery timeliness.
- Blanket purchase orders spanning multiple deliveries over time.
- Email notifications when a requisition needs approval or is overdue.
- A mobile-friendly approval flow for approving requests on the go.
- Automatic reorder suggestions based on historical purchasing patterns.


---

## What we are assessing

A working application is table stakes. Almost every serious candidate will produce something that runs, has a login, and roughly does what was asked. That's the floor, not the differentiator.

What actually separates submissions is the record of thinking behind the app: the decisions you made and why, the trade-offs you weighed, what you built first and what you deliberately left out, and whether you can explain any part of your own system when asked. We are hiring for judgement. The app is the evidence for that judgement, not the deliverable in itself.

We also read the code itself for structure and readability, which counts for a small share of the overall score.

## Time budget

Budget about 12 hours total, spent roughly 2 hours a day across a week.

This is not a race. We are not timing you against other candidates, and submitting early scores nothing extra. Twelve hours is a size guide so you know how much to attempt — pace yourself, stop when you're tired, and spend some of that time thinking and documenting, not only typing code.

## Pick any stack you like

Use any language, any framework, any UI library, any ORM, and any database access approach you want. We have no house stack, and no stack scores better than another — this round is not a test of whether you know particular tools.

Use whatever you are fastest and most confident in. Time spent learning something new to impress us is time not spent on the ten goals above, and it will show.

## Using AI is allowed and encouraged

Use AI tools however you want — to scaffold code, debug a stuck problem, write tests, draft documentation, or anything else that helps you move faster. A few things to know about how we treat it:

- We do not penalise AI use, and we make no attempt to detect it.
- We care about whether you understood, directed and verified the output — not about who or what produced the first draft of it.
- `docs/ai-prompts.md` must contain the prompts you actually used, including the ones that produced bad output and what you changed afterwards. If you used no AI at all, say so here and describe how you worked instead — that is assessed the same way.
- Submitting generated code you cannot explain is the single most common way candidates fail this round.

You are accountable for everything in your submission. If a reviewer points at a piece of code and asks why it's there, or why it works the way it does, "the AI wrote it" is not an answer.

## Use git properly

Publish to a public GitHub repository, and commit incrementally as the work actually happens — after each meaningful step, not in one pass at the end.

A repository whose entire history is a single "initial commit" containing a finished app scores zero on git history, and it colours how we read everything else in your submission, however good the app itself is. Your history is how we see the order you built in, where you got stuck, and how the design changed along the way. If it isn't there, we can't assess it, and we won't assume the best.

## What you must commit

Alongside your code, commit these five files under `docs/`. Your zip includes a stub for each with the questions it needs to answer — fill them in as you go, not from memory at the end.

| File | What it must answer |
|------|----------------------|
| `docs/architecture.md` | What the moving pieces are, how they talk to each other, where each one runs, the request path for one representative user action end to end, and what you decided not to build. |
| `docs/schema.md` | Every table's columns and types, which relationships are one-to-many versus many-to-many, which constraints live in the database versus the application, what you deliberately denormalised, and what would break first at 100x the data. |
| `docs/plan.md` | How you split the work into sessions, what order you built in and why, what you estimated versus what it actually took, and what you cut when you ran short. |
| `docs/decisions.md` | At least five real decisions — what you chose, what you rejected, and why — including at least one you later reversed. |
| `docs/ai-prompts.md` | The prompts you actually used, in order, grouped by what you were trying to do, including at least one that produced something wrong and what you did about it. |

## Host it for free

Deploy the whole thing somewhere reachable by URL, using free tiers only.

One combination that works, if you would rather not decide:

- **Database** — a managed service such as Supabase.
- **Server-side code** — Render.
- **Browser-side code** — Vercel.

Deploy in that order: create the database first, give the server its connection details as environment variables, then point the browser-side part at the server's public URL.

This is one option, not a requirement. Any free host is equally acceptable — everything on a single provider, one virtual machine, a container platform, a static host with serverless functions. The choice earns and loses nothing.

Requirements:

- A working live URL.
- Seeded with enough demo data to show the system doing something, not an empty shell.
- Demo credentials for every role recorded in `SUBMISSION.md`.
- Connection strings, keys and passwords kept in environment variables, never in the repository.
- Free tiers often sleep when idle and can take a minute or more to wake. Note it in `SUBMISSION.md` if yours does, so a slow first load is not read as a broken deployment.
- If you cannot get it hosted, submit anyway and record in `SUBMISSION.md` what you tried and where it broke.

## How to submit

Send us:

- The URL of your public GitHub repository.
- The URL of your live, deployed application.
- Your completed `SUBMISSION.md`, committed to the repository.

That's the whole submission. Nothing else to prepare, no separate form.

## What happens next

If your submission clears the bar, we'll set up a short call. We will ask about specific decisions we can see in your repository and its history — why you modelled something a particular way, what a certain commit was fixing, what you'd change if you kept going.

We're telling you this now because it should change how carefully you document as you go. Write `docs/decisions.md` for a version of yourself who has to explain it three weeks from now.

## Scope

The 10 goals stated in this brief are the cutoff. Meet all 10, solidly, and you have a complete submission.

Stretch ideas are optional. They exist for candidates who finish the 10 with time left and want to keep building — they are never required, and they do not make up for a goal you didn't hit. Doing 8 goals well beats doing 10 goals badly. If time is short, finish fewer goals properly rather than leaving all ten half-done.
