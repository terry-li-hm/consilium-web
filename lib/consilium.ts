// lib/consilium.ts
import { PANELISTS, JUDGE, CRITIC, MODES } from './models'
import {
  blindSystemPrompt, debateSystemPrompt, challengerAddition,
  judgeSystemPrompt, critiqueSystemPrompt, extractionPrompt,
  redteamAttackerPrompt, premortermPrompt, forecastPrompt,
  domainContext
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

function newRun(question: string, mode: Mode, domain?: string): RunState {
  return {
    id: crypto.randomUUID(),
    question,
    mode,
    domain,
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

export function anonymise(responses: ModelResponse[]): string {
  return responses
    .map((r, i) => `Speaker ${i + 1}:\n${r.content}`)
    .join('\n\n---\n\n')
}

async function runBlindPhase(
  run: RunState,
  apiKey: string,
  onUpdate: (update: PhaseUpdate) => void,
  signal?: AbortSignal
): Promise<ModelResponse[]> {
  const panelists = run.mode === 'quick' ? PANELISTS.slice(0, 4) : PANELISTS
  const domainPrefix = run.domain ? domainContext(run.domain) : null

  const results = await Promise.all(
    panelists.map(async (p, i) => {
      let content = ''
      // For redteam: first panelist is the defender (blind prompt), rest are attackers
      let systemPrompt: string
      if (run.mode === 'redteam') {
        systemPrompt = i === 0 ? blindSystemPrompt() : redteamAttackerPrompt(p.name)
      } else if (run.mode === 'premortem') {
        systemPrompt = premortermPrompt(p.name)
      } else if (run.mode === 'forecast') {
        systemPrompt = forecastPrompt(p.name)
      } else {
        systemPrompt = blindSystemPrompt()
      }
      if (domainPrefix) systemPrompt = `${domainPrefix}\n\n${systemPrompt}`
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: run.question },
      ]
      for await (const token of streamCompletion(p.model, messages, apiKey, undefined, signal)) {
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
  onUpdate: (update: PhaseUpdate) => void,
  signal?: AbortSignal
): Promise<RunState['debateRounds']> {
  const debateRounds: RunState['debateRounds'] = []
  const domainPrefix = run.domain ? domainContext(run.domain) : null

  for (let r = 1; r <= rounds; r++) {
    const roundResponses: ModelResponse[] = []
    const speakersSoFar: string[] = []

    for (let i = 0; i < PANELISTS.length; i++) {
      const p = PANELISTS[i]
      const isChallenger = i === PANELISTS.length - 1 && r === rounds

      let system: string
      if (run.mode === 'redteam') {
        // First panelist is the defender; rest are attackers
        system = i === 0 ? blindSystemPrompt() : redteamAttackerPrompt(p.name)
      } else if (run.mode === 'premortem') {
        system = premortermPrompt(p.name)
      } else if (run.mode === 'forecast') {
        system = forecastPrompt(p.name)
      } else {
        // oxford mode: standard debate prompt with optional challenger addition
        system = debateSystemPrompt(p.name, r, speakersSoFar.join(', ') || 'none yet')
        if (isChallenger) system += challengerAddition()
      }
      if (domainPrefix) system = `${domainPrefix}\n\n${system}`

      const context = [
        ...run.blindResponses.map((br, j) => ({
          role: 'user' as const,
          content: `Speaker ${j + 1} blind claim:\n${br.content}`
        })),
        ...(run.xpolResponses ?? []).map(xr => ({
          role: 'user' as const,
          content: `${xr.panelistName} cross-pollination:\n${xr.content}`
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
        apiKey,
        undefined,
        signal
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

export function parseExtraction(text: string): Extraction {
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
  onUpdate: (update: PhaseUpdate) => void,
  domain?: string,
  signal?: AbortSignal
): Promise<RunState> {
  const modeConfig = MODES.find(m => m.id === mode)!
  const run = newRun(question, mode, domain)

  try {
    // Save initial state
    saveRun(run)

    // Blind phase
    onUpdate({ phase: 'blind' })
    run.phase = 'blind'
    run.blindResponses = await runBlindPhase(run, apiKey, onUpdate, signal)
    saveRun(run)

    if (mode === 'quick') {
      // Quick mode: skip to judge immediately, streamed
      run.phase = 'judge'
      onUpdate({ phase: 'judge' })
      const anonPanel = anonymise(run.blindResponses)
      let quickJudgeContent = ''
      for await (const token of streamCompletion(
        JUDGE.model,
        [
          { role: 'system', content: judgeSystemPrompt() },
          { role: 'user', content: `Question: ${question}\n\nPanel responses:\n${anonPanel}` },
        ],
        apiKey,
        undefined,
        signal
      )) {
        quickJudgeContent += token
        onUpdate({ phase: 'judge', panelistName: JUDGE.name, token })
      }
      run.judgeResponse = quickJudgeContent
    } else {
      // Xpol phase (oxford mode only)
      if (mode === 'oxford') {
        run.phase = 'xpol'
        onUpdate({ phase: 'xpol' })
        const blindSummary = run.blindResponses
          .map((br, i) => `Speaker ${i + 1}:\n${br.content}`)
          .join('\n\n---\n\n')
        const xpolPrompt = `Here are all initial blind claims from the panel:\n\n${blindSummary}\n\nQuestion: ${question}\n\nYou've seen all initial blind claims. What's the most important gap, contradiction, or underexplored angle across all responses? 150 words max.`
        const xpolResults = await Promise.all(
          PANELISTS.map(async (p) => {
            let content = ''
            for await (const token of streamCompletion(
              p.model,
              [{ role: 'user', content: xpolPrompt }],
              apiKey,
              undefined,
              signal
            )) {
              content += token
              onUpdate({ phase: 'xpol', panelistName: p.name, token })
            }
            return { panelistName: p.name, content, streaming: false }
          })
        )
        run.xpolResponses = xpolResults
        saveRun(run)
      }

      // Debate phase
      run.phase = 'debate'
      onUpdate({ phase: 'debate' })
      run.debateRounds = await runDebatePhase(run, apiKey, modeConfig.rounds, onUpdate, signal)
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
        apiKey,
        undefined,
        signal
      )) {
        judgeContent += token
        onUpdate({ phase: 'judge', panelistName: JUDGE.name, token })
      }
      run.judgeResponse = judgeContent
      saveRun(run)

      // Critique phase (streamed)
      run.phase = 'critique'
      onUpdate({ phase: 'critique' })
      let critiqueContent = ''
      for await (const token of streamCompletion(
        CRITIC.model,
        [
          { role: 'system', content: critiqueSystemPrompt() },
          { role: 'user', content: run.judgeResponse },
        ],
        apiKey,
        undefined,
        signal
      )) {
        critiqueContent += token
        onUpdate({ phase: 'critique', panelistName: CRITIC.name, token })
      }
      run.critiqueResponse = critiqueContent
      saveRun(run)
    }

    // Extraction phase
    run.phase = 'extraction'
    onUpdate({ phase: 'extraction' })
    const synthesisForExtraction = run.judgeResponse || run.blindResponses.map(r => r.content).join('\n\n')
    const extractionText = await completeOnce(
      JUDGE.model,
      [{ role: 'user', content: extractionPrompt(synthesisForExtraction) }],
      apiKey,
      signal
    )
    run.extraction = parseExtraction(extractionText)
    run.finalSynthesis = run.judgeResponse || synthesisForExtraction
    run.phase = 'done'
    run.completedAt = Date.now()
    saveRun(run)

    onUpdate({ phase: 'done', finalState: run })
    return run
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      run.phase = 'error'
      run.error = 'Aborted by user'
      saveRun(run)
    }
    throw e
  }
}
