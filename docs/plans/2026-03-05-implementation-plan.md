# consilium.sh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a client-side Next.js web app that runs the consilium multi-model deliberation pipeline entirely in the browser via OpenRouter, with live streaming UI and localStorage persistence.

**Architecture:** No backend. Browser calls OpenRouter directly with a user-supplied API key (BYOK). Next.js 15 static export deployed to Vercel. All state in localStorage.

**Tech Stack:** Next.js 15 (App Router, static export), TypeScript, Tailwind CSS, shadcn/ui, pnpm, Vitest for logic tests.

**Reference:** Design doc at `docs/plans/2026-03-05-web-app-design.md`. Prompt source: `~/code/consilium/src/prompts.rs`. Model IDs: check `~/code/consilium/src/config.rs` or `~/code/consilium/src/models.rs` for OpenRouter model strings.

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`

**Step 1: Initialize Next.js 15 with pnpm**

```bash
cd ~/code/consilium-web
pnpm dlx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

**Step 2: Configure static export in `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
}

export default nextConfig
```

**Step 3: Install shadcn/ui**

```bash
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button card input textarea badge tooltip progress separator
```

**Step 4: Install Vitest for unit tests**

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

Create `vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

**Step 5: Verify build works**

```bash
pnpm build
```

Expected: build succeeds, `out/` directory created.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js 15 + Tailwind + shadcn + Vitest"
```

---

## Task 2: TypeScript types

**Files:**
- Create: `types/deliberation.ts`

**Step 1: Write the types**

```typescript
// types/deliberation.ts

export type Mode = 'quick' | 'oxford' | 'redteam' | 'premortem' | 'forecast'

export type Phase =
  | 'idle'
  | 'blind'
  | 'xpol'
  | 'debate'
  | 'judge'
  | 'critique'
  | 'extraction'
  | 'done'
  | 'error'

export interface Panelist {
  name: string        // e.g. "GPT-5.2"
  model: string       // OpenRouter model ID
  lab: string         // e.g. "OpenAI"
}

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ModelResponse {
  panelistName: string
  content: string
  streaming: boolean  // true while tokens are arriving
  confidence?: number // extracted from response if present
}

export interface DebateRound {
  roundNum: number
  responses: ModelResponse[]
}

export interface Extraction {
  doNow: string[]
  considerLater: string[]
  skip: string[]
}

export interface RunState {
  id: string
  question: string
  mode: Mode
  domain?: string
  phase: Phase
  error?: string

  // Phase outputs (accumulated as run progresses)
  blindResponses: ModelResponse[]
  xpolResponses: ModelResponse[]
  debateRounds: DebateRound[]
  judgeResponse: string
  critiqueResponse: string
  finalSynthesis: string
  extraction: Extraction | null

  startedAt: number
  completedAt?: number
}

export interface ModeConfig {
  id: Mode
  label: string
  description: string
  tooltip: string
  rounds: number      // debate rounds
  useBlind: boolean
  useXpol: boolean
}
```

**Step 2: Commit**

```bash
git add types/ && git commit -m "feat: add TypeScript deliberation types"
```

---

## Task 3: Storage utilities

**Files:**
- Create: `lib/storage.ts`
- Create: `lib/storage.test.ts`

**Step 1: Write failing tests**

```typescript
// lib/storage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

import {
  getApiKey, setApiKey, clearApiKey,
  saveRun, getRunHistory, getRunById, deleteRun,
  MAX_HISTORY,
} from './storage'

describe('api key', () => {
  beforeEach(() => localStorageMock.clear())

  it('returns null when not set', () => {
    expect(getApiKey()).toBeNull()
  })
  it('round-trips the key', () => {
    setApiKey('sk-or-test')
    expect(getApiKey()).toBe('sk-or-test')
  })
  it('clears the key', () => {
    setApiKey('sk-or-test')
    clearApiKey()
    expect(getApiKey()).toBeNull()
  })
})

describe('run history', () => {
  beforeEach(() => localStorageMock.clear())

  it('returns empty array when no history', () => {
    expect(getRunHistory()).toEqual([])
  })
  it('saves and retrieves a run', () => {
    const run = { id: 'abc', question: 'test', mode: 'oxford' } as any
    saveRun(run)
    expect(getRunHistory()).toHaveLength(1)
    expect(getRunById('abc')).toEqual(run)
  })
  it(`caps history at ${MAX_HISTORY}`, () => {
    for (let i = 0; i < MAX_HISTORY + 3; i++) {
      saveRun({ id: String(i), question: 'q', mode: 'quick' } as any)
    }
    expect(getRunHistory()).toHaveLength(MAX_HISTORY)
  })
  it('overwrites existing run with same id', () => {
    const run = { id: 'x', question: 'old', mode: 'quick' } as any
    saveRun(run)
    saveRun({ ...run, question: 'new' })
    expect(getRunHistory()).toHaveLength(1)
    expect(getRunById('x')?.question).toBe('new')
  })
})
```

**Step 2: Run tests to see them fail**

```bash
pnpm test lib/storage.test.ts
```

Expected: fails with "Cannot find module './storage'"

