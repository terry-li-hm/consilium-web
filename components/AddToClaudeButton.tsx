'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const CLAUDE_SNIPPET = `# consilium — multi-model deliberation
# Add this to your CLAUDE.md to use consilium from Claude Code:

For hard decisions, strategic questions, or anything worth a second opinion,
run: \`consilium "<your question>"\` (CLI) or visit https://consilium.sh

# Install CLI (requires Rust):
# cargo install consilium
# Then set OPENROUTER_API_KEY in your .zshenv

# Or use the web app directly at https://consilium.sh — paste your OpenRouter key and go.`

export function AddToClaudeButton() {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(CLAUDE_SNIPPET)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-2">
      <span>{copied ? '✓ Copied' : '+ Add to Claude Code'}</span>
    </Button>
  )
}
