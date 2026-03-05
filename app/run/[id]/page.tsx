// app/run/[id]/page.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PhaseProgress } from '@/components/PhaseProgress'
import { DebatePanel } from '@/components/DebatePanel'
import { ExportButton } from '@/components/ExportButton'
import { runDeliberation, type PhaseUpdate } from '@/lib/consilium'
import { getApiKey, getRunById } from '@/lib/storage'
import { PANELISTS, JUDGE } from '@/lib/models'
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
            content={panelTokens[p.name] ?? (run?.blindResponses.find(r => r.panelistName === p.name)?.content || '')}
            streaming={activePhase !== 'done' && !!panelTokens[p.name] && !run?.blindResponses.find(r => r.panelistName === p.name)?.content}
            phase={activePhase}
          />
        ))}
      </div>

      {(run?.judgeResponse || panelTokens[JUDGE.name]) && (
        <div className="border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-sm">Judge Synthesis</h2>
          <p className="text-sm whitespace-pre-wrap">
            {panelTokens[JUDGE.name] || run?.judgeResponse}
            {activePhase === 'judge' && <span className="animate-pulse">▋</span>}
          </p>
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
