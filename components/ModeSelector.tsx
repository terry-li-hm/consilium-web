// components/ModeSelector.tsx
'use client'
import { MODES } from '@/lib/models'
import type { Mode } from '@/types/deliberation'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Props {
  selected: Mode
  onChange: (mode: Mode) => void
}

export function ModeSelector({ selected, onChange }: Props) {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {MODES.map(mode => (
          <Tooltip key={mode.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onChange(mode.id)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  'hover:border-primary hover:bg-accent',
                  selected === mode.id
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border bg-background text-muted-foreground'
                )}
              >
                <div className="font-medium text-sm">{mode.label}</div>
                <div className="text-xs mt-0.5 text-muted-foreground">{mode.description}</div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-60">
              {mode.tooltip}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
