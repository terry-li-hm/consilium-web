---
title: "feat: Hosted API keys for Pro tier + usage caps for free tier"
type: feat
status: active
date: 2026-03-06
origin: docs/brainstorms/2026-03-06-consilium-saas-strategy-brainstorm.md
---

# feat: Hosted API keys for Pro tier + usage caps for free tier

## Overview

The current BYOK model forces all users — including non-technical laymen — to acquire an OpenRouter key before they can use the app. This is high friction for the target Pro audience (consultants, strategists). The CLI will always be BYOK (developers self-select). The web Pro tier should be keyless: we hold the API key server-side, users just pay $10/mo and deliberate.

**Strategy update from brainstorm:** The brainstorm (2026-03-06) recorded "BYOK for now" and "Not hosted compute" as early decisions. This plan supersedes that — real-world observation shows BYOK blocks layman conversion. Developers use the CLI anyway. (See brainstorm: `docs/brainstorms/2026-03-06-consilium-saas-strategy-brainstorm.md`)

---

## Proposed Solution

### Three-path model

| User | Key source | Cap |
|---|---|---|
| Anonymous (no login) | BYOK or blocked | Require login to use |
| Free (logged in) | BYOK required | 20 runs / day |
| Pro ($10/mo) | Server-hosted | Unlimited |

### Core mechanism

Deliberation currently runs fully **client-side**: `runDeliberation()` is called in a `useEffect`, and each `streamCompletion()` call fetches OpenRouter directly from the browser with the user's key.

For hosted Pro mode we **keep the orchestration client-side** (no server-side rewrite needed) and only proxy the individual LLM fetch calls:

```
Browser (orchestration loop)
  → streamCompletion(model, messages, apiKey=null)
  → POST /api/stream { model, messages }      ← new route
  → OpenRouter API (server holds the key)
  → SSE stream back to browser
```

This is the minimal-impact path: one new server route, small changes to `lib/streaming.ts`, and client-side tier detection.

---

## Implementation Plan

### Task 1 — `/api/stream` SSE proxy route (new file)
**File:** `app/api/stream/route.ts`

