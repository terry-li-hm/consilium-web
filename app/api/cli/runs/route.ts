import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function authenticateCLI(request: Request): Promise<string | null> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const rawKey = auth.slice(7)
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('api_keys').select('user_id').eq('key_hash', keyHash).single()
  if (!data) return null
  await supabaseAdmin.from('api_keys').update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)
  return data.user_id as string
}

export async function POST(request: Request) {
  const userId = await authenticateCLI(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseAdmin = getSupabaseAdmin()
  const run = await request.json()
  const { error } = await supabaseAdmin.from('runs').upsert({
    id: run.id,
    user_id: userId,
    question: run.question,
    mode: run.mode,
    payload: run,
    phase: 'done',
    source: 'cli',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
