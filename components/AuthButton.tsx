'use client'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn() {
    // Redirect to dedicated auth page which offers Google + GitHub
    window.location.href = '/auth'
  }

  async function signOut() {
    await getSupabase().auth.signOut()
    setUser(null)
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[140px]">{user.email}</span>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-xs">Sign out</Button>
      </div>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={signIn} className="text-xs">Sign in</Button>
  )
}
