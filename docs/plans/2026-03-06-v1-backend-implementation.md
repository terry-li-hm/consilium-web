# consilium.sh v1 Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "Add to Claude Code" button, OAuth, cloud sync, shareable run URLs, Stripe pro tier, and CLI push support to consilium.sh.

**Architecture:** Supabase (Postgres + Auth) as backend accessed via Next.js API routes. `@supabase/ssr` for cookie-based session management. Stripe Checkout + webhooks for subscriptions. Phase 1 tasks need no credentials; Phase 2+ require env vars.

**Tech Stack:** Next.js 16 App Router, Supabase JS v2, @supabase/ssr, Stripe Node SDK, nanoid

---

## Phase 1 — No Credentials Required (dispatch immediately)

### Task 1: "Add to Claude Code" button

**Files:**
- Modify: `app/page.tsx`
- Create: `components/AddToClaudeButton.tsx`

**Step 1: Create the component**

```tsx
// components/AddToClaudeButton.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const CLAUDE_SNIPPET = `# consilium — multi-model deliberation
# Add this to your CLAUDE.md to use consilium from Claude Code:

For hard decisions, strategic questions, or anything worth a second opinion,
run: \`consilium "<your question>"\` (CLI) or visit https://consilium.sh

# Install CLI (requires Rust):
# cargo install consilium
# Then set OPENROUTER_API_KEY in your .zshenv

# Or use the web app directly at https://consilium.sh — paste your OpenRouter key and go.`

export function AddToClaudeButton() {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(CLAUDE_SNIPPET)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-2">
      <span>{copied ? '✓ Copied' : '+ Add to Claude Code'}</span>
    </Button>
  )
}
```

**Step 2: Add to landing page hero**

In `app/page.tsx`, import `AddToClaudeButton` and add it below the main heading:

```tsx
import { AddToClaudeButton } from '@/components/AddToClaudeButton'
// ... inside the hero section, after the subtitle:
<AddToClaudeButton />
```

**Step 3: Build check**

```bash
cd ~/code/consilium-web && pnpm build 2>&1 | grep -E "✓|Error"
```
Expected: `✓ Compiled successfully`

**Step 4: Commit**

```bash
git add components/AddToClaudeButton.tsx app/page.tsx
git commit -m "feat: add 'Add to Claude Code' copy button on landing page"
```

---

### Task 2: Static pricing page

**Files:**
- Create: `app/pricing/page.tsx`

**Step 1: Create pricing page**

```tsx
// app/pricing/page.tsx
export default function PricingPage() {
  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto space-y-12 pt-16">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold">Simple pricing</h1>
        <p className="text-muted-foreground">Free with your own API key. Pro for sharing and sync.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free */}
        <div className="border rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Free</h2>
            <p className="text-3xl font-bold mt-1">$0</p>
            <p className="text-sm text-muted-foreground">Your OpenRouter key, your cost</p>
          </div>
          <ul className="space-y-2 text-sm">
            {['All 5 deliberation modes', 'Full streaming debate UI', 'Local history (browser)', 'Export to Markdown / PDF', 'Claude Code integration'].map(f => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-green-500">✓</span> {f}
              </li>
            ))}
          </ul>
          <a href="/" className="block w-full text-center border rounded-lg py-2 text-sm hover:bg-muted transition-colors">
            Start free
          </a>
        </div>

        {/* Pro */}
        <div className="border-2 border-primary rounded-xl p-6 space-y-4 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
            Coming soon
          </div>
          <div>
            <h2 className="text-xl font-semibold">Pro</h2>
            <p className="text-3xl font-bold mt-1">$9<span className="text-base font-normal text-muted-foreground">/mo</span></p>
            <p className="text-sm text-muted-foreground">Everything in Free, plus:</p>
          </div>
          <ul className="space-y-2 text-sm">
            {['Cloud history sync', 'Shareable run URLs', 'CLI push + share', 'Cross-device access'].map(f => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-primary">✓</span> {f}
              </li>
            ))}
          </ul>
          <button disabled className="w-full border rounded-lg py-2 text-sm opacity-50 cursor-not-allowed">
            Join waitlist (soon)
          </button>
        </div>
      </div>

      <div className="text-center">
        <a href="/" className="text-sm text-muted-foreground hover:underline">Back to app</a>
      </div>
    </main>
  )
}
```

**Step 2: Add pricing link to landing page nav**

In `app/page.tsx`, add a small "Pricing" link near the "View past deliberations" link at the bottom.

**Step 3: Build + commit**

```bash
pnpm build 2>&1 | grep -E "✓|Error"
git add app/pricing/page.tsx app/page.tsx
git commit -m "feat: add static pricing page (pro coming soon)"
```

---

### Task 3: Public run renderer skeleton `/r/[slug]`

This page renders a completed run read-only. No auth needed. Queries Supabase later — for now renders from a mock/stub.

**Files:**
- Create: `app/r/[slug]/page.tsx`
- Create: `components/PublicRunView.tsx`

**Step 1: Create PublicRunView component**

```tsx
// components/PublicRunView.tsx
import type { RunState } from '@/types/deliberation'

