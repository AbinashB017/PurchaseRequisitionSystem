# AI prompts

I used Antigravity as my primary execution agent, working through the build in phases, with a
hard rule for myself: review and manually test every phase before letting it move to the next
one, rather than approving based on its own "done" reports. Alongside that, I used Claude in a
separate window to sanity-check Antigravity's proposed plans before approving them, and to help
interpret confusing results or errors.

## Phase 7 — visual design pass

### Prompt

> Before you execute - I want this to feel like a serious internal finance/procurement tool, not a generic SaaS dashboard. Specifically:
> 
> Drop indigo as the primary color. Use a warm off-white background (#FAFAF7), near-black ink text (#1A1D23), and a deep forest green (#1F4D3A) or deep navy (#16324F) as the single accent color for primary actions.
> Replace the identical rounded-card-with-shadow pattern with hairline borders/dividers (1px solid, muted warm gray) structuring the page like a ledger. Only the dashboard summary tiles get a card-like treatment (flat border, no shadow) - don't box everything.
> Redo status badges as a small colored dot + plain text label instead of a rounded tinted pill.
> Pair a refined serif (e.g. Newsreader or Source Serif) for page titles and section headers with a clean sans (Inter or Public Sans) for body text and data. Money/quantity figures should use tabular numbers, right-aligned in tables.
> Drop the uppercase tracked-out labels for metadata/table headers - use normal sentence case at a smaller size/weight instead.
> 
> Give me a revised design plan reflecting this before you touch any code.

### What you got

A design plan that matched what I asked for on paper. But the first execution against that plan
only applied it partially — buttons, links, and backgrounds on the dashboard were still the old
indigo/blue and stark white, even though the approved plan specified the forest-green/off-white
palette everywhere.

### What you corrected

I rejected the result as not matching the approved plan, and told it explicitly which elements
were still wrong (button color, background, chart colors, nav underline) and to do a full pass
across every page and component, not a partial one — and to check theme-level tokens
(tailwind.config.js / CSS variables) rather than just a few individual classes. The second
attempt applied the palette correctly across the app.

## Dashboard interactivity — filter state bug

### Prompt

> PHASE 8.5 (small addition, not a new phase): Make the dashboard interactive.
> 
> GOAL: every number and chart on the dashboard should be a real entry point into the rest of the app, not just a static display. Someone looking at the dashboard should be able to click straight through to the underlying data behind any number they see.
> 
> Specifically:
> "Awaiting Approval" card -> clicking it navigates to the Submitted Queue page.
> "Overdue Orders" card -> clicking it navigates to the Alerts page.
> Each bar in the Status Breakdown chart -> navigates to the requisitions list page, with the status filter already applied.
> Each bar in the Department Breakdown chart -> navigates to the requisitions list pre-filtered to that department.
> The Open Commitments card -> navigates to the requisitions list pre-filtered to status = Ordered.
> The Received (Last 7 Days) card -> navigates to the requisitions list pre-filtered to status = Received.
> 
> IMPLEMENTATION NOTES:
> All of these are navigation actions using React Router plus query parameters that the requisitions list page already reads. Do not modify how that list interprets its filters, only construct the right URL/query-string when navigating to it from the dashboard.

### What you got

Clicking dashboard elements (e.g. the "Draft" status bar, showing 3) navigated to the
requisitions list, but the list showed a different count (1) for the same filter.

### What you corrected

I had Antigravity trace the state flow, and we discovered the root cause was how React's state was trying (and failing) to sync with the URL. The department filter input was bound to immediately update the URL on every keystroke. This meant if you started typing in the filter box, backed out without clearing it, and then clicked a "Draft" dashboard link, React Router would mount the list page with `?status=draft`. 

However, because the component's internal `useEffect` was only listening for changes *to the department URL param*, it never triggered to clear out the dirty local state from the previous visit. The component essentially held onto a ghost filter, ignoring the clean URL.

To fix it, we broke the direct sync. We made the local input state independent, only committing to the URL when the user hit Enter or blurred the field. More importantly, we rewrote the `useEffect` so that any time the URL changed (like clicking a dashboard link), it explicitly synced the local filter state to exactly match the URL parameters—forcing it to `''` if the parameter was missing. This guaranteed the list page would always obey the clean URL provided by the dashboard.