```typescript
export const runtime = 'nodejs'

export async function POST(request: Request) {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Pro tier check — profiles.tier is source of truth
  const { data: profile } = await supabase
    .from('profiles').select('tier').eq('id', user.id).single()
  if (profile?.tier !== 'pro')
    return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 })

  // 3. Parse body
  const { model, messages, max_tokens } = await request.json()

  // 4. Proxy to OpenRouter, piping stream directly through
  const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://consilium.sh',
      'X-Title': 'consilium.sh',
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens }),
  })

  if (!orRes.ok) {
    const err = await orRes.text()
    return NextResponse.json({ error: err }, { status: orRes.status })
  }

  // Pipe stream directly — no buffering, minimal latency
  return new Response(orRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

**Security notes:**
- Model param is passed through — consider an allowlist against `PANELISTS` model IDs to prevent key abuse for arbitrary models
- No rate limiting on this route beyond the daily cap checked client-side (TOCTOU acceptable at this scale)
- `OPENROUTER_API_KEY` must be added to Vercel env vars

---

### Task 2 — `/api/runs/limit` usage cap route (new file)
**File:** `app/api/runs/limit/route.ts`

```typescript
const DAILY_LIMITS: Record<string, number> = {
  pro: Infinity,
  free: 20,
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tier').eq('id', user.id).single()
  const tier = profile?.tier ?? 'free'
  const limit = DAILY_LIMITS[tier] ?? 20

  if (limit === Infinity) {
    return NextResponse.json({ allowed: true, used: 0, limit: null, tier })
  }

  // Count today's completed runs (phase = 'done')
  const today = new Date().toISOString().slice(0, 10)
  const { count } = await supabase
    .from('runs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', today)

  const used = count ?? 0
  return NextResponse.json({
    allowed: used < limit,
    used,
    limit,
    tier,
  })
}
```

**Note:** Counts all runs (not just `phase='done'`) to avoid users gaming the cap by leaving runs incomplete. Only applies to logged-in users — anonymous users are blocked at the home page.

---

### Task 3 — `lib/streaming.ts`: add proxy path
**File:** `lib/streaming.ts`

Change `streamCompletion` and `completeOnce` to accept `apiKey: string | null`:
- When `apiKey` is non-null → existing behaviour (direct OpenRouter call)
- When `apiKey` is null → POST to `/api/stream` with same body shape

```typescript
// Current signature (line 30):
export async function* streamCompletion(
  model: string,
  messages: Message[],
  apiKey: string,  // ← change to string | null
  ...

// Branch inside:
const url = apiKey
  ? 'https://openrouter.ai/api/v1/chat/completions'
  : '/api/stream'
const headers = apiKey
  ? buildHeaders(apiKey)
  : { 'Content-Type': 'application/json' }
```

`completeOnce` similarly: change `apiKey: string` → `apiKey: string | null` and apply same branch.

---

### Task 4 — `lib/consilium.ts`: thread null apiKey through
**File:** `lib/consilium.ts`

Change `runDeliberation(question, mode, apiKey, ...)` to accept `apiKey: string | null`. TypeScript will flag all internal usages — update `streamCompletion` and `completeOnce` call sites (all accept `string | null` after Task 3).

No logic changes needed — just type propagation.

---

### Task 5 — `app/run/page.tsx`: tier detection + cap check + Pro bypass
**File:** `app/run/page.tsx`

**New state:**
```typescript
const [tier, setTier] = useState<'free' | 'pro' | null>(null)
const [capAllowed, setCapAllowed] = useState<boolean | null>(null)
```

**On mount (before starting deliberation):**
```typescript
// Fetch tier + cap in parallel
const [tierRes, capRes] = await Promise.all([
  supabase.from('profiles').select('tier').eq('id', user.id).single(),
  fetch('/api/runs/limit').then(r => r.json()),
])
const userTier = tierRes.data?.tier ?? 'free'
setTier(userTier)
setCapAllowed(capRes.allowed)

// Determine apiKey for this run
const resolvedKey = userTier === 'pro' ? null : getApiKey()
if (userTier !== 'pro' && !resolvedKey) { router.push('/'); return }
if (!capRes.allowed) { setError('DAILY_CAP_REACHED'); return }

// Start deliberation
runDeliberation(q, mode, resolvedKey, handleUpdate, domain, signal)
```

**Error state:** Add `'DAILY_CAP_REACHED'` error type — show upgrade prompt linking to `/pricing`.

**Loading state:** Between page load and tier resolution, show a brief "Preparing..." skeleton (reuse `PanelSkeleton`) so users don't see a blank page on Pro.

---

### Task 6 — `app/page.tsx`: Pro bypass for canSubmit + hide ApiKeySetup
**File:** `app/page.tsx`

```typescript
const [userTier, setUserTier] = useState<'free' | 'pro' | null>(null)

useEffect(() => {
  const supabase = createClient()
  supabase.auth.getUser().then(({ data }) => {
    if (!data.user) return
    supabase.from('profiles').select('tier').eq('id', data.user.id).single()
      .then(({ data: p }) => setUserTier(p?.tier ?? 'free'))
  })
}, [])

// canSubmit: Pro users don't need a key
const canSubmit = !!question.trim() && (userTier === 'pro' || !!apiKey)
```

Conditionally render `ApiKeySetup`:
```tsx
{userTier !== 'pro' && (
  <ApiKeySetup existingKey={apiKey} onSave={k => setApiKey(k)} onClear={() => setApiKey(null)} />
)}
{userTier === 'pro' && (
  <p className="text-xs text-muted-foreground text-center">
    ✓ API key included with your Pro plan
  </p>
)}
```

---

### Task 7 — `app/pricing/page.tsx`: update price + copy
**File:** `app/pricing/page.tsx`

- Change `$9` → `$10`
- Change Free subtitle from `"Your OpenRouter key, your cost"` → `"Bring your own OpenRouter API key"`
- Change Pro subtitle from `"Everything in Free, plus:"` → `"No API key needed — we handle it"`
- Add Pro feature: `"Hosted inference (no OpenRouter account needed)"`
- Update Pro features list order: lead with "No API key required" as #1 feature

---

### Task 8 — Environment + `.env.example`
**New file:** `.env.example`

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://consilium.sh

# Hosted mode — server-side OpenRouter key (Pro tier)
OPENROUTER_API_KEY=sk-or-v1-...
```

Add `OPENROUTER_API_KEY` to Vercel env vars after deploying.

---

## Acceptance Criteria

### Functional
- [ ] Pro user can complete a full Oxford deliberation without entering any API key
- [ ] Free user with a valid OpenRouter key can complete a run (unchanged behaviour)
- [ ] Free user hitting the 20/day cap sees a clear upgrade prompt, not a blank error
- [ ] Anonymous user (no login) cannot start a run — see login prompt
- [ ] `/api/stream` returns 403 for non-Pro users who call it directly
- [ ] `/api/stream` returns 401 for unauthenticated requests
- [ ] Pricing page shows $10/mo
- [ ] ApiKeySetup widget is hidden for Pro users on the home page

### Security
- [ ] `OPENROUTER_API_KEY` never appears in client-side bundles
- [ ] `/api/stream` validates model param against known panelist models (allowlist)
- [ ] Tier check reads from DB at request time — not from a client-supplied claim

### Non-functional
- [ ] Hosted mode latency matches direct BYOK mode (stream is piped, not buffered)
- [ ] Usage cap check adds <200ms to run start (parallel with tier check)

---

## System-Wide Impact

### Interaction graph
- `app/page.tsx` now makes a Supabase DB call on mount → adds ~100ms to page load. Cache with `useState` initialized once.
- `app/run/page.tsx` now makes two parallel async calls before starting — tier fetch + cap check. Run starts only after both resolve. Adds ~200ms cold start.
- `/api/stream` is the first SSE route — structurally different from all other routes (uses `new Response(stream)` not `NextResponse.json`). Must use `runtime = 'nodejs'` export.

### Error propagation
- `/api/stream` upstream errors (OpenRouter 429, 402, 503) must be surfaced back to the client. Currently `streamCompletion` in `lib/streaming.ts` parses OpenRouter SSE error events — this still works when the stream is piped through the proxy unchanged.
- New error type `DAILY_CAP_REACHED` needs handling in `app/run/page.tsx` alongside the existing OpenRouter error types.

### State lifecycle risks
- TOCTOU on usage cap: user could fire multiple concurrent runs before any complete and beat the cap. Acceptable at 20/day soft limit — not worth a DB transaction lock.
- If `/api/stream` is called but OpenRouter errors mid-stream, the partial run may be saved to local history as `phase: 'error'` — this already happens in the BYOK path, no change needed.

### API surface parity
- CLI `--push` shares runs to the server — not affected (CLI is always BYOK)
- CLI share route (`/api/cli/runs/[id]/share`) does not check tier — existing inconsistency, out of scope

---

## Dependencies & Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Pro user costs exceed $10/mo (heavy users) | Medium | 20 Oxford runs/day limit even for Pro; monitor OpenRouter spend monthly |
| `OPENROUTER_API_KEY` compromised via log exposure | Low | Never log request bodies on `/api/stream`; Vercel env vars are encrypted |
| Tier DB call on every homepage load creates Supabase load | Low | Only fires when user is logged in; Supabase free tier handles ~50K req/day |
| User races cap by firing runs before previous one completes | Low | Soft cap, acceptable at this scale |

---

## Task Dependency Graph

```
Task 1 (/api/stream)      ─┐
Task 2 (/api/runs/limit)  ─┤→ Task 5 (run page)  →  done
Task 3 (streaming.ts)     ─┤→ Task 6 (home page)
Task 4 (consilium.ts)     ─┘
Task 7 (pricing)          ─ independent
Task 8 (.env.example)     ─ independent
```

Tasks 1–4 are interdependent (define the API contract). Tasks 7–8 are independent and can run in parallel with anything. Tasks 5–6 depend on 1–4.

**Swarm approach:**
- Worktree A: Tasks 1+2+8 (new server routes + env file)
- Worktree B: Tasks 3+4 (streaming lib)
- Worktree C: Task 7 (pricing page)
- After merge → Tasks 5+6 in main (client integration, depends on all above)

---

## Sources & References

### Origin
- **Brainstorm:** `docs/brainstorms/2026-03-06-consilium-saas-strategy-brainstorm.md` — original BYOK decision (since superseded by real-world layman friction observation)

### Internal
- `lib/streaming.ts:30` — `streamCompletion` signature to modify
- `lib/streaming.ts:37` — hardcoded OpenRouter URL (branching point)
- `lib/consilium.ts:171` — `runDeliberation` signature
- `app/run/page.tsx:142` — `getApiKey()` call site
- `app/run/page.tsx:153` — `runDeliberation` invocation
- `app/page.tsx:80` — `canSubmit` gate
- `app/api/keys/route.ts:39` — tier gate pattern to follow
- `supabase/migrations/20260306000000_init.sql:3` — `profiles.tier` column definition
- `supabase/migrations/20260306000000_init.sql:24` — `runs.created_at` for cap counting

### Learnings applied
- `~/docs/solutions/nextjs-gotchas.md` — use `proxy.ts` not `middleware.ts`; Supabase env fallbacks for build-time safety
- New SSE route must use `new Response(stream)` not `NextResponse` — structurally different from all existing routes
