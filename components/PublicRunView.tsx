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
