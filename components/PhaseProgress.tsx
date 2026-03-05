// components/PhaseProgress.tsx
import { cn } from '@/lib/utils'
import type { Phase } from '@/types/deliberation'

const PHASES: { id: Phase; label: string }[] = [
  { id: 'blind', label: 'Blind' },
  { id: 'debate', label: 'Debate' },
  { id: 'judge', label: 'Judge' },
  { id: 'critique', label: 'Critique' },
  { id: 'extraction', label: 'Extract' },
  { id: 'done', label: 'Done' },
]

const PHASE_ORDER: Phase[] = ['idle', 'blind', 'xpol', 'debate', 'judge', 'critique', 'extraction', 'done']

interface Props {
  phase: Phase
}

export function PhaseProgress({ phase }: Props) {
  const currentIdx = PHASE_ORDER.indexOf(phase)

  return (
    <div className="flex items-center gap-1 text-xs">
      {PHASES.map((p, i) => {
        const phaseIdx = PHASE_ORDER.indexOf(p.id)
        const isComplete = currentIdx > phaseIdx
        const isCurrent = phase === p.id

        return (
          <div key={p.id} className="flex items-center gap-1">
            <span className={cn(
              'px-2 py-0.5 rounded-full',
              isComplete && 'bg-primary text-primary-foreground',
              isCurrent && 'bg-accent text-accent-foreground font-medium animate-pulse',
              !isComplete && !isCurrent && 'text-muted-foreground'
            )}>
              {p.label}
            </span>
            {i < PHASES.length - 1 && (
              <span className="text-muted-foreground">→</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