**Step 3: Implement storage**

```typescript
// lib/storage.ts
import type { RunState } from '@/types/deliberation'

const API_KEY_KEY = 'consilium:apiKey'
const HISTORY_KEY = 'consilium:history'
export const MAX_HISTORY = 10

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_KEY)
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_KEY, key)
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_KEY)
}

export function getRunHistory(): RunState[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function getRunById(id: string): RunState | null {
  return getRunHistory().find(r => r.id === id) ?? null
}

export function saveRun(run: RunState): void {
  const history = getRunHistory().filter(r => r.id !== run.id)
  const updated = [run, ...history].slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
}

export function deleteRun(id: string): void {
  const history = getRunHistory().filter(r => r.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm test lib/storage.test.ts
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts && git commit -m "feat: add localStorage storage utilities with tests"
```

---

## Task 4: Models config

**Files:**
- Create: `lib/models.ts`

**Step 1: Check the OpenRouter model IDs used in the CLI**

```bash
grep -r "openrouter\|model" ~/code/consilium/src/config.rs 2>/dev/null | head -30
grep -r "model_id\|openrouter" ~/code/consilium/src/ --include="*.rs" | grep -v "test\|//\|target" | head -30
```

**Step 2: Write models config** (update model IDs from Step 1 output)

```typescript
// lib/models.ts
import type { ModeConfig, Panelist } from '@/types/deliberation'

export const PANELISTS: Panelist[] = [
  { name: 'GPT-5.2', model: 'openai/gpt-5.2',          lab: 'OpenAI'    },
  { name: 'Opus',    model: 'anthropic/claude-opus-4-6', lab: 'Anthropic' },
  { name: 'Grok',    model: 'x-ai/grok-4',              lab: 'xAI'       },
  { name: 'Kimi',    model: 'moonshotai/kimi-k2.5',     lab: 'Moonshot'  },
  { name: 'GLM',     model: 'zhipuai/glm-5',            lab: 'Zhipu'     },
]

export const JUDGE: Panelist = {
  name: 'Gemini', model: 'google/gemini-2.5-pro', lab: 'Google',
}

export const CRITIC: Panelist = {
  name: 'Opus', model: 'anthropic/claude-opus-4-6', lab: 'Anthropic',
}

// IMPORTANT: after grep above, replace any model IDs that don't match
// what ~/code/consilium/src/ actually uses in production.

export const MODES: ModeConfig[] = [
  {
    id: 'quick',
    label: 'Quick',
    description: 'Parallel answers, fast synthesis',
    tooltip: '4 models answer in parallel. Best for factual questions or when you need a quick gut-check.',
    rounds: 0,
    useBlind: false,
    useXpol: false,
  },
  {
    id: 'oxford',
    label: 'Oxford',
    description: 'Structured debate with a judge',
    tooltip: 'Full council deliberation — blind phase, cross-pollination, debate rounds, and synthesis. Best for decisions with real stakes.',
    rounds: 2,
    useBlind: true,
    useXpol: true,
  },
  {
    id: 'redteam',
    label: 'Red Team',
    description: 'Adversarial challenge of your plan',
    tooltip: 'One model defends, others attack. Best for stress-testing a proposal, strategy, or decision before you commit.',
    rounds: 2,
    useBlind: true,
    useXpol: false,
  },
  {
    id: 'premortem',
    label: 'Pre-Mortem',
    description: 'Imagine failure, trace the causes',
    tooltip: 'Models imagine the plan failed and work backwards. Best for surfacing hidden risks before a launch or commitment.',
    rounds: 1,
    useBlind: true,
    useXpol: false,
  },
  {
    id: 'forecast',
    label: 'Forecast',
    description: 'Probability estimates with reasoning',
    tooltip: 'Each model gives a probability estimate and reasoning. Best for calibrated prediction on uncertain outcomes.',
    rounds: 1,
    useBlind: true,
    useXpol: false,
  },
]
```

**Step 3: Commit**

```bash
git add lib/models.ts && git commit -m "feat: add models config with panelists and mode definitions"
```

---

## Task 5: Prompts

**Files:**
- Create: `lib/prompts.ts`

**Step 1: Read the source prompts**

```bash
cat ~/code/consilium/src/prompts.rs
```

**Step 2: Port key prompts to TypeScript**

```typescript
// lib/prompts.ts
// Ported from ~/code/consilium/src/prompts.rs

export function blindSystemPrompt(): string {
  return `You are participating in the BLIND PHASE of a council deliberation.

Stake your initial position on the question BEFORE seeing what others think.
This prevents anchoring bias.

Provide a CLAIM SKETCH (not a full response):
1. Your core position (1-2 sentences)
2. Top 3 supporting claims or considerations
3. Key assumption or uncertainty
4. ONE thing that, if true, would change your mind entirely

Keep it concise (~120 words). The full deliberation comes later.`
}

export function debateSystemPrompt(name: string, round: number, previousSpeakers: string): string {
  return `You are ${name}, participating in Round ${round} of a council deliberation.

