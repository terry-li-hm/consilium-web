'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

type ApiKey = {
  id: string
  label: string | null
  created_at: string
  last_used_at: string | null
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetch('/api/keys')
      .then(r => r.ok ? r.json() : [])
      .then(setKeys)
      .finally(() => setLoading(false))
  }, [])

  async function generate() {
    setGenerating(true)
    const res = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'CLI key' }) })
    if (res.ok) {
      const data = await res.json()
      setNewKeyValue(data.key) // raw key shown once
      setKeys(prev => [...prev, data.record])
    }
    setGenerating(false)
  }

  async function revoke(id: string) {
    await fetch(`/api/keys/${id}`, { method: 'DELETE' })
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settings</h1>
        <a href="/" className="text-sm text-muted-foreground hover:underline">Back</a>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-sm">CLI API Keys</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Use with <code className="bg-muted px-1 rounded">consilium --push</code> to sync CLI runs to your account</p>
          </div>
          <Button size="sm" onClick={generate} disabled={generating}>
            {generating ? 'Generating...' : 'New key'}
          </Button>
        </div>

        {newKeyValue && (
          <div className="border border-green-200 bg-green-50 dark:bg-green-950/20 rounded-lg p-4 space-y-2">
            <p className="text-xs font-medium text-green-700 dark:text-green-400">New key — copy it now, it won&apos;t be shown again:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{newKeyValue}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newKeyValue); setNewKeyValue(null) }}>
                Copy &amp; dismiss
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Add to your shell: <code>export CONSILIUM_API_KEY={newKeyValue}</code></p>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No keys yet. Generate one to use the CLI.</p>
        ) : (
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{k.label ?? 'Unnamed key'}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive text-xs" onClick={() => revoke(k.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-6 space-y-3">
        <h2 className="font-medium text-sm">Quick setup</h2>
        <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto">{`# Install the CLI
cargo install consilium

# Set your OpenRouter key (already have this from the web app)
export OPENROUTER_API_KEY=sk-or-v1-...

# Set your consilium.sh key (from above)
export CONSILIUM_API_KEY=<your-key>

# Run and auto-sync to your account
consilium "Should I take this job offer?" --push

# Run, sync, and get a shareable URL
consilium "What are the risks?" --push --share`}</pre>
      </div>
    </main>
  )
}
