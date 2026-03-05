// lib/streaming.ts
import type { Message } from '@/types/deliberation'

export function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://consilium.sh',
    'X-Title': 'consilium.sh',
  }
}

export function parseSSEChunk(chunk: string): string[] {
  const tokens: string[] = []
  const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
  for (const line of lines) {
    const data = line.slice(6).trim()
    if (data === '[DONE]') continue
    try {
      const parsed = JSON.parse(data)
      const content = parsed.choices?.[0]?.delta?.content
      if (content) tokens.push(content)
    } catch {
      // malformed chunk — skip
    }
  }
  return tokens
}

export async function* streamCompletion(
  model: string,
  messages: Message[],
  apiKey: string,
  onToken?: (token: string) => void,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  })

  if (!response.ok) {
    const body = await response.text()
    if (response.status === 402) {
      throw new Error('OPENROUTER_OUT_OF_CREDITS: Your OpenRouter credits are exhausted. Top up at openrouter.ai/credits')
    } else if (response.status === 429) {
      throw new Error('OPENROUTER_RATE_LIMITED: Rate limit hit. Wait a moment and try again.')
    } else if (response.status === 401) {
      throw new Error('OPENROUTER_AUTH_FAILED: Invalid API key. Check your OpenRouter key.')
    } else {
      throw new Error(`OpenRouter error ${response.status}: ${body}`)
    }
  }

  if (!response.body) throw new Error('No response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const token of parseSSEChunk(chunk)) {
      onToken?.(token)
      yield token
    }
  }
}

export async function completeOnce(
  model: string,
  messages: Message[],
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  let result = ''
  for await (const token of streamCompletion(model, messages, apiKey, undefined, signal)) {
    result += token
  }
  return result
}
