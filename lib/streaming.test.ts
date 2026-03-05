// lib/streaming.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseSSEChunk, buildHeaders } from './streaming'

describe('parseSSEChunk', () => {
  it('extracts content from SSE data line', () => {
    const chunk = 'data: {"choices":[{"delta":{"content":"hello"}}]}\n'
    expect(parseSSEChunk(chunk)).toEqual(['hello'])
  })
  it('returns empty array for [DONE]', () => {
    expect(parseSSEChunk('data: [DONE]\n')).toEqual([])
  })
  it('handles multiple lines in one chunk', () => {
    const chunk = 'data: {"choices":[{"delta":{"content":"a"}}]}\ndata: {"choices":[{"delta":{"content":"b"}}]}\n'
    expect(parseSSEChunk(chunk)).toEqual(['a', 'b'])
  })
  it('ignores non-data lines', () => {
    expect(parseSSEChunk(': ping\n')).toEqual([])
  })
  it('handles delta with no content key', () => {
    expect(parseSSEChunk('data: {"choices":[{"delta":{}}]}\n')).toEqual([])
  })
})

describe('buildHeaders', () => {
  it('includes Authorization and required OpenRouter headers', () => {
    const h = buildHeaders('sk-test')
    expect(h['Authorization']).toBe('Bearer sk-test')
    expect(h['HTTP-Referer']).toBe('https://consilium.sh')
    expect(h['X-Title']).toBe('consilium.sh')
    expect(h['Content-Type']).toBe('application/json')
  })
})