export function PublicRunView({ run }: { run: RunState }) {
  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <div className="border-b pb-4 space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Deliberation</p>
        <h1 className="text-lg font-semibold">{run.question}</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs border rounded px-2 py-0.5">{run.mode}</span>
          {run.domain && <span className="text-xs text-muted-foreground">{run.domain}</span>}
        </div>
      </div>

      {/* Blind responses */}
      {run.blindResponses.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">Initial Positions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {run.blindResponses.map(r => (
              <div key={r.panelistName} className="border rounded-lg p-4 space-y-2">
                <span className="text-xs font-semibold">{r.panelistName}</span>
                <p className="text-sm whitespace-pre-wrap">{r.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Judge synthesis */}
      {run.judgeResponse && (
        <div className="border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-sm">Judge Synthesis</h2>
          <p className="text-sm whitespace-pre-wrap">{run.judgeResponse}</p>
        </div>
      )}

      {/* Recommendations */}
      {run.extraction && (
        <div className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold text-sm">Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-xs font-medium text-green-600 mb-2">Do Now</h3>
              <ul className="space-y-1">{run.extraction.doNow.map((i, n) => <li key={n} className="text-sm">• {i}</li>)}</ul>
            </div>
            <div>
              <h3 className="text-xs font-medium text-amber-600 mb-2">Consider Later</h3>
              <ul className="space-y-1">{run.extraction.considerLater.map((i, n) => <li key={n} className="text-sm">• {i}</li>)}</ul>
            </div>
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">Skip</h3>
              <ul className="space-y-1">{run.extraction.skip.map((i, n) => <li key={n} className="text-sm text-muted-foreground">• {i}</li>)}</ul>
            </div>
          </div>
        </div>
      )}

      <div className="text-center pt-4 border-t">
        <a href="/" className="text-sm text-muted-foreground hover:underline">Run your own deliberation at consilium.sh</a>
      </div>
    </main>
  )
}
```

**Step 2: Create the route**

```tsx
// app/r/[slug]/page.tsx
// NOTE: This is a stub — Supabase query added in Phase 2 Task 6
export default function SharedRunPage({ params }: { params: { slug: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-muted-foreground">This run will be available once sharing is enabled.</p>
        <a href="/" className="text-sm underline">Run your own deliberation</a>
      </div>
    </main>
  )
}
```

**Step 3: Build + commit**

```bash
pnpm build 2>&1 | grep -E "✓|Error"
git add app/r components/PublicRunView.tsx
git commit -m "feat: scaffold public run renderer and /r/[slug] route"
```

---

## Phase 2 — Requires Supabase Credentials

> **Prerequisites:** Set these in `.env.local` and in Vercel project env vars:
> ```
> NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
> NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
> SUPABASE_SERVICE_ROLE_KEY=eyJ...
> ```

### Task 4: Install Supabase + configure middleware

**Step 1: Install packages**

```bash
cd ~/code/consilium-web
pnpm add @supabase/supabase-js @supabase/ssr
```

**Step 2: Create Supabase client helpers**

```ts
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}
```

**Step 3: Create middleware for session refresh**

```ts
// middleware.ts (project root)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  await supabase.auth.getUser()
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Step 4: Run the Supabase SQL schema**

Run this in Supabase SQL editor (project dashboard → SQL Editor):

