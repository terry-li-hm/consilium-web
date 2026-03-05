import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check pro tier
  const { data: profile } = await supabase
    .from('profiles').select('tier').eq('id', user.id).single()
  if (profile?.tier !== 'pro') {
    return NextResponse.json({ error: 'Pro required', upgrade: '/pricing' }, { status: 403 })
  }

  // Generate slug and make public
  const slug = nanoid(8)
  const { error } = await supabase
    .from('runs')
    .update({ is_public: true, slug })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: `${process.env.NEXT_PUBLIC_APP_URL}/r/${slug}` })
}
