import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const ALLOWED_MODELS = [
  'openai/gpt-5.4-pro',
  'anthropic/claude-opus-4-6',
  'x-ai/grok-4',
  'moonshotai/kimi-k2.5',
  'z-ai/glm-5',
  'google/gemini-3.1-pro-preview',
] as const

type StreamBody = {
  model?: string
  messages?: unknown
  max_tokens?: number
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single()

  if (profile?.tier !== 'pro') {
    return NextResponse.json({ error: 'Pro required' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({} as StreamBody))
  const { model, messages, max_tokens } = body

  if (!model || !ALLOWED_MODELS.includes(model as (typeof ALLOWED_MODELS)[number])) {
    return NextResponse.json({ error: 'Unsupported model' }, { status: 400 })
  }

  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: 'Invalid messages' }, { status: 400 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured' }, { status: 500 })
  }

  const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://consilium.sh',
      'X-Title': 'consilium.sh',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens,
    }),
  })

  if (!orRes.ok) {
    const text = await orRes.text()
    return NextResponse.json({ error: text }, { status: orRes.status })
  }

  return new Response(orRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