```sql
-- profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  tier text not null default 'free',
  stripe_customer_id text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- runs table
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  question text not null,
  mode text not null,
  domain text,
  phase text not null default 'done',
  payload jsonb not null,
  is_public boolean not null default false,
  slug text unique,
  source text default 'web',
  created_at timestamptz default now()
);

alter table public.runs enable row level security;
create policy "Users can manage own runs" on public.runs
  for all using (auth.uid() = user_id);
create policy "Public runs are readable by all" on public.runs
  for select using (is_public = true);

-- api_keys table
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  key_hash text not null unique,
  label text,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

alter table public.api_keys enable row level security;
create policy "Users can manage own API keys" on public.api_keys
  for all using (auth.uid() = user_id);
```

**Step 5: Enable OAuth providers in Supabase**

In Supabase dashboard → Authentication → Providers:
- Enable GitHub: add GitHub OAuth app client ID + secret
- Enable Google: add Google Cloud OAuth client ID + secret

**Step 6: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: add Supabase client helpers and session middleware"
```

---

### Task 5: Auth UI — login/logout + nav

**Files:**
- Create: `app/auth/callback/route.ts`
- Create: `components/AuthButton.tsx`
- Modify: `app/layout.tsx`

**Step 1: Auth callback route (Supabase PKCE exchange)**

```ts
// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
```

**Step 2: AuthButton client component**

```tsx
// components/AuthButton.tsx
'use client'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${location.origin}/auth/callback` }
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{user.email}</span>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-xs">Sign out</Button>
      </div>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={signIn} className="text-xs">Sign in</Button>
  )
}
```

**Step 3: Add AuthButton to layout**

In `app/layout.tsx`, add `<AuthButton />` to the top-right area alongside `<ThemeToggle />`. Wrap in a `flex` div:

```tsx
import { AuthButton } from '@/components/AuthButton'
// In <body>:
<div className="fixed top-4 right-4 z-50 flex items-center gap-2">
  <AuthButton />
  <ThemeToggle />
</div>
```

Remove the `fixed top-4 right-4 z-50` classes from `ThemeToggle` itself since the parent now handles positioning.

**Step 4: Build + commit**

```bash
pnpm build 2>&1 | grep -E "✓|Error"
git add app/auth/ components/AuthButton.tsx app/layout.tsx
git commit -m "feat: OAuth login/logout with GitHub (Supabase Auth)"
```

---

### Task 6: Cloud sync — save runs after completion

**Files:**
- Create: `app/api/runs/route.ts`
- Modify: `app/run/page.tsx`

**Step 1: API route to save a run**

```ts
// app/api/runs/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const run = await request.json()
  const { error } = await supabase.from('runs').upsert({
    id: run.id,
    user_id: user.id,
    question: run.question,
    mode: run.mode,
    domain: run.domain ?? null,
    phase: run.phase,
    payload: run,
    source: 'web',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('runs')
    .select('id, question, mode, domain, phase, created_at, is_public, slug')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

**Step 2: Auto-sync in run page after completion**

In `app/run/page.tsx`, after `setDone(true)` in the `handleUpdate` callback, add a cloud sync call:

```ts
if (update.finalState) {
  setRun(update.finalState)
  setDone(true)
  // Sync to cloud if logged in (fire-and-forget)
  fetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update.finalState),
  }).catch(() => {}) // silently fail if not logged in or offline
}
```

**Step 3: Build + commit**

```bash
pnpm build 2>&1 | grep -E "✓|Error"
git add app/api/runs/ app/run/page.tsx
git commit -m "feat: cloud sync — auto-save completed runs to Supabase"
```

---

### Task 7: Shareable run URLs

**Files:**
- Create: `app/api/runs/[id]/share/route.ts`
- Modify: `app/r/[slug]/page.tsx` (connect to Supabase)
- Modify: `app/run/page.tsx` (add Share button)

**Step 1: Install nanoid**

```bash
pnpm add nanoid
```

**Step 2: Share API route**

```ts
// app/api/runs/[id]/share/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check pro tier
  const { data: profile } = await supabase
    .from('profiles').select('tier').eq('id', user.id).single()
  if (profile?.tier !== 'pro') {
    return NextResponse.json({ error: 'Pro required', upgrade: '/pricing' }, { status: 403 })
  }

  // Generate slug and make public
  const slug = nanoid(8)
  const { error } = await supabase
    .from('runs')
    .update({ is_public: true, slug })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: `${process.env.NEXT_PUBLIC_APP_URL}/r/${slug}` })
}
```

**Step 3: Connect public run page to Supabase**

Replace the stub in `app/r/[slug]/page.tsx`:

```tsx
// app/r/[slug]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { PublicRunView } from '@/components/PublicRunView'
import type { RunState } from '@/types/deliberation'
import { notFound } from 'next/navigation'

