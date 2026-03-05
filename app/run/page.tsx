// app/run/page.tsx
'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PhaseProgress } from '@/components/PhaseProgress'
import { DebatePanel } from '@/components/DebatePanel'
import { ExportButton } from '@/components/ExportButton'
import { runDeliberation, type PhaseUpdate } from '@/lib/consilium'
import { getApiKey, getRunById } from '@/lib/storage'
import { PANELISTS, JUDGE } from '@/lib/models'
import type { RunState, Phase } from '@/types/deliberation'

// Tokens tracked per phase to avoid cross-phase accumulation.
// Outer key = phase name, inner key = panelistName.
type PhaseTokens = Record<string, Record<string, string>>

const PHASE_DESCRIPTIONS: Partial<Record<Phase, string>> = {
  blind: 'Models are staking initial positions...',
  xpol: 'Cross-pollinating perspectives...',
  debate: 'Models are debating...',
  judge: 'Judge is synthesising...',
  critique: 'Running critique...',
  extraction: 'Extracting recommendations...',
}

function PanelSkeleton({ name, lab }: { name: string; lab: string }) {
  return (
    <div className="border rounded-lg p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">{name}</span>
        <span className="text-xs border rounded px-1.5 py-0.5 text-muted-foreground">{lab}</span>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-5/6" />
        <div className="h-3 bg-muted rounded w-4/6" />
      </div>
    </div>
  )
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`border rounded-lg overflow-hidden ${className ?? ''}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span>{title}</span>
        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function RunContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const router = useRouter()
  const [run, setRun] = useState<RunState | null>(null)
  // Phase-aware token tracking: phaseTokens[phase][panelistName]
  const [phaseTokens, setPhaseTokens] = useState<PhaseTokens>({})
  const [activePhase, setActivePhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleUpdate = useCallback((update: PhaseUpdate) => {
    setActivePhase(update.phase)
    if (update.panelistName && update.token) {
      const phase = update.phase
      setPhaseTokens(prev => ({
        ...prev,
        [phase]: {
          ...(prev[phase] ?? {}),
          [update.panelistName!]: (prev[phase]?.[update.panelistName!] ?? '') + update.token,
        },
      }))
    }
    if (update.finalState) {
      setRun(update.finalState)
      setDone(true)
    }
  }, [])

  useEffect(() => {
    if (!id) { router.push('/'); return }
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

  // Helper: resolve content for blind phase panels
  function blindContent(panelistName: string): string {
    return (
      phaseTokens['blind']?.[panelistName] ??
      run?.blindResponses.find(r => r.panelistName === panelistName)?.content ??
      ''
    )
  }

  function isBlindStreaming(panelistName: string): boolean {
    return (
      activePhase !== 'done' &&
      !!phaseTokens['blind']?.[panelistName] &&
      !run?.blindResponses.find(r => r.panelistName === panelistName)?.content
    )
  }

  // Judge content: streaming tokens take priority over finalised state
  const judgeContent =
    phaseTokens['judge']?.[JUDGE.name] ??
    run?.judgeResponse ??
    ''

  const showJudge = judgeContent || activePhase === 'judge'

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      {!done && (
        <div className="sticky top-0 bg-background/80 backdrop-blur z-10 py-2 border-b flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-amber-600 font-medium">Keep this tab open during deliberation</span>
            {activePhase !== 'idle' && PHASE_DESCRIPTIONS[activePhase] && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {PHASE_DESCRIPTIONS[activePhase]}
              </span>
            )}
          </div>
          <PhaseProgress phase={activePhase} />
        </div>
      )}

      {done && run && (
        <div className="flex items-center justify-between">
          <PhaseProgress phase="done" />
          <ExportButton run={run} />
        </div>
      )}

      {/* Blind phase panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PANELISTS.map(p => {
          const content = blindContent(p.name)
          const streaming = isBlindStreaming(p.name)

          // Show skeleton when blind phase is active and this panel has no content yet
          if (activePhase === 'blind' && !content) {
            return <PanelSkeleton key={p.name} name={p.name} lab={p.lab} />
          }

          return (
            <DebatePanel
              key={p.name}
              name={p.name}
              lab={p.lab}
              content={content}
              streaming={streaming}
              phase={activePhase}
            />
          )
        })}
      </div>

      {/* xpol responses — collapsed by default (intermediary content) */}
      {(run?.xpolResponses?.length ?? 0) > 0 && (
        <CollapsibleSection title="Cross-Pollination" defaultOpen={false}>
          <div className="space-y-3 pt-2">
            {run!.xpolResponses.map((r, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                  {r.panelistName}
                </span>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.content}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Debate rounds */}
      {(run?.debateRounds?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">Debate</h2>
          {run!.debateRounds.map(round => (
            <CollapsibleSection
              key={round.roundNum}
              title={`Round ${round.roundNum}`}
              defaultOpen={round.roundNum === run!.debateRounds.length}
            >
              <div className="space-y-4 pt-2">
                {round.responses.map((r, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium text-xs uppercase tracking-wide">{r.panelistName}</span>
                    <p className="mt-1 whitespace-pre-wrap">{r.content}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          ))}
        </div>
      )}

      {/* Debate streaming — show live tokens while debate phase is active */}
      {activePhase === 'debate' && phaseTokens['debate'] && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">Debate</h2>
          <div className="border rounded-lg p-4 space-y-4">
            {PANELISTS.map(p => {
              const debateContent = phaseTokens['debate']?.[p.name]
              if (!debateContent) return null
              return (
                <div key={p.name} className="text-sm">
                  <span className="font-medium text-xs uppercase tracking-wide">{p.name}</span>
                  <p className="mt-1 whitespace-pre-wrap font-mono leading-relaxed">
                    {debateContent}
                    <span className="animate-pulse">▋</span>
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Judge synthesis */}
      {showJudge && (
        <div className="border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-sm">Judge Synthesis</h2>
          <div className="text-sm whitespace-pre-wrap">
            {judgeContent || (
              <span className="text-muted-foreground animate-pulse">Synthesising...</span>
            )}
            {activePhase === 'judge' && judgeContent && <span className="animate-pulse">▋</span>}
          </div>
        </div>
      )}

      {/* Critique — secondary, subdued style */}
      {run?.critiqueResponse && (
        <div className="border border-dashed rounded-lg p-4 space-y-2 opacity-80">
          <h2 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Critique</h2>
          <div className="text-sm whitespace-pre-wrap text-muted-foreground">
            {run.critiqueResponse}
          </div>
        </div>
      )}

      {/* Recommendations */}
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

export default function RunPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RunContent />
    </Suspense>
  )
}
