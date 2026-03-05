import { describe, it, expect } from 'vitest'
import { parseExtraction, anonymise } from './consilium'
import type { ModelResponse } from '@/types/deliberation'

describe('parseExtraction', () => {
  it('parses all three sections', () => {
    const text = `DO NOW:\n- Take action A\n- Take action B\n\nCONSIDER LATER:\n- Option C\n\nSKIP:\n- Idea D because it is impractical`
    const result = parseExtraction(text)
    expect(result.doNow).toEqual(['Take action A', 'Take action B'])
    expect(result.considerLater).toEqual(['Option C'])
    expect(result.skip).toEqual(['Idea D because it is impractical'])
  })

  it('returns empty arrays for missing sections', () => {
    const result = parseExtraction('DO NOW:\n- Only this\n')
    expect(result.doNow).toEqual(['Only this'])
    expect(result.considerLater).toEqual([])
    expect(result.skip).toEqual([])
  })

  it('strips bullet dashes', () => {
    const result = parseExtraction('DO NOW:\n- item\nCONSIDER LATER:\nSKIP:')
    expect(result.doNow[0]).toBe('item')
  })

  it('handles empty input gracefully', () => {
    const result = parseExtraction('')
    expect(result.doNow).toEqual([])
    expect(result.considerLater).toEqual([])
    expect(result.skip).toEqual([])
  })

  it('trims whitespace from items', () => {
    const result = parseExtraction('DO NOW:\n-   padded item   \nCONSIDER LATER:\nSKIP:')
    expect(result.doNow[0]).toBe('padded item')
  })
})

describe('anonymise', () => {
  it('prefixes each response with Speaker N', () => {
    const responses: ModelResponse[] = [
      { panelistName: 'GPT-4o', content: 'Response A', streaming: false },
      { panelistName: 'Claude', content: 'Response B', streaming: false },
    ]
    const result = anonymise(responses)
    expect(result).toContain('Speaker 1:\nResponse A')
    expect(result).toContain('Speaker 2:\nResponse B')
  })

  it('does not include real panelist names', () => {
    const responses: ModelResponse[] = [
      { panelistName: 'GPT-4o', content: 'hello', streaming: false },
      { panelistName: 'Gemini', content: 'world', streaming: false },
    ]
    const result = anonymise(responses)
    expect(result).not.toContain('GPT-4o')
    expect(result).not.toContain('Gemini')
  })

  it('separates responses with a horizontal rule', () => {
    const responses: ModelResponse[] = [
      { panelistName: 'A', content: 'first', streaming: false },
      { panelistName: 'B', content: 'second', streaming: false },
    ]
    const result = anonymise(responses)
    expect(result).toContain('---')
  })

  it('returns empty string for empty array', () => {
    expect(anonymise([])).toBe('')
  })

  it('handles a single response without a separator', () => {
    const responses: ModelResponse[] = [
      { panelistName: 'Solo', content: 'only one', streaming: false },
    ]
    const result = anonymise(responses)
    expect(result).toBe('Speaker 1:\nonly one')
  })
})