export default async function SharedRunPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('runs')
    .select('payload')
    .eq('slug', params.slug)
    .eq('is_public', true)
    .single()

  if (!data) return notFound()
  return <PublicRunView run={data.payload as RunState} />
}
```

**Step 4: Share button on run page**

In `app/run/page.tsx`, after the ExportButton in the done state, add:

```tsx
// Add to state:
const [shareUrl, setShareUrl] = useState<string | null>(null)
const [sharing, setSharing] = useState(false)

async function handleShare() {
  if (!run) return
  setSharing(true)
  const res = await fetch(`/api/runs/${run.id}/share`, { method: 'POST' })
  const data = await res.json()
  if (res.ok) {
    setShareUrl(data.url)
    navigator.clipboard.writeText(data.url)
  } else if (data.upgrade) {
    window.location.href = data.upgrade
  }
  setSharing(false)
}

// In JSX, next to ExportButton:
{shareUrl ? (
  <a href={shareUrl} target="_blank" rel="noopener noreferrer"
     className="text-xs underline text-primary">{shareUrl}</a>
) : (
  <Button variant="outline" size="sm" onClick={handleShare} disabled={sharing}>
    {sharing ? 'Sharing...' : 'Share'}
  </Button>
)}
```

**Step 5: Add `NEXT_PUBLIC_APP_URL` to env**

In `.env.local`:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

In Vercel: set to `https://consilium.sh` (or your domain).

**Step 6: Build + commit**

```bash
pnpm build 2>&1 | grep -E "✓|Error"
git add app/api/runs/ app/r/ components/PublicRunView.tsx app/run/page.tsx
git commit -m "feat: shareable run URLs with pro gate and /r/[slug] public view"
```

---

## Phase 3 — Requires Stripe Credentials

> **Prerequisites:** Add to `.env.local` and Vercel env vars:
> ```
> NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
> STRIPE_SECRET_KEY=sk_live_...
> STRIPE_WEBHOOK_SECRET=whsec_...
> STRIPE_PRO_PRICE_ID=price_...
> ```

### Task 8: Stripe Checkout + webhook

**Step 1: Install Stripe**

```bash
pnpm add stripe @stripe/stripe-js
```

**Step 2: Stripe server helper**

```ts
// lib/stripe.ts
import Stripe from 'stripe'
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})
```

**Step 3: Checkout API route**

```ts
// app/api/billing/checkout/route.ts
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?upgraded=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    client_reference_id: user.id,
    customer_email: user.email,
  })

  return NextResponse.json({ url: session.url })
}
```

**Step 4: Stripe webhook**

```ts
// app/api/webhooks/stripe/route.ts
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Use service role for webhook (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const userId = session.client_reference_id
    await supabaseAdmin.from('profiles')
      .update({ tier: 'pro', stripe_customer_id: session.customer })
      .eq('id', userId)
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as any
    await supabaseAdmin.from('profiles')
      .update({ tier: 'free' })
      .eq('stripe_customer_id', sub.customer)
  }

  return NextResponse.json({ ok: true })
}
```

**Step 5: Update pricing page with live Checkout button**

In `app/pricing/page.tsx`, replace the disabled "Join waitlist" button with a working upgrade button:

```tsx
'use client'
// Add at top of file
async function handleUpgrade() {
  const res = await fetch('/api/billing/checkout', { method: 'POST' })
  const { url } = await res.json()
  if (url) window.location.href = url
}

// Replace the disabled button:
<button onClick={handleUpgrade}
  className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm hover:opacity-90">
  Upgrade to Pro — $9/mo
</button>
```

**Step 6: Build + commit**

```bash
pnpm build 2>&1 | grep -E "✓|Error"
git add app/api/billing/ app/api/webhooks/ lib/stripe.ts app/pricing/page.tsx
git commit -m "feat: Stripe Checkout + webhook for pro subscription"
```

---

### Task 9: Deploy with env vars

