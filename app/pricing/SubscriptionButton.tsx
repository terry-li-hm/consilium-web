'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function SubscriptionButton({
  tier,
  isSignedIn
}: {
  tier: string
  isSignedIn: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  if (!isSignedIn) {
    return (
      <Button asChild className="w-full">
        <Link href="/auth">Sign in to upgrade</Link>
      </Button>
    )
  }

  const handleAction = async () => {
    setLoading(true)
    try {
      const endpoint = tier === 'pro' ? '/api/billing/portal' : '/api/billing/checkout'
      const res = await fetch(endpoint, { method: 'POST' })
      const { url, error } = await res.json()
      if (error) {
        setErr(error)
        return
      }
      if (url) {
        window.location.href = url
      }
    } catch {
      setErr('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleAction}
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Processing…' : tier === 'pro' ? 'Manage billing' : 'Upgrade to Pro'}
      </Button>
      {err && <p className="text-xs text-destructive text-center">{err}</p>}
    </div>
  )
}
