import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, label, created_at, last_used_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single()

  if (profile?.tier !== 'pro') {
    return NextResponse.json(
      { error: 'Pro subscription required', upgradeUrl: '/pricing' },
      { status: 402 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const label = (body.label as string | undefined) ?? 'CLI key'

  const rawKey = `ck_${crypto.randomUUID().replace(/-/g, '')}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

  const admin = getAdminClient()
  const { data: record, error } = await admin
    .from('api_keys')
    .insert({ user_id: user.id, key_hash: keyHash, label })
    .select('id, label, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ key: rawKey, record })
}
