import { createClient } from '@/lib/supabase/server'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default async function SharedRunPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: run, error } = await supabase
    .from('runs')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single()

  if (error || !run) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Run not found or not public.</p>
          <a href="/" className="text-sm underline text-primary hover:no-underline">Run your own deliberation</a>
        </div>
      </main>
    )
  }

  const payload = run.payload
  const extraction = payload?.extraction
  const judgeResponse = payload?.judgeResponse

  const modeBadgeClass = (mode: string) => {
    const map: Record<string, string> = {
      oxford: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
      quick: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
      redteam: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
      premortem: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
      forecast: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
    }
    return map[mode] ?? 'bg-muted text-muted-foreground border-transparent'
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto space-y-8 py-16 bg-background text-foreground animate-fade-in">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge className={modeBadgeClass(run.mode)} variant="outline">{run.mode}</Badge>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Shared Deliberation</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
          &ldquo;{run.question}&rdquo;
        </h1>
      </div>

      {judgeResponse && (
        <div className="space-y-4">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">Synthesis</h2>
          <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap border-l-2 border-primary/20 pl-6 italic text-foreground/90">
            {judgeResponse}
          </div>
        </div>
      )}

      {extraction && (
        <div className="space-y-8 pt-4">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {extraction.doNow?.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-green-600 flex items-center gap-1.5 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Do Now
                </h3>
                <ul className="space-y-2.5">
                  {extraction.doNow.map((item: string, i: number) => (
                    <li key={i} className="text-sm leading-snug text-foreground/80">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {extraction.considerLater?.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-amber-600 flex items-center gap-1.5 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Consider Later
                </h3>
                <ul className="space-y-2.5">
                  {extraction.considerLater.map((item: string, i: number) => (
                    <li key={i} className="text-sm leading-snug text-foreground/80">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {extraction.skip?.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                  Skip
                </h3>
                <ul className="space-y-2.5">
                  {extraction.skip.map((item: string, i: number) => (
                    <li key={i} className="text-sm leading-snug text-muted-foreground/70">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pt-12 border-t border-muted">
        <div className="bg-muted/30 rounded-xl p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">Inspired by this result? Run your own deliberation on any topic.</p>
          <a 
            href="/" 
            className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Run your own <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </main>
  )
}