REQUIREMENTS for your response:
1. Reference at least ONE previous speaker by name
2. State explicitly: AGREE, DISAGREE, or BUILD ON their specific point
3. Add ONE new consideration not yet raised
4. Keep response under 250 words — be concise and practical

POSITION INTEGRITY:
- If your position has CHANGED, label it 'POSITION CHANGE' and cite the specific new argument
- Changing position without new evidence is sycophancy, not reasoning

If you fully agree with emerging consensus, say: "CONSENSUS: [the agreed position]"

Previous speakers this round: ${previousSpeakers}

End your response with: **Confidence: N/10**`
}

export function challengerAddition(): string {
  return `

ANALYTICAL LENS: You genuinely believe the emerging consensus has a critical flaw.

REQUIREMENTS:
1. Frame your objections as QUESTIONS, not statements
2. Identify the weakest assumption in the emerging consensus and probe it
3. Ask ONE question that would make the consensus WRONG if the answer goes a certain way
4. You CANNOT use phrases like "building on", "adding nuance", or "I largely agree"`
}

export function judgeSystemPrompt(): string {
  return `You are synthesizing a multi-model deliberation using Analysis of Competing Hypotheses (ACH).

The panel responses are ANONYMIZED (Speaker 1, 2, etc.) to prevent lab-identity bias.

Your synthesis must:
1. IDENTIFY the key claim each speaker made
2. FIND genuine disagreements (not just different framings)
3. WEIGH evidence quality, not speaker confidence
4. SURFACE the strongest objection to the emerging consensus
5. PRODUCE structured output:
   - Core finding (2-3 sentences)
   - Key supporting evidence
   - Strongest counterargument
   - Confidence level (with reasoning)
   - Do Now / Consider Later / Skip recommendations`
}

export function critiqueSystemPrompt(): string {
  return `You are reviewing a judge's synthesis for logical fallacies and blind spots.

Check for:
1. Fallacy-Oversight: Did the judge miss a strong counterargument?
2. Overconfidence: Is the confidence level warranted by the evidence?
3. False consensus: Did the judge mistake convergence for correctness?
4. Missing stakeholders: Whose perspective is absent?

Be specific. Quote the synthesis when flagging issues.
End with: REVISE if you found material issues, APPROVE if synthesis is sound.`
}

export function extractionPrompt(synthesis: string): string {
  return `Extract structured recommendations from this deliberation synthesis.

SYNTHESIS:
${synthesis}

Output EXACTLY this format:
DO NOW:
- [specific action]
- [specific action]

CONSIDER LATER:
- [option worth revisiting]
- [option worth revisiting]

SKIP:
- [rejected option and why]
- [rejected option and why]

Be specific. Each bullet is one action or decision. No vague advice.`
}

export function redteamAttackerPrompt(name: string): string {
  return `You are ${name}, an adversarial reviewer.

Your job: find every way the plan could fail.
- Attack assumptions, not just execution
- Find the single most dangerous risk
- Propose a specific scenario where this fails catastrophically
- Do NOT offer solutions — only attack

Be direct. Pull no punches.`
}

export function premortermPrompt(name: string): string {
  return `You are ${name}. The plan has failed. It is 12 months from now and the outcome was terrible.

Work backwards:
1. What specifically went wrong? (Pick the most plausible failure)
2. What was the root cause?
3. What early warning signs were ignored?
4. What assumption turned out to be false?

Be specific and concrete. Assume the failure actually happened — don't hedge.`
}

export function forecastPrompt(name: string): string {
  return `You are ${name}. Give a calibrated probability estimate.

Format:
PROBABILITY: X% (your best estimate)
REASONING: [2-3 sentences explaining your estimate]
KEY UNCERTAINTY: [the single factor that would most change your estimate]
IF WRONG: [what evidence would update you significantly]

Be specific. Do not give ranges wider than 30 percentage points.`
}
```

**Step 3: Commit**

```bash
git add lib/prompts.ts && git commit -m "feat: port consilium prompts to TypeScript"
```

---

## Task 6: OpenRouter streaming client

**Files:**
- Create: `lib/streaming.ts`
- Create: `lib/streaming.test.ts`

**Step 1: Write failing tests**

```typescript
// lib/streaming.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseSSEChunk, buildHeaders } from './streaming'

describe('parseSSEChunk', () => {
  it('extracts content from SSE data line', () => {
    const chunk = 'data: {"choices":[{"delta":{"content":"hello"}}]}\n'
    expect(parseSSEChunk(chunk)).toEqual(['hello'])
  })
  it('returns empty array for [DONE]', () => {
    expect(parseSSEChunk('data: [DONE]\n')).toEqual([])
  })
  it('handles multiple lines in one chunk', () => {
    const chunk = 'data: {"choices":[{"delta":{"content":"a"}}]}\ndata: {"choices":[{"delta":{"content":"b"}}]}\n'
    expect(parseSSEChunk(chunk)).toEqual(['a', 'b'])
  })
  it('ignores non-data lines', () => {
    expect(parseSSEChunk(': ping\n')).toEqual([])
  })
  it('handles delta with no content key', () => {
    expect(parseSSEChunk('data: {"choices":[{"delta":{}}]}\n')).toEqual([])
  })
})

