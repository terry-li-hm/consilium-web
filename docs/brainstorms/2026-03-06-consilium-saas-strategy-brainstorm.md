# Consilium SaaS Strategy Brainstorm

**Date:** 2026-03-06
**Status:** Draft — ready for planning
**Scope:** consilium CLI + consilium-web + consilium.sh product direction

---

## What We're Building

Consilium is becoming a SaaS product for knowledge workers who make consequential decisions. The core value: 5 frontier LLMs from 5 different labs debate your question, then Claude Opus judges and synthesises a structured recommendation. No single model can replicate cross-lab diversity + structured adversarial debate.

**Target user:** Strategists, consultants, PMs, founders — people who face decisions with real stakes and can justify $9–20/mo.

**Pricing model:**
- **Free** — BYOK (user provides own OpenRouter API key). Full deliberation, all modes, local history.
- **Pro ($9/mo)** — Cloud sync, shareable run URLs, CLI `--push` integration, cross-device access.

BYOK is a deliberate choice: zero compute cost to us, lower pricing pressure, easier to launch.

---

## Current State

### CLI (`~/code/consilium`, v0.5.3, Rust)
- Mature and feature-complete: 7 deliberation modes, 5-model council, streaming, `--push`/`--share`
- Published to crates.io
- `--push` and `--share` flags exist and point to `consilium.sh/api/cli/runs` — backend API routes exist in consilium-web

### Web App (`~/code/consilium-web`, Next.js 15)
- Built overnight by an agent — never properly reviewed or tested
- Full deliberation engine ported to TypeScript (all modes)
- Supabase for auth + storage, Stripe for billing (both stubbed)
- Pro tier page exists at $9/mo — "Coming soon" gating, not yet wired
- CLI API routes exist: `/api/cli/runs`, `/api/cli/keys`, `/api/billing`, `/api/webhooks`
- Has not been deployed or audited

### Landing Page (`~/code/consilium-site`)
- Static page on Vercel, minimal

---

## Chosen Approach: Audit → Polish → Launch

Treat the overnight web build as a strong foundation, not a prototype to discard. Audit it systematically, fix what's broken, wire up billing, deploy.

**Why this wins over rebuilding:** The architecture decisions (Next.js 15, Supabase, BYOK, Stripe) are all sound. The overnight build likely has UI rough edges and untested billing flows, not fundamental structural problems. Rebuilding wastes weeks.

**Why this wins over API-first:** Knowledge workers are not developers. The web UI is the product for this segment. API-first narrows the market to builders.

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Segment | Knowledge workers | Pay for UX/outcome, not raw API access |
| Compute model | BYOK | Zero cost risk, easier launch |
| Price | Free + $9/mo Pro | Low friction entry, clear upsell hook |
| Pro hook | Cloud sync + CLI push | Power users + recurring value |
| Positioning vs native multi-agent | Use as panelist | Grok-4.20β is now M3 in the council — cross-lab diversity remains the moat |
| Web vs API-first | Web as primary | Target user is not a developer |

---

## Immediate Priorities (Audit → Launch)

### 1. Audit the web app
- Run it locally: `cd ~/code/consilium-web && pnpm dev`
- Test all 5 modes end-to-end with a real OpenRouter key
- Check auth flow (sign up, sign in, session persistence)
- Review UI quality — does it feel like a product or a prototype?
- Identify broken/incomplete features

### 2. Wire up Pro billing
- Stripe webhook → Supabase `subscriptions` table
- API key generation on Pro subscription activation
- Gate `/api/cli/runs` behind valid API key check
- Waitlist → actual "Subscribe" button on pricing page

### 3. Deploy
- Vercel deployment of consilium-web (replace or sit alongside consilium-site)
- Supabase project config (prod env vars)
- Smoke test end-to-end: sign up → BYOK deliberation → upgrade → CLI push

### 4. Soft launch
- consilium.sh live with real auth and BYOK deliberation
- Pro waitlist opens to real subscriptions
- Announce on X/LinkedIn: "Open beta"

---

## Open Questions (Resolved)

- **Grok multi-agent as threat?** No — use it as a panelist. Cross-lab diversity is the moat. *(Resolved)*
- **BYOK vs hosted?** BYOK for now. *(Resolved)*
- **Web vs API-first?** Web primary. *(Resolved)*

## Open Questions (Outstanding)

- **Supabase project:** Is a prod Supabase project set up, or only local dev? Need to check env vars.
- **consilium-web deployment:** Is it currently deployed to Vercel, or only consilium-site?
- **CLI `--push` live?** Does the deployed backend actually accept pushes, or will it 404?
- **UI quality:** Unknown until we run the audit. Could be good enough or need significant work.
- **Council mode on web:** Full council (blind → debate → judge → critique) is the premium experience — is it fully implemented in the TypeScript port?

---

## What consilium is NOT (YAGNI)

- Not a chat interface or AI assistant
- Not an enterprise product (no SSO, audit logs, team seats — yet)
- Not hosted compute (no API margin on model calls)
- Not a model router or aggregator

---

## Next Step

Run `/ce:plan` with this document to create an implementation plan for the audit + launch track.
