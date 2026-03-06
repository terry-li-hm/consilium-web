// components/ApiKeySetup.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setApiKey, clearApiKey } from '@/lib/storage'

interface Props {
  existingKey: string | null
  onSave: (key: string) => void
  onClear: () => void
}

export function ApiKeySetup({ existingKey, onSave, onClear }: Props) {
  const [value, setValue] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = () => {
    if (!value.startsWith('sk-or-')) {
      setErr('OpenRouter keys start with sk-or-')
      return
    }
    setErr('')
    setApiKey(value)
    onSave(value)
    setValue('')
  }

  if (existingKey) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>OpenRouter key: {showKey ? existingKey : '••••••••' + existingKey.slice(-4)}</span>
        <button onClick={() => setShowKey(!showKey)} className="underline text-xs">
          {showKey ? 'hide' : 'show'}
        </button>
        <button onClick={() => { clearApiKey(); onClear() }} className="underline text-xs text-destructive">
          remove
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Enter your{' '}
        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="underline">
          OpenRouter API key
        </a>{' '}
        to start. Your key stays in your browser and is never sent to our servers.
      </p>
      <div className="flex gap-2">
        <Input
          type="password"
          placeholder="sk-or-v1-..."
          value={value}
          onChange={e => { setValue(e.target.value); setErr('') }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="font-mono text-sm"
        />
        <Button onClick={handleSave} disabled={!value}>Save</Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  )
}