describe('buildHeaders', () => {
  it('includes Authorization and required OpenRouter headers', () => {
    const h = buildHeaders('sk-test')
    expect(h['Authorization']).toBe('Bearer sk-test')
    expect(h['HTTP-Referer']).toBe('https://consilium.sh')
    expect(h['X-Title']).toBe('consilium.sh')
    expect(h['Content-Type']).toBe('application/json')
  })
})
```

**Step 2: Run tests to see them fail**

```bash
pnpm test lib/streaming.test.ts
```

**Step 3: Implement streaming client**

```typescript
// lib/streaming.ts
import type { Message } from '@/types/deliberation'

export function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://consilium.sh',
    'X-Title': 'consilium.sh',
  }
}

export function parseSSEChunk(chunk: string): string[] {
  const tokens: string[] = []
  const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
  for (const line of lines) {
    const data = line.slice(6).trim()
    if (data === '[DONE]') continue
    try {
      const parsed = JSON.parse(data)
      const content = parsed.choices?.[0]?.delta?.content
      if (content) tokens.push(content)
    } catch {
      // malformed chunk — skip
    }
  }
  return tokens
}

export async function* streamCompletion(
  model: string,
  messages: Message[],
  apiKey: string,
  onToken?: (token: string) => void
): AsyncGenerator<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ model, messages, stream: true }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${err}`)
  }

  if (!response.body) throw new Error('No response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const token of parseSSEChunk(chunk)) {
      onToken?.(token)
      yield token
    }
  }
}

export async function completeOnce(
  model: string,
  messages: Message[],
  apiKey: string
): Promise<string> {
  let result = ''
  for await (const token of streamCompletion(model, messages, apiKey)) {
    result += token
  }
  return result
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm test lib/streaming.test.ts
```

**Step 5: Commit**

```bash
git add lib/streaming.ts lib/streaming.test.ts && git commit -m "feat: add OpenRouter SSE streaming client with tests"
```

---

## Task 7: Deliberation state machine

**Files:**
- Create: `lib/consilium.ts`

**Step 1: Implement the state machine**

