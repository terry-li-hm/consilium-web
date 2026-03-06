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
  name: string        // e.g. "GPT-5.4"
  model: string       // OpenRouter model ID
  lab: string         // e.g. "OpenAI"
  slowStart?: boolean // true for thinking/reasoning models with high TTFT
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
  cost: string
  duration: string
}
