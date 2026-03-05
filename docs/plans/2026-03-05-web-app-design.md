# consilium.sh Web App — Design Document
Date: 2026-03-05

## Problem

consilium is a powerful multi-model deliberation tool locked behind a CLI. The web app makes it accessible to non-technical users and consulting clients without any installation.

## Architecture Decision

**Client-side only (no backend).** Browser calls OpenRouter directly with a user-supplied API key (BYOK). Next.js static export deployed to Vercel free tier.

Rationale:
- OpenRouter explicitly supports browser-side calls
- BYOK means the API key never touches our server — correct security model for a power-user tool
- consilium is open-source; logic visibility is not a concern
- Eliminates Vercel compute cost and Edge Runtime constraints
- Upgrades to server-side when Stripe is added (v1+)

Downside mitigated: if user closes tab mid-run, partial results are recoverable from localStorage (streamed progressively).

## Stack

- Next.js 15 (App Router, `output: 'export'`)
- Tailwind CSS + shadcn/ui
- TypeScript
- Vercel (free tier, static hosting)
- OpenRouter API (browser-side fetch + ReadableStream)
- localStorage for persistence (no database in v0)

## Models

Same panel as CLI:

| Role | Model | Lab |
|------|-------|-----|
| Panelist | GPT-5.2 Pro | OpenAI |
| Panelist | Claude Opus 4.6 | Anthropic |
| Panelist | Grok 4 | xAI |
| Panelist | Kimi K2.5 | Moonshot |
| Panelist | GLM-5 | Zhipu |
| Judge | Gemini 3.1 Pro | Google |
| Critique | Claude Opus 4.6 | Anthropic |

## Modes

All 5 modes ship in v0: quick, oxford, redteam, premortem, forecast.

Mode selector on landing page: one-line description per mode + tooltip with detail.

## File Structure

```
src/
  app/
    page.tsx              # Landing: question input + mode selector
    run/[id]/page.tsx     # Live debate view
    history/page.tsx      # Past runs from localStorage
  components/
    ModeSelector.tsx      # Mode cards with guided tooltips
    DebatePanel.tsx       # Per-model streaming card
    PhaseProgress.tsx     # Phase progress bar (Blind → XPol → Debate → Judge → Done)
    ApiKeySetup.tsx       # BYOK onboarding modal
    ExportButton.tsx      # MD (clipboard) + PDF (print CSS)
  lib/
    consilium.ts          # Deliberation state machine
    models.ts             # Panel config (models, roles, OpenRouter IDs)
    prompts.ts            # Port of prompts.rs — blind, xpol, debate, judge, critique, extraction
    streaming.ts          # OpenRouter fetch + ReadableStream parser
    storage.ts            # localStorage: API key, run history, in-progress state
  types/
    deliberation.ts       # Phase enum, RunState, ModelResponse, etc.
```

## Data Flow

```
User: question + mode + API key (from localStorage)
  → click "Deliberate"
  → generate run ID, save to localStorage

Phase: blind
  → 5 parallel OpenRouter streams (one per panelist)
  → each token streamed to DebatePanel card as it arrives
  → on completion, all 5 responses saved to run state

Phase: xpol
  → each model receives all 5 blind responses + xpol prompt
  → streams analysis per model

Phase: debate
  → rotating challenger rounds (1-2 rounds, mode-dependent)
  → challenger model receives all prior debate turns

Phase: judge
  → Gemini 3.1 Pro receives anonymised panel outputs
  → synthesizes using ACH framework

Phase: critique
  → Claude Opus receives judge synthesis
  → identifies fallacies, omissions, overconfidence

Phase: extraction
  → judge revises based on critique
  → structured extraction: Do Now / Consider Later / Skip

→ full run saved to localStorage
→ export button enabled (MD clipboard / PDF print)
```

## UX Details

- "Keep tab open" banner appears during run (dismissible after run completes)
- Phase progress bar at top of run view, updates as each phase completes
- Each panelist gets a streaming card with model name, lab badge, token counter
- Cards show tokens arriving in real-time; collapse to summary view after phase ends
- API key stored in localStorage; setup modal on first visit, accessible from settings icon
- Mode selector: 5 mode cards on landing, selected mode highlighted, tooltip on hover
- History page: last 10 runs, each with question preview, mode, timestamp, link to full run
- Partial recovery: if user navigates away mid-run, localStorage has partial state; on return, offer to resume or discard

## Export

- **Markdown:** Copy full deliberation to clipboard as structured MD (phase headers, model labels, judge synthesis, extraction)
- **PDF:** Print CSS optimised for A4; no jsPDF dependency (keeps bundle small)

## Deployment

- Repo: `~/code/consilium-web`
- Domain: `consilium.sh` on Vercel
- CI: Vercel auto-deploy on push to main
- No env vars required (all config client-side)

## v0 Scope Exclusions

- No user accounts
- No Stripe / monetisation
- No server-side processing
- No run sharing (permalink) — v0.2
- No team/org features
- No rate limiting (user's own OpenRouter quota)

## Upgrade Path (v1)

When Stripe is added: migrate pipeline to Vercel Edge Runtime (SSE), add usage tracking, rate limiting, run sharing via database (PlanetScale or Supabase). UI layer unchanged.
