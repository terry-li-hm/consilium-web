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

export function DebatePanel({ name, lab, content, streaming, phase }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (streaming) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [content, streaming])

  return (
    <Card className={cn('flex flex-col', streaming && 'ring-1 ring-primary')}>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{name}</span>
          <Badge variant="outline" className="text-xs">{lab}</Badge>
        </div>
        {streaming && (
          <span className="text-xs text-muted-foreground animate-pulse">typing...</span>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-64">
        <div className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
          {content || <span className="text-muted-foreground italic">waiting...</span>}
          {streaming && <span className="animate-pulse">▋</span>}
        </div>
        <div ref={bottomRef} />
      </CardContent>
    </Card>
  )
}
