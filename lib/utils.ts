import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns a human-friendly relative time string for a Unix timestamp (ms).
 * - <1h  → "Xm ago"
 * - <24h → "Xh ago"
 * - <48h → "yesterday"
 * - else → locale date string
 */
export function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMs / 3_600_000)
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffHours < 48) return 'yesterday'
  return new Date(ts).toLocaleDateString()
}