```typescript
// lib/consilium.ts
import { PANELISTS, JUDGE, CRITIC, MODES } from './models'
import {
  blindSystemPrompt, debateSystemPrompt, challengerAddition,
  judgeSystemPrompt, critiqueSystemPrompt, extractionPrompt,
  redteamAttackerPrompt, premortermPrompt, forecastPrompt
} from './prompts'
import { streamCompletion, completeOnce } from './streaming'
import { saveRun } from './storage'
import type { RunState, Phase, Mode, ModelResponse, Extraction } from '@/types/deliberation'

export type PhaseUpdate = {
  phase: Phase
  panelistName?: string
  token?: string
  phaseComplete?: boolean
  finalState?: RunState
}

function newRun(question: string, mode: Mode): RunState {
  return {
    id: crypto.randomUUID(),
    question,
    mode,
    phase: 'idle',
    blindResponses: [],
    xpolResponses: [],
    debateRounds: [],
    judgeResponse: '',
    critiqueResponse: '',
    finalSynthesis: '',
    extraction: null,
    startedAt: Date.now(),
  }
}

function anonymise(responses: ModelResponse[]): string {
  return responses
    .map((r, i) => `Speaker ${i + 1}:\n${r.content}`)
    .join('\n\n---\n\n')
}

async function runBlindPhase(
  run: RunState,
  apiKey: string,
  onUpdate: (update: PhaseUpdate) => void
): Promise<ModelResponse[]> {
  const panelists = run.mode === 'quick' ? PANELISTS.slice(0, 4) : PANELISTS

  const results = await Promise.all(
    panelists.map(async (p) => {
      let content = ''
      const messages = [
        { role: 'system' as const, content: blindSystemPrompt() },
        { role: 'user' as const, content: run.question },
      ]
      for await (const token of streamCompletion(p.model, messages, apiKey)) {
        content += token
        onUpdate({ phase: 'blind', panelistName: p.name, token })
      }
      return { panelistName: p.name, content, streaming: false }
    })
  )
  return results
}

async function runDebatePhase(
  run: RunState,
  apiKey: string,
  rounds: number,
  onUpdate: (update: PhaseUpdate) => void
): Promise<RunState['debateRounds']> {
  const debateRounds: RunState['debateRounds'] = []

  for (let r = 1; r <= rounds; r++) {
    const roundResponses: ModelResponse[] = []
    const speakersSoFar: string[] = []

    for (let i = 0; i < PANELISTS.length; i++) {
      const p = PANELISTS[i]
      const isChallenger = i === PANELISTS.length - 1 && r === rounds

      let system = debateSystemPrompt(p.name, r, speakersSoFar.join(', ') || 'none yet')
      if (isChallenger) system += challengerAddition()

      const context = [
        ...run.blindResponses.map((br, j) => ({
          role: 'user' as const,
          content: `Speaker ${j + 1} blind claim:\n${br.content}`
        })),
        ...roundResponses.map(rr => ({
          role: 'user' as const,
          content: `${rr.panelistName} said:\n${rr.content}`
        })),
        { role: 'user' as const, content: `Question: ${run.question}` },
      ]

      let content = ''
      for await (const token of streamCompletion(
        p.model,
        [{ role: 'system', content: system }, ...context],
        apiKey
      )) {
        content += token
        onUpdate({ phase: 'debate', panelistName: p.name, token })
      }

      const response = { panelistName: p.name, content, streaming: false }
      roundResponses.push(response)
      speakersSoFar.push(p.name)
    }

    debateRounds.push({ roundNum: r, responses: roundResponses })
  }

  return debateRounds
}

function parseExtraction(text: string): Extraction {
  const section = (label: string) => {
    const match = text.match(new RegExp(`${label}:\\s*\\n([\\s\\S]*?)(?=\\n[A-Z ]+:|$)`))
    if (!match) return []
    return match[1]
      .split('\n')
      .map(l => l.replace(/^-\s*/, '').trim())
      .filter(Boolean)
  }
  return {
    doNow: section('DO NOW'),
    considerLater: section('CONSIDER LATER'),
    skip: section('SKIP'),
  }
}

export async function runDeliberation(
  question: string,
  mode: Mode,
  apiKey: string,
  onUpdate: (update: PhaseUpdate) => void
): Promise<RunState> {
  const modeConfig = MODES.find(m => m.id === mode)!
  const run = newRun(question, mode)

  // Save initial state
  saveRun(run)

  // Blind phase
  onUpdate({ phase: 'blind' })
  run.phase = 'blind'
  run.blindResponses = await runBlindPhase(run, apiKey, onUpdate)
  saveRun(run)

  if (mode === 'quick') {
    // Quick mode: skip to judge immediately
    run.phase = 'judge'
    onUpdate({ phase: 'judge' })
    const anonPanel = anonymise(run.blindResponses)
    run.judgeResponse = await completeOnce(
      JUDGE.model,
      [
        { role: 'system', content: judgeSystemPrompt() },
        { role: 'user', content: `Question: ${question}\n\nPanel responses:\n${anonPanel}` },
      ],
      apiKey
    )
  } else {
    // Debate phase
    run.phase = 'debate'
    onUpdate({ phase: 'debate' })
    run.debateRounds = await runDebatePhase(run, apiKey, modeConfig.rounds, onUpdate)
    saveRun(run)

    // Judge phase
    run.phase = 'judge'
    onUpdate({ phase: 'judge' })
    const allContext = [
      ...run.blindResponses,
      ...run.debateRounds.flatMap(rd => rd.responses),
    ]
    const anonPanel = anonymise(allContext)
    let judgeContent = ''
    for await (const token of streamCompletion(
      JUDGE.model,
      [
        { role: 'system', content: judgeSystemPrompt() },
        { role: 'user', content: `Question: ${question}\n\nFull deliberation:\n${anonPanel}` },
      ],
      apiKey
    )) {
      judgeContent += token
      onUpdate({ phase: 'judge', panelistName: JUDGE.name, token })
    }
    run.judgeResponse = judgeContent
    saveRun(run)

    // Critique phase
    run.phase = 'critique'
    onUpdate({ phase: 'critique' })
    run.critiqueResponse = await completeOnce(
      CRITIC.model,
      [
        { role: 'system', content: critiqueSystemPrompt() },
        { role: 'user', content: run.judgeResponse },
      ],
      apiKey
    )
    saveRun(run)
  }

  // Extraction phase
  run.phase = 'extraction'
  onUpdate({ phase: 'extraction' })
  const synthesisForExtraction = run.judgeResponse || run.blindResponses.map(r => r.content).join('\n\n')
  const extractionText = await completeOnce(
    JUDGE.model,
    [{ role: 'user', content: extractionPrompt(synthesisForExtraction) }],
    apiKey
  )
  run.extraction = parseExtraction(extractionText)
  run.finalSynthesis = run.judgeResponse || synthesisForExtraction
  run.phase = 'done'
  run.completedAt = Date.now()
  saveRun(run)

  onUpdate({ phase: 'done', finalState: run })
  return run
}
```

**Step 2: Commit**

```bash
git add lib/consilium.ts && git commit -m "feat: implement deliberation state machine"
```

---

## Task 8: API Key Setup component

**Files:**
- Create: `components/ApiKeySetup.tsx`

**Step 1: Implement component**

