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
