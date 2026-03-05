// app/history/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { getRunHistory, deleteRun } from '@/lib/storage'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { relativeTime } from '@/lib/utils'
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
            <a href={`/run?id=${run.id}`} className="flex-1 group">
              <p className="font-medium text-sm group-hover:underline line-clamp-2">
                {run.question}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{run.mode}</Badge>
                <span className="text-xs text-muted-foreground">
                  {relativeTime(run.startedAt)}
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