```tsx
// components/ApiKeySetup.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setApiKey, clearApiKey } from '@/lib/storage'

interface Props {
  existingKey: string | null
  onSave: (key: string) => void
  onClear: () => void
}

export function ApiKeySetup({ existingKey, onSave, onClear }: Props) {
  const [value, setValue] = useState('')
  const [showKey, setShowKey] = useState(false)

  const handleSave = () => {
    if (!value.startsWith('sk-or-')) {
      alert('OpenRouter keys start with sk-or-')
      return
    }
    setApiKey(value)
    onSave(value)
    setValue('')
  }

  if (existingKey) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>OpenRouter key: {showKey ? existingKey : '••••••••' + existingKey.slice(-4)}</span>
        <button onClick={() => setShowKey(!showKey)} className="underline text-xs">
          {showKey ? 'hide' : 'show'}
        </button>
        <button onClick={() => { clearApiKey(); onClear() }} className="underline text-xs text-destructive">
          remove
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Enter your{' '}
        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="underline">
          OpenRouter API key
        </a>{' '}
        to start. Your key stays in your browser and is never sent to our servers.
      </p>
      <div className="flex gap-2">
        <Input
          type="password"
          placeholder="sk-or-v1-..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="font-mono text-sm"
        />
        <Button onClick={handleSave} disabled={!value}>Save</Button>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/ApiKeySetup.tsx && git commit -m "feat: add ApiKeySetup component"
```

---

## Task 9: Mode Selector component

**Files:**
- Create: `components/ModeSelector.tsx`

**Step 1: Implement component**

```tsx
// components/ModeSelector.tsx
'use client'
import { MODES } from '@/lib/models'
import type { Mode } from '@/types/deliberation'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Props {
  selected: Mode
  onChange: (mode: Mode) => void
}

export function ModeSelector({ selected, onChange }: Props) {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {MODES.map(mode => (
          <Tooltip key={mode.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onChange(mode.id)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  'hover:border-primary hover:bg-accent',
                  selected === mode.id
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border bg-background text-muted-foreground'
                )}
              >
                <div className="font-medium text-sm">{mode.label}</div>
                <div className="text-xs mt-0.5 text-muted-foreground">{mode.description}</div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-60">
              {mode.tooltip}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
```

**Step 2: Commit**

```bash
git add components/ModeSelector.tsx && git commit -m "feat: add ModeSelector component"
```

---

## Task 10: Phase Progress component

**Files:**
- Create: `components/PhaseProgress.tsx`

**Step 1: Implement component**

```tsx
// components/PhaseProgress.tsx
import { cn } from '@/lib/utils'
import type { Phase } from '@/types/deliberation'

const PHASES: { id: Phase; label: string }[] = [
  { id: 'blind', label: 'Blind' },
  { id: 'debate', label: 'Debate' },
  { id: 'judge', label: 'Judge' },
  { id: 'critique', label: 'Critique' },
  { id: 'extraction', label: 'Extract' },
  { id: 'done', label: 'Done' },
]

const PHASE_ORDER: Phase[] = ['idle', 'blind', 'xpol', 'debate', 'judge', 'critique', 'extraction', 'done']

interface Props {
  phase: Phase
}

export function PhaseProgress({ phase }: Props) {
  const currentIdx = PHASE_ORDER.indexOf(phase)

  return (
    <div className="flex items-center gap-1 text-xs">
      {PHASES.map((p, i) => {
        const phaseIdx = PHASE_ORDER.indexOf(p.id)
        const isComplete = currentIdx > phaseIdx
        const isCurrent = phase === p.id

        return (
          <div key={p.id} className="flex items-center gap-1">
            <span className={cn(
              'px-2 py-0.5 rounded-full',
              isComplete && 'bg-primary text-primary-foreground',
              isCurrent && 'bg-accent text-accent-foreground font-medium animate-pulse',
              !isComplete && !isCurrent && 'text-muted-foreground'
            )}>
              {p.label}
            </span>
            {i < PHASES.length - 1 && (
              <span className="text-muted-foreground">→</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/PhaseProgress.tsx && git commit -m "feat: add PhaseProgress component"
```

---

## Task 11: Debate Panel component

**Files:**
- Create: `components/DebatePanel.tsx`

**Step 1: Implement component**

```tsx
// components/DebatePanel.tsx
'use client'
import { useEffect, useRef } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  name: string
  lab: string
  content: string
  streaming: boolean
  phase: string
}

export function DebatePanel({ name, lab, content, streaming, phase }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (streaming) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [content, streaming])

  return (
    <Card className={cn('flex flex-col', streaming && 'ring-1 ring-primary')}>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{name}</span>
          <Badge variant="outline" className="text-xs">{lab}</Badge>
        </div>
        {streaming && (
          <span className="text-xs text-muted-foreground animate-pulse">typing...</span>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-64">
        <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
          {content || <span className="text-muted-foreground italic">waiting...</span>}
          {streaming && <span className="animate-pulse">▋</span>}
        </p>
        <div ref={bottomRef} />
      </CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add components/DebatePanel.tsx && git commit -m "feat: add DebatePanel streaming component"
```

---

## Task 12: Export Button component

**Files:**
- Create: `components/ExportButton.tsx`

**Step 1: Implement component**

