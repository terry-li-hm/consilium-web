// components/ExportButton.tsx
'use client'
import { Button } from '@/components/ui/button'
import type { RunState } from '@/types/deliberation'

interface Props {
  run: RunState
}

function toMarkdown(run: RunState): string {
  const lines: string[] = [
    `# consilium — ${run.mode} deliberation`,
    `**Question:** ${run.question}`,
    `**Date:** ${new Date(run.startedAt).toLocaleString()}`,
    '',
    '---',
    '',
    '## Blind Phase',
    ...run.blindResponses.map(r => `### ${r.panelistName}
${r.content}`),
  ]

  if (run.debateRounds.length > 0) {
    for (const rd of run.debateRounds) {
      lines.push('', `## Debate Round ${rd.roundNum}`)
      for (const r of rd.responses) {
        lines.push(`### ${r.panelistName}
${r.content}`)
      }
    }
  }

  if (run.judgeResponse) {
    lines.push('', '## Judge Synthesis', run.judgeResponse)
  }
  if (run.critiqueResponse) {
    lines.push('', '## Critique', run.critiqueResponse)
  }
  if (run.extraction) {
    lines.push('', '## Recommendations')
    lines.push('### Do Now')
    run.extraction.doNow.forEach(i => lines.push(`- ${i}`))
    lines.push('### Consider Later')
    run.extraction.considerLater.forEach(i => lines.push(`- ${i}`))
    lines.push('### Skip')
    run.extraction.skip.forEach(i => lines.push(`- ${i}`))
  }

  return lines.join('
')
}

export function ExportButton({ run }: Props) {
  const copyMd = async () => {
    await navigator.clipboard.writeText(toMarkdown(run))
  }

  const printPdf = () => {
    window.print()
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={copyMd}>
        Copy Markdown
      </Button>
      <Button variant="outline" size="sm" onClick={printPdf}>
        Export PDF
      </Button>
    </div>
  )
}
