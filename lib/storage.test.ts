// lib/storage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

import {
  getApiKey, setApiKey, clearApiKey,
  saveRun, getRunHistory, getRunById, deleteRun,
  MAX_HISTORY,
} from './storage'

describe('api key', () => {
  beforeEach(() => localStorageMock.clear())

  it('returns null when not set', () => {
    expect(getApiKey()).toBeNull()
  })
  it('round-trips the key', () => {
    setApiKey('sk-or-test')
    expect(getApiKey()).toBe('sk-or-test')
  })
  it('clears the key', () => {
    setApiKey('sk-or-test')
    clearApiKey()
    expect(getApiKey()).toBeNull()
  })
})

describe('run history', () => {
  beforeEach(() => localStorageMock.clear())

  it('returns empty array when no history', () => {
    expect(getRunHistory()).toEqual([])
  })
  it('saves and retrieves a run', () => {
    const run = { id: 'abc', question: 'test', mode: 'oxford' } as any
    saveRun(run)
    expect(getRunHistory()).toHaveLength(1)
    expect(getRunById('abc')).toEqual(run)
  })
  it(`caps history at ${MAX_HISTORY}`, () => {
    for (let i = 0; i < MAX_HISTORY + 3; i++) {
      saveRun({ id: String(i), question: 'q', mode: 'quick' } as any)
    }
    expect(getRunHistory()).toHaveLength(MAX_HISTORY)
  })
  it('overwrites existing run with same id', () => {
    const run = { id: 'x', question: 'old', mode: 'quick' } as any
    saveRun(run)
    saveRun({ ...run, question: 'new' })
    expect(getRunHistory()).toHaveLength(1)
    expect(getRunById('x')?.question).toBe('new')
  })
})
