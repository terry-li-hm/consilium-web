// app/run/page.tsx
'use client'
import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSearchParams, useRouter } from 'next/navigation'
import { PhaseProgress } from '@/components/PhaseProgress'
import { DebatePanel } from '@/components/DebatePanel'
import { ExportButton } from '@/components/ExportButton'
import { runDeliberation, type PhaseUpdate } from '@/lib/consilium'
import { getApiKey, getRunById, getRunHistory } from '@/lib/storage'
import { relativeTime } from '@/lib/utils'
import { PANELISTS, JUDGE, MODES } from '@/lib/models'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { RunState, Phase, Mode } from '@/types/deliberation'

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
  const [aborted, setAborted] = useState(false)
  const [question, setQuestion] = useState<string>('')
  const [runMode, setRunMode] = useState<Mode>('oxford')
  const [historyRuns, setHistoryRuns] = useState<import('@/types/deliberation').RunState[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const handleShare = async () => {
    if (!run?.id) return
    setSharing(true)
    try {
      const res = await fetch(`/api/cli/runs/${run.id}/share`, { method: 'POST' })
      const { url } = await res.json()
      if (url) {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSharing(false)
    }
  }

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
      // Sync to cloud if logged in (fire-and-forget)
      fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update.finalState),
      }).catch(() => {}) // silently fail if not logged in or offline
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
      const { question: q, mode, domain } = JSON.parse(pending)
      setQuestion(q)
      setRunMode(mode)
      abortRef.current = new AbortController()
      runDeliberation(q, mode, apiKey, handleUpdate, domain, abortRef.current.signal).catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') {
          setAborted(true)
        } else {
          setError(e.message)
        }
      })
      return
    }

    // Otherwise load from history (revisiting a completed run)
    const existing = getRunById(id)
    if (existing) {
      setRun(existing)
      setQuestion(existing.question)
      setRunMode(existing.mode)
      setActivePhase(existing.phase)
      setDone(existing.phase === 'done')
    } else {
      router.push('/')
    }
  }, [id, router, handleUpdate])

  // Load sidebar history whenever the run completes
  useEffect(() => {
    if (done) {
      setHistoryRuns(getRunHistory())
    }
  }, [done])

  if (aborted) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-muted-foreground font-medium">Deliberation stopped. Partial results saved to history.</p>
        <a href="/history" className="underline text-sm">View history</a>
        <a href="/" className="underline text-sm text-muted-foreground">Start over</a>
      </main>
    )
  }

  if (error) {
    let userMessage = error
    let helpLink: { href: string; label: string } | null = null
    if (error.startsWith('OPENROUTER_OUT_OF_CREDITS:')) {
      userMessage = 'Your OpenRouter credits are exhausted.'
      helpLink = { href: 'https://openrouter.ai/credits', label: 'Top up at openrouter.ai/credits' }
    } else if (error.startsWith('OPENROUTER_RATE_LIMITED:')) {
      userMessage = 'Rate limit hit — wait a moment and try again.'
    } else if (error.startsWith('OPENROUTER_AUTH_FAILED:')) {
      userMessage = 'Invalid API key. Check your OpenRouter key.'
    }
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-destructive font-medium">{userMessage}</p>
        {helpLink && (
          <a href={helpLink.href} target="_blank" rel="noopener noreferrer" className="underline text-sm text-blue-600">
            {helpLink.label}
          </a>
        )}
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

  // Cost estimate from mode config
  const modeConfig = MODES.find(m => m.id === runMode)
  const estimatedCost = modeConfig?.cost ?? ''

  // Mode badge colour map — simple palette
  const modeBadgeClass = (mode: string) => {
    const map: Record<string, string> = {
      oxford: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      quick: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      redteam: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      premortem: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      forecast: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    }
    return map[mode] ?? 'bg-muted text-muted-foreground'
  }

  const doneRuns = historyRuns.filter(r => r.phase === 'done')

  return (
    <div className="min-h-screen flex">
      {/* History sidebar — only visible on lg+ when run is done */}
      {done && (
        <>
          {/* Sidebar */}
          <aside
            className={`hidden lg:flex flex-col w-64 shrink-0 border-r bg-background overflow-y-auto ${sidebarOpen ? '' : 'lg:hidden'}`}
          >
            <div className="flex items-center justify-between px-3 py-3 border-b">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">History</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs leading-none"
                aria-label="Close sidebar"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {doneRuns.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">No past deliberations.</p>
              ) : (
                doneRuns.map(r => (
                  <a
                    key={r.id}
                    href={`/run?id=${r.id}`}
                    className={`block px-3 py-2 rounded-md mx-1 my-0.5 hover:bg-muted/60 transition-colors ${r.id === id ? 'bg-muted font-medium' : ''}`}
                  >
                    <p className="text-xs line-clamp-2 leading-snug">{r.question}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${modeBadgeClass(r.mode)}`}>
                        {r.mode}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{relativeTime(r.startedAt)}</span>
                    </div>
                  </a>
                ))
              )}
            </nav>
            <div className="px-3 py-2 border-t">
              <a href="/history" className="text-xs text-muted-foreground hover:underline">View all</a>
            </div>
          </aside>

          {/* Re-open button when sidebar is collapsed */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden lg:flex items-center justify-center w-8 shrink-0 border-r hover:bg-muted/40 transition-colors"
              aria-label="Open sidebar"
            >
              <span className="text-muted-foreground text-xs rotate-90">▶</span>
            </button>
          )}
        </>
      )}

    <main className="flex-1 p-6 max-w-5xl mx-auto space-y-6">
      {!done && (
        <div className="sticky top-12 bg-background/80 backdrop-blur z-10 py-2 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-amber-600 font-medium">Keep this tab open during deliberation</span>
            {activePhase !== 'idle' && PHASE_DESCRIPTIONS[activePhase] && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {PHASE_DESCRIPTIONS[activePhase]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none"><PhaseProgress phase={activePhase} /></div>
            <button
              onClick={() => abortRef.current?.abort()}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {done && run && (
        <div className="sticky top-12 bg-background/80 backdrop-blur z-10 py-2 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <PhaseProgress phase="done" />
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-muted/60 transition-colors"
            >
              + New deliberation
            </a>
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                disabled={sharing}
                className="text-xs"
              >
                {copied ? 'Copied!' : 'Share'}
              </Button>
            )}
            <ExportButton run={run} />
          </div>
        </div>
      )}

      {/* Question display */}
      {question && (
        <blockquote className="border-l-2 border-muted pl-4 text-sm text-muted-foreground italic line-clamp-2">
          &ldquo;{question}&rdquo;
        </blockquote>
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
              slowStart={p.slowStart}
            />
          )
        })}
      </div>

      {/* xpol streaming — show live tokens while xpol phase is active */}
      {activePhase === 'xpol' && phaseTokens['xpol'] && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">Cross-Pollination</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PANELISTS.map(p => {
              const xpolContent = phaseTokens['xpol']?.[p.name] ?? ''
              if (!xpolContent) return <PanelSkeleton key={p.name} name={p.name} lab={p.lab} />
              return (
                <DebatePanel
                  key={p.name}
                  name={p.name}
                  lab={p.lab}
                  content={xpolContent}
                  streaming={true}
                  phase="xpol"
                />
              )
            })}
          </div>
        </div>
      )}

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PANELISTS.map(p => {
              const debateContent = phaseTokens['debate']?.[p.name] ?? ''
              if (!debateContent) return <PanelSkeleton key={p.name} name={p.name} lab={p.lab} />
              return (
                <DebatePanel
                  key={p.name}
                  name={p.name}
                  lab={p.lab}
                  content={debateContent}
                  streaming={true}
                  phase="debate"
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Judge synthesis */}
      {showJudge && (
        <div className="border rounded-lg p-4 space-y-2 animate-fade-in">
          <h2 className="font-semibold text-sm">Judge Synthesis</h2>
          {judgeContent ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{judgeContent}</ReactMarkdown>
              {activePhase === 'judge' && <span className="animate-pulse not-prose">▋</span>}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground animate-pulse">Synthesising…</span>
          )}
        </div>
      )}

      {/* Critique — secondary, subdued style */}
      {run?.critiqueResponse && (
        <div className="border border-dashed rounded-lg p-4 space-y-2 opacity-80">
          <h2 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Critique</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.critiqueResponse}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Recommendations loading skeleton */}
      {activePhase === 'extraction' && !run?.extraction && (
        <div className="border rounded-lg p-4 space-y-4 animate-pulse">
          <h2 className="font-semibold text-sm">Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['Do Now', 'Consider Later', 'Skip'].map(label => (
              <div key={label} className="space-y-2">
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-4/5" />
                <div className="h-3 bg-muted rounded w-3/5" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {run?.extraction && (
        <div className="border rounded-lg p-4 space-y-4 animate-fade-in">
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

      {/* Cost estimate — shown after run completes */}
      {done && estimatedCost && (
        <p className="text-xs text-muted-foreground text-center">
          {estimatedCost} estimated cost
        </p>
      )}

      <div className="text-center">
        <a href="/" className="text-sm text-muted-foreground hover:underline">New deliberation</a>
      </div>
    </main>
    </div>
  )
}

export default function RunPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RunContent />
    </Suspense>
  )
}
