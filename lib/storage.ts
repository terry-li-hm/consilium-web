// lib/storage.ts
import type { RunState } from '@/types/deliberation'

const API_KEY_KEY = 'consilium:apiKey'
const HISTORY_KEY = 'consilium:history'
export const MAX_HISTORY = 10

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_KEY)
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_KEY, key)
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_KEY)
}

export function getRunHistory(): RunState[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function getRunById(id: string): RunState | null {
  return getRunHistory().find(r => r.id === id) ?? null
}

export function saveRun(run: RunState): void {
  const history = getRunHistory().filter(r => r.id !== run.id)
  const updated = [run, ...history].slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
}

export function deleteRun(id: string): void {
  const history = getRunHistory().filter(r => r.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}
