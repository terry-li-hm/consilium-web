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
    router.push(`/run?id=${id}`)
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
