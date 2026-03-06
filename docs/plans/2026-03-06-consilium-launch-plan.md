# Consilium Web Launch Plan

**Date:** 2026-03-06
**Brainstorm:** `docs/brainstorms/2026-03-06-consilium-saas-strategy-brainstorm.md`
**Repo:** `~/code/consilium-web`
**Goal:** Ship consilium.sh — Free (BYOK) + Pro ($9/mo) — from audit findings to live product.

---

## Audit Findings

Built and solid:
- Full deliberation engine (all 5 modes, TypeScript port of Rust CLI)
- DB schema: `profiles`, `runs`, `api_keys` tables with RLS
- CLI push endpoint (`/api/cli/runs`) — API key auth fully implemented
- Stripe checkout session creation (`/api/billing/checkout`)
- Run page with streaming UI (all phases)
- Settings page UI for API key management
- `next.config.ts` clean — no static export conflict

**Blockers (3):**
1. **Stripe webhook missing** — `checkout.session.completed` never handled → Pro never activates
2. **`/api/keys` stub** — Settings page calls it to list/generate/revoke keys; currently returns 401
3. **No env vars** — No `.env.local`, Supabase project not provisioned, Stripe product not set up

**Secondary gaps:**
- Public share route (`/r/[slug]`) is a placeholder stub
- Pro gating not enforced (anyone can hit `/api/cli/runs` with a valid key)
- Grok model stale (still `x-ai/grok-4`, should be `x-ai/grok-4` via OpenRouter with Grok-4.20β label note)

---

## Task Breakdown

### Phase 1: Fix blockers (parallel — independent files)

**Task 1.1 — Implement `/api/keys` routes**
- File: `app/api/keys/route.ts` and `app/api/keys/[id]/route.ts`
- `GET /api/keys` — list user's keys (Supabase, auth required)
- `POST /api/keys` — generate new key (raw UUID shown once, hash stored), Pro tier check
- `DELETE /api/keys/[id]` — revoke key
- Pattern: follow `app/api/cli/runs/route.ts` for Supabase auth pattern
- Verification: `pnpm test` passes; manually: sign in → settings → generate key → key appears

**Task 1.2 — Implement Stripe webhook handler**
- File: `app/api/webhooks/route.ts`
- Handle `checkout.session.completed` → update `profiles.tier = 'pro'` + store `stripe_customer_id`
- Handle `customer.subscription.deleted` → downgrade `profiles.tier = 'free'`
- Verify Stripe signature (`stripe.webhooks.constructEvent`)
- Verification: Stripe CLI `stripe listen --forward-to localhost:3000/api/webhooks` + test event

**Task 1.3 — Wire Stripe Pro subscription to pricing page**
- File: `app/pricing/page.tsx`
- Replace "Join waitlist (soon)" button with real Stripe checkout flow
- On click: `POST /api/billing/checkout` → redirect to Stripe URL
- Show "Upgrade to Pro" only to Free users, "Manage billing" to Pro users (read `profiles.tier`)
- Verification: click upgrade → Stripe checkout opens → complete with test card → redirected back as Pro

---

### Phase 2: Complete secondary gaps (parallel)

**Task 2.1 — Implement public share route (`/r/[slug]`)**
- File: `app/r/[slug]/page.tsx`
- Query `runs` table where `is_public = true AND slug = params.slug`
- Render read-only view of the run (reuse existing run components)
- Add share button on run page that `PATCH /api/cli/runs/[id]/share` (generates slug, sets `is_public = true`)
- Verification: complete a run → click Share → get URL → open URL in incognito → run visible

**Task 2.2 — Update Grok model label in web**
- File: `lib/models.ts`
- Grok panelist: name `'Grok-4.20β'` (still uses `x-ai/grok-4` via OpenRouter, which routes to stable)
- Note in comment: direct xAI API uses `grok-4.20-experimental-beta-0304-reasoning`; BYOK web uses OR
- Verification: run a deliberation, confirm Grok response shown as "Grok-4.20β"

**Task 2.3 — Add Pro gating middleware**
- File: `middleware.ts` (new) or inline in `/api/keys/route.ts`
- Check `profiles.tier` before allowing API key generation (not listing — listing is fine for free)
- If Free: return 402 with `{ error: 'Pro required', upgradeUrl: '/pricing' }`
- Verification: free user hits generate → gets 402; Pro user generates successfully

---

### Phase 3: Environment + deployment

**Task 3.1 — Supabase project setup** *(manual, Terry)*
- Create Supabase project at supabase.com
- Run migration: `supabase db push` or paste `supabase/migrations/20260306000000_init.sql`
- Copy: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Enable email auth in Supabase dashboard

**Task 3.2 — Stripe setup** *(manual, Terry)*
- Create Stripe product: "Consilium Pro", $9/mo recurring
- Copy: `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`
- Add webhook endpoint in Stripe dashboard: `https://consilium.sh/api/webhooks`

**Task 3.3 — Vercel deployment**
- Import `consilium-web` repo to Vercel (or update existing project)
- Set all env vars in Vercel dashboard:
  ```
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  STRIPE_SECRET_KEY
  STRIPE_PRO_PRICE_ID
  STRIPE_WEBHOOK_SECRET
  NEXT_PUBLIC_APP_URL=https://consilium.sh
  ```
- Point `consilium.sh` DNS to Vercel deployment

**Task 3.4 — End-to-end smoke test** *(manual, Terry)*
- Sign up → deliberate (BYOK) → history persists → upgrade to Pro → generate CLI key → `consilium --push` works

---

## Delegation Routing

| Task | Tool | Rationale |
|---|---|---|
| 1.1 `/api/keys` | Codex or Gemini | TypeScript, needs repo nav to follow existing auth pattern |
| 1.2 Stripe webhook | Codex | Stripe SDK, needs to read existing billing setup |
| 1.3 Pricing page wiring | Gemini | UI + fetch call, self-contained |
| 2.1 Share route | Codex | Multi-file (route + component + run page button) |
| 2.2 Model label | In-session | Trivial one-liner |
| 2.3 Pro gating | Gemini | Self-contained, follows existing Supabase auth pattern |
| 3.1–3.4 | Terry manually | External services — can't delegate |

---

## Verification Criteria (Definition of Done)

- [ ] `pnpm build` passes with no errors
- [ ] `pnpm test` passes (all Vitest tests green)
- [ ] Sign up flow works end-to-end
- [ ] Free user: can deliberate with BYOK, sees local history, cannot generate CLI key (402)
- [ ] Pro user: can generate CLI key, `consilium --push` stores run in Supabase, can share run URL
- [ ] Stripe webhook: test card completes → `profiles.tier` updates to 'pro' in DB
- [ ] Share URL (`/r/[slug]`) loads in incognito with no auth required
- [ ] consilium.sh live on Vercel, DNS resolving

---

## What NOT to Build (YAGNI)

- Team/org accounts
- Council mode on web (expensive, long-running — defer; BYOK makes it user's call)
- Mobile app
- In-app deliberation without BYOK (hosted compute adds cost complexity)
- Email notifications, Slack integration
