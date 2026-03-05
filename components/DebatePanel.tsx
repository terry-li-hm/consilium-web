// components/DebatePanel.tsx
'use client'
import { useEffect, useRef } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  name: string
  lab: string
  content: string
  streaming: boolean
  phase: string
}

const LAB_ACCENT: Record<string, string> = {
  OpenAI:    'border-l-green-600',
  Anthropic: 'border-l-orange-500',
  xAI:       'border-l-blue-600',
  Moonshot:  'border-l-purple-600',
  Zhipu:     'border-l-red-600',
}

function extractConfidence(content: string): number | null {
  const match = content.match(/\*\*Confidence:\s*(\d+)\/10\*\*/)
  if (!match) return null
  return parseInt(match[1], 10)
}

function stripConfidence(content: string): string {
  return content.replace(/\n*\*\*Confidence:\s*\d+\/10\*\*\s*$/, '').trimEnd()
}

function ConfidenceBadge({ score }: { score: number }) {
  const color =
    score >= 7 ? 'bg-green-500' :
    score >= 4 ? 'bg-amber-500' :
                 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/50">
      <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', color)} />
      <span className="text-xs text-muted-foreground">
        Confidence: <span className="font-medium text-foreground">{score}/10</span>
      </span>
    </div>
  )
}

export function DebatePanel({ name, lab, content, streaming, phase }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (streaming) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [content, streaming])

  const confidence = extractConfidence(content)
  const displayContent = confidence !== null ? stripConfidence(content) : content
  const tokenCount = content.length

  const accentClass = LAB_ACCENT[lab] ?? 'border-l-border'

  return (
    <Card className={cn(
      'flex flex-col border-l-[3px] animate-fade-in',
      accentClass,
      streaming && 'ring-1 ring-primary',
    )}>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{name}</span>
          <Badge variant="outline" className="text-xs">{lab}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {streaming && tokenCount > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">{tokenCount}</span>
          )}
          {streaming && (
            <span className="text-xs text-muted-foreground animate-pulse">typing...</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-64">
        <div className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
          {displayContent || <span className="text-muted-foreground italic">waiting...</span>}
          {streaming && <span className="animate-pulse">▋</span>}
        </div>
        {!streaming && confidence !== null && <ConfidenceBadge score={confidence} />}
        <div ref={bottomRef} />
      </CardContent>
    </Card>
  )
}
