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
        alert(error)
        return
      }
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error(err)
      alert('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleAction}
      disabled={loading}
      className="w-full"
    >
      {loading ? 'Processing...' : tier === 'pro' ? 'Manage billing' : 'Upgrade to Pro'}
    </Button>
  )
}