```tsx
// components/ExportButton.tsx
'use client'
import { Button } from '@/components/ui/button'
import type { RunState } from '@/types/deliberation'

interface Props {
  run: RunState
}

function toMarkdown(run: RunState): string {
  const lines: string[] = [
    `# consilium — ${run.mode} deliberation`,
    `**Question:** ${run.question}`,
    `**Date:** ${new Date(run.startedAt).toLocaleString()}`,
    '',
    '---',
    '',
    '## Blind Phase',
    ...run.blindResponses.map(r => `### ${r.panelistName}\n${r.content}`),
  ]

  if (run.debateRounds.length > 0) {
    for (const rd of run.debateRounds) {
      lines.push('', `## Debate Round ${rd.roundNum}`)
      for (const r of rd.responses) {
        lines.push(`### ${r.panelistName}\n${r.content}`)
      }
    }
  }

  if (run.judgeResponse) {
    lines.push('', '## Judge Synthesis', run.judgeResponse)
  }
  if (run.critiqueResponse) {
    lines.push('', '## Critique', run.critiqueResponse)
  }
  if (run.extraction) {
    lines.push('', '## Recommendations')
    lines.push('### Do Now')
    run.extraction.doNow.forEach(i => lines.push(`- ${i}`))
    lines.push('### Consider Later')
    run.extraction.considerLater.forEach(i => lines.push(`- ${i}`))
    lines.push('### Skip')
    run.extraction.skip.forEach(i => lines.push(`- ${i}`))
  }

  return lines.join('\n')
}

export function ExportButton({ run }: Props) {
  const copyMd = async () => {
    await navigator.clipboard.writeText(toMarkdown(run))
  }

  const printPdf = () => {
    window.print()
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={copyMd}>
        Copy Markdown
      </Button>
      <Button variant="outline" size="sm" onClick={printPdf}>
        Export PDF
      </Button>
    </div>
  )
}
```

Add print CSS to `app/globals.css`:
```css
@media print {
  nav, button, [data-no-print] { display: none !important; }
  * { break-inside: avoid; }
}
```

**Step 2: Commit**

```bash
git add components/ExportButton.tsx && git commit -m "feat: add ExportButton with markdown copy and PDF print"
```

---

## Task 13: Landing page

**Files:**
- Modify: `app/page.tsx`

**Step 1: Implement landing page**

```tsx
// app/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ModeSelector } from '@/components/ModeSelector'
import { ApiKeySetup } from '@/components/ApiKeySetup'
import { getApiKey } from '@/lib/storage'
import type { Mode } from '@/types/deliberation'

export default function HomePage() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<Mode>('oxford')
  const [apiKey, setApiKey] = useState<string | null>(null)

  useEffect(() => {
    setApiKey(getApiKey())
  }, [])

  const handleStart = () => {
    if (!question.trim() || !apiKey) return
    const id = crypto.randomUUID()
    // Store pending run config in sessionStorage for the run page to pick up
    sessionStorage.setItem(`pending:${id}`, JSON.stringify({ question: question.trim(), mode }))
    router.push(`/run/${id}`)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8 max-w-3xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">consilium</h1>
        <p className="text-muted-foreground">
          Multi-model deliberation. 5 frontier LLMs debate your question, then a judge synthesizes.
        </p>
      </div>

      <div className="w-full space-y-4">
        <Textarea
          placeholder="What should I decide? What's likely to happen? What are the risks of...?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          rows={4}
          className="text-base resize-none"
        />

        <ModeSelector selected={mode} onChange={setMode} />

        <ApiKeySetup
          existingKey={apiKey}
          onSave={k => setApiKey(k)}
          onClear={() => setApiKey(null)}
        />

        <Button
          className="w-full"
          size="lg"
          disabled={!question.trim() || !apiKey}
          onClick={handleStart}
        >
          Deliberate
        </Button>
      </div>

      <a href="/history" className="text-sm text-muted-foreground hover:underline">
        View past deliberations
      </a>
    </main>
  )
}
```

**Step 2: Commit**

```bash
git add app/page.tsx && git commit -m "feat: implement landing page with question input and mode selector"
```

---

## Task 14: Run page (live debate view)

**Files:**
- Create: `app/run/[id]/page.tsx`

**Step 1: Implement run page**

```tsx
// app/run/[id]/page.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PhaseProgress } from '@/components/PhaseProgress'
import { DebatePanel } from '@/components/DebatePanel'
import { ExportButton } from '@/components/ExportButton'
import { runDeliberation, type PhaseUpdate } from '@/lib/consilium'
import { getApiKey, getRunById } from '@/lib/storage'
import { PANELISTS } from '@/lib/models'
import type { RunState, Phase } from '@/types/deliberation'