**Step 1: Add all env vars to Vercel**

```bash
# Run each:
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL production
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
pnpm dlx vercel env add SUPABASE_SERVICE_ROLE_KEY production
pnpm dlx vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
pnpm dlx vercel env add STRIPE_SECRET_KEY production
pnpm dlx vercel env add STRIPE_WEBHOOK_SECRET production
pnpm dlx vercel env add STRIPE_PRO_PRICE_ID production
pnpm dlx vercel env add NEXT_PUBLIC_APP_URL production
# When prompted for value, paste the value
```

**Step 2: Set up Stripe webhook in Stripe dashboard**

- Dashboard → Developers → Webhooks → Add endpoint
- URL: `https://consilium.sh/api/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.deleted`
- Copy the webhook secret → add as `STRIPE_WEBHOOK_SECRET`

**Step 3: Deploy**

```bash
git push && pnpm dlx vercel --prod --yes
```

---

## Phase 4 — CLI Integration (Rust, separate PR)

### Task 10: Add `--push` flag to consilium CLI

**Files:**
- Modify: `~/code/consilium/src/cli.rs` — add `--push` flag
- Modify: `~/code/consilium/src/session.rs` — add `push_to_web()` function

**Step 1: Add CLI flag**

In `src/cli.rs`, add to the Args struct:
```rust
/// Push completed run to consilium.sh (requires CONSILIUM_API_KEY)
#[arg(long)]
pub push: bool,

/// Make pushed run public and print shareable URL
#[arg(long)]
pub share: bool,
```

**Step 2: Implement push function**

In `src/session.rs`:
```rust
pub async fn push_to_web(run: &RunState, share: bool) -> anyhow::Result<Option<String>> {
    let api_key = std::env::var("CONSILIUM_API_KEY")
        .context("CONSILIUM_API_KEY not set — generate one at consilium.sh/settings")?;
    let base = std::env::var("CONSILIUM_API_URL")
        .unwrap_or_else(|_| "https://consilium.sh".to_string());

    let client = reqwest::Client::new();

    // Push the run
    client.post(format!("{base}/api/cli/runs"))
        .header("Authorization", format!("Bearer {api_key}"))
        .json(run)
        .send().await?
        .error_for_status()?;

    if share {
        let res = client.post(format!("{base}/api/cli/runs/{}/share", run.id))
            .header("Authorization", format!("Bearer {api_key}"))
            .send().await?
            .json::<serde_json::Value>().await?;
        return Ok(res["url"].as_str().map(String::from));
    }

    Ok(None)
}
```

**Step 3: CLI API routes for key auth**

```ts
// app/api/cli/runs/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function authenticateCLI(request: Request) {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const rawKey = auth.slice(7)
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const { data } = await supabaseAdmin
    .from('api_keys').select('user_id').eq('key_hash', keyHash).single()
  if (!data) return null
  await supabaseAdmin.from('api_keys').update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)
  return data.user_id as string
}

export async function POST(request: Request) {
  const userId = await authenticateCLI(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const run = await request.json()
  const { error } = await supabaseAdmin.from('runs').upsert({
    id: run.id,
    user_id: userId,
    question: run.question,
    mode: run.mode,
    payload: run,
    phase: 'done',
    source: 'cli',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

**Step 4: API key management page**

```tsx
// app/settings/page.tsx
// Page for logged-in users to generate/revoke CLI API keys
// Shows existing keys (label + last used), "Generate new key" button
// On generate: POST /api/keys → show raw key ONCE with copy button
// (Implementation: straightforward CRUD, see /api/keys/route.ts)
```

**Step 5: Commit CLI changes**

```bash
cd ~/code/consilium
git add src/cli.rs src/session.rs
git commit -m "feat: add --push and --share flags for consilium.sh integration"
cd ~/code/consilium-web
git add app/api/cli/ app/settings/
git commit -m "feat: CLI API key auth routes and settings page"
```

---

## Summary: Dispatch Order

| Wave | Tasks | Needs credentials |
|------|-------|-------------------|
| Immediately | 1, 2, 3 | None |
| After Supabase setup | 4, 5, 6, 7 | Supabase |
| After Stripe setup | 8, 9 | Stripe |
| Parallel with 8-9 | 10 (CLI, in ~/code/consilium) | None |
