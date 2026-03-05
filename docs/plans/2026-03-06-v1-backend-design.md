# consilium.sh v1 Backend Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add OAuth, cloud sync, shareable run URLs, Stripe subscription, "Add to Claude Code" button, and CLI push support to consilium.sh.

**Architecture:** Supabase (Postgres + Auth + Edge Functions) as the backend. Next.js API routes proxy Supabase operations. CLI pushes completed runs via personal API keys. Stripe Checkout + webhooks gate the pro tier.

**Tech Stack:** Next.js 16, Supabase JS v2, Stripe Node SDK, nanoid for slugs, @supabase/ssr for cookie-based auth.

---

## Approved Design

### Data Model (Supabase Postgres)

```sql
-- users tier and Stripe linkage (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users primary key,
  tier text not null default 'free',        -- 'free' | 'pro'
  stripe_customer_id text,
  created_at timestamptz default now()
);

-- deliberation runs (web + CLI)
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,       -- null = anonymous local-only (never stored)
  question text not null,
  mode text not null,
  domain text,
  phase text not null default 'done',
  payload jsonb not null,                   -- full RunState JSON
  is_public boolean not null default false,
  slug text unique,                         -- nanoid for /r/<slug>
  source text default 'web',               -- 'web' | 'cli'
  created_at timestamptz default now()
);

-- personal API keys for CLI push
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  key_hash text not null unique,           -- sha256 of the raw key
  label text,
  last_used_at timestamptz,
  created_at timestamptz default now()
);
```

Row-level security: users can only read/write their own rows. Public runs readable by anyone.

---

### Feature 1: "Add to Claude Code" Button (no backend)

A button on the landing page hero section. Copies a CLAUDE.md snippet + install command to clipboard:

```
# Add this to your CLAUDE.md:
For multi-model deliberation on hard decisions, run:
  consilium "<your question>" [--mode oxford|quick|redteam|premortem|forecast]

# Install the CLI:
cargo install consilium   # or: curl -fsSL https://consilium.sh/install.sh | sh
```

No API key or account required. Pure frontend. Ship immediately.

---

### Feature 2: OAuth + Cloud Sync

- Providers: GitHub + Google (via Supabase Auth)
- Auth state via `@supabase/ssr` cookie helpers in Next.js middleware
- After login: completed runs auto-sync (POST to `/api/runs`)
- Anonymous runs: "Save to account?" prompt after first completion
- Free tier: unlimited cloud sync (no paywall on sync itself — paywall is on sharing)
- History page: merges localStorage runs + cloud runs, deduplicates by id

**API routes:**
- `POST /api/runs` — save a completed run (auth required)
- `GET /api/runs` — list user's runs (auth required)
- `POST /api/keys` — generate a CLI API key (auth required)
- `DELETE /api/keys/[id]` — revoke a key (auth required)

---

### Feature 3: Shareable Run URLs (pro gate)

- `POST /api/runs/[id]/share` — sets `is_public=true`, generates `slug`, returns URL (pro only)
- Public view: `/r/[slug]` — read-only run renderer, no API key required
- "Share" button on completed run page (shows upgrade prompt for free users)
- CLI: `consilium --share <run-id>` pushes run + generates URL, prints it

---

### Feature 4: Stripe Subscription

- Plan: Pro at $9/month (single plan, no tiers within pro)
- `POST /api/billing/checkout` — creates Stripe Checkout session, redirects
- `POST /api/billing/portal` — Stripe Customer Portal for manage/cancel
- `POST /api/webhooks/stripe` — handles `customer.subscription.created/deleted`, updates `profiles.tier`
- Pro gate enforced server-side in `/api/runs/[id]/share`
- UI: `/pricing` page (simple: Free vs Pro table), upgrade button in nav when logged in

---

### Sequence

1. "Add to Claude Code" button — no backend, ships immediately
2. Supabase setup (schema, RLS, env vars)
3. OAuth + `@supabase/ssr` middleware + login/logout UI
4. Cloud sync (POST /api/runs after deliberation completes)
5. API key management page (for CLI users)
6. `/r/[slug]` public run renderer
7. Share button + pro gate
8. Stripe Checkout + webhook + pricing page
9. CLI `--push` and `--share` flags (Rust, separate PR)

---

### Environment Variables Required

```
# Supabase (from supabase.com project settings)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe (from stripe.com dashboard)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
```
