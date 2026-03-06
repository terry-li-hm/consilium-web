import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DAILY_LIMITS = {
  pro: Infinity,
  free: 20,
} as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single()

  const tier = profile?.tier === 'pro' ? 'pro' : 'free'

  if (tier === 'pro') {
    return NextResponse.json({ allowed: true, used: 0, limit: null, tier: 'pro' })
  }

  const today = new Date().toISOString().slice(0, 10)

  const { count, error } = await supabase
    .from('runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', today)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const used = count ?? 0
  const limit = DAILY_LIMITS.free

  return NextResponse.json({
    allowed: used < limit,
    used,
    limit,
    tier,
  })
}