export default function RunPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [run, setRun] = useState<RunState | null>(null)
  const [panelTokens, setPanelTokens] = useState<Record<string, string>>({})
  const [activePhase, setActivePhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleUpdate = useCallback((update: PhaseUpdate) => {
    setActivePhase(update.phase)
    if (update.panelistName && update.token) {
      setPanelTokens(prev => ({
        ...prev,
        [update.panelistName!]: (prev[update.panelistName!] ?? '') + update.token,
      }))
    }
    if (update.finalState) {
      setRun(update.finalState)
      setDone(true)
    }
  }, [])

  useEffect(() => {
    const apiKey = getApiKey()
    if (!apiKey) { router.push('/'); return }

    // Check if there's a pending run config (from landing page)
    const pending = sessionStorage.getItem(`pending:${id}`)
    if (pending) {
      sessionStorage.removeItem(`pending:${id}`)
      const { question, mode } = JSON.parse(pending)
      runDeliberation(question, mode, apiKey, handleUpdate).catch(e => {
        setError(e.message)
      })
      return
    }

    // Otherwise load from history (revisiting a completed run)
    const existing = getRunById(id)
    if (existing) {
      setRun(existing)
      setActivePhase(existing.phase)
      setDone(existing.phase === 'done')
    } else {
      router.push('/')
    }
  }, [id, router, handleUpdate])

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-destructive font-medium">Error: {error}</p>
        <a href="/" className="underline text-sm">Start over</a>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      {!done && (
        <div className="sticky top-0 bg-background/80 backdrop-blur z-10 py-2 border-b flex items-center justify-between">
          <span className="text-sm text-amber-600 font-medium">Keep this tab open during deliberation</span>
          <PhaseProgress phase={activePhase} />
        </div>
      )}

      {done && run && (
        <div className="flex items-center justify-between">
          <PhaseProgress phase="done" />
          <ExportButton run={run} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PANELISTS.map(p => (
          <DebatePanel
            key={p.name}
            name={p.name}
            lab={p.lab}
            content={panelTokens[p.name] ?? ''}
            streaming={activePhase !== 'done' && !!panelTokens[p.name] && !run?.blindResponses.find(r => r.panelistName === p.name)?.content}
            phase={activePhase}
          />
        ))}
      </div>

      {run?.judgeResponse && (
        <div className="border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-sm">Judge Synthesis</h2>
          <p className="text-sm whitespace-pre-wrap">{run.judgeResponse}</p>
        </div>
      )}

      {run?.extraction && (
        <div className="border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold text-sm">Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="text-xs font-medium text-green-600 mb-2">Do Now</h3>
              <ul className="space-y-1">
                {run.extraction.doNow.map((item, i) => (
                  <li key={i} className="text-sm">• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-medium text-amber-600 mb-2">Consider Later</h3>
              <ul className="space-y-1">
                {run.extraction.considerLater.map((item, i) => (
                  <li key={i} className="text-sm">• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">Skip</h3>
              <ul className="space-y-1">
                {run.extraction.skip.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="text-center">
        <a href="/" className="text-sm text-muted-foreground hover:underline">New deliberation</a>
      </div>
    </main>
  )
}
```

**Step 2: Commit**

```bash
git add app/run/ && git commit -m "feat: implement live run page with streaming debate panels"
```

---

## Task 15: History page

**Files:**
- Create: `app/history/page.tsx`

**Step 1: Implement history page**

```tsx
// app/history/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { getRunHistory, deleteRun } from '@/lib/storage'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RunState } from '@/types/deliberation'

export default function HistoryPage() {
  const [runs, setRuns] = useState<RunState[]>([])

  useEffect(() => {
    setRuns(getRunHistory())
  }, [])

  const handleDelete = (id: string) => {
    deleteRun(id)
    setRuns(prev => prev.filter(r => r.id !== id))
  }

  if (runs.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">No deliberations yet.</p>
        <a href="/" className="underline text-sm">Start one</a>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Past deliberations</h1>
        <a href="/" className="text-sm text-muted-foreground hover:underline">New</a>
      </div>

      {runs.map(run => (
        <Card key={run.id}>
          <CardContent className="pt-4 flex items-start justify-between gap-4">
            <a href={`/run/${run.id}`} className="flex-1 group">
              <p className="font-medium text-sm group-hover:underline line-clamp-2">
                {run.question}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{run.mode}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(run.startedAt).toLocaleDateString()}
                </span>
                {run.phase !== 'done' && (
                  <Badge variant="secondary" className="text-xs">incomplete</Badge>
                )}
              </div>
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(run.id)}
            >
              Delete
            </Button>
          </CardContent>
        </Card>
      ))}
    </main>
  )
}
```

**Step 2: Commit**

```bash
git add app/history/ && git commit -m "feat: implement history page"
```

---

## Task 16: Vercel deployment

**Files:**
- Create: `vercel.json`
- Update: `package.json` build script

**Step 1: Verify build**

```bash
pnpm build
```

Expected: `out/` directory generated.

**Step 2: Create vercel.json**

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "out",
  "installCommand": "pnpm install"
}
```

**Step 3: Create GitHub repo and push**

```bash
cd ~/code/consilium-web
gh repo create consilium-web --private --source . --push
```

**Step 4: Deploy to Vercel**

```bash
pnpm dlx vercel --prod
```

When prompted:
- Link to existing project? No
- Project name: `consilium-sh` (or `consilium-web`)
- Directory: `.`

**Step 5: Test deployed app**

- Visit the Vercel URL
- Enter OpenRouter key
- Run a quick deliberation
- Verify streaming works
- Test export (markdown copy)

**Step 6: Commit vercel config**

```bash
git add vercel.json && git commit -m "feat: add Vercel deployment config"
git push
```

---

## Final verification

```bash
# All tests pass
pnpm test

# Build succeeds
pnpm build

# No TypeScript errors
pnpm tsc --noEmit
```

Expected: all green.
