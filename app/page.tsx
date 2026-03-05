// app/page.tsx
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ModeSelector } from '@/components/ModeSelector'
import { ApiKeySetup } from '@/components/ApiKeySetup'
import { getApiKey } from '@/lib/storage'
import { cn } from '@/lib/utils'
import type { Mode } from '@/types/deliberation'

const DOMAIN_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'banking', label: 'Banking / Financial Services' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'eu', label: 'EU Regulatory' },
  { value: 'fintech', label: 'Fintech' },
  { value: 'bio', label: 'Biotech / Pharma' },
]

export default function HomePage() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<Mode>('oxford')
  const [domain, setDomain] = useState<string>('')
  const [apiKey, setApiKey] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setApiKey(getApiKey())
  }, [])

  const handleStart = useCallback(() => {
    if (!question.trim() || !apiKey) return
    const id = crypto.randomUUID()
    // Store pending run config in sessionStorage for the run page to pick up
    sessionStorage.setItem(`pending:${id}`, JSON.stringify({ question: question.trim(), mode, domain: domain || undefined }))
    router.push(`/run?id=${id}`)
  }, [question, apiKey, mode, domain, router])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleStart()
      }
    }
    textarea.addEventListener('keydown', handler)
    return () => textarea.removeEventListener('keydown', handler)
  }, [handleStart])

  const canSubmit = !!question.trim() && !!apiKey

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8 max-w-3xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">consilium</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Five frontier models debate. One judge synthesizes.
        </p>
        <p className="text-muted-foreground text-xs">
          Multi-model deliberation for decisions that matter.
        </p>
      </div>

      <div className="w-full space-y-4">
        <Textarea
          ref={textareaRef}
          placeholder="What should I decide? What's likely to happen? What are the risks of...?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          rows={4}
          className="text-base resize-none"
        />

        <ModeSelector selected={mode} onChange={setMode} />

        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">
            Domain context (optional)
          </label>
          <select
            value={domain}
            onChange={e => setDomain(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {DOMAIN_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <ApiKeySetup
          existingKey={apiKey}
          onSave={k => setApiKey(k)}
          onClear={() => setApiKey(null)}
        />

        <Button
          className={cn(
            'w-full transition-all duration-200',
            canSubmit
              ? 'shadow-md hover:shadow-lg hover:brightness-110 scale-[1.01]'
              : 'opacity-40 cursor-not-allowed',
          )}
          size="lg"
          disabled={!canSubmit}
          onClick={handleStart}
        >
          Deliberate
          {canSubmit && (
            <span className="ml-2 text-xs opacity-60 hidden sm:inline">⌘↵</span>
          )}
        </Button>
      </div>

      <a href="/history" className="text-sm text-muted-foreground hover:underline">
        View past deliberations
      </a>
    </main>
  )
}
