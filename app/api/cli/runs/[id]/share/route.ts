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

  // Verify run belongs to current user
  const { data: run, error: fetchError } = await supabase
    .from('runs')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !run) {
    return NextResponse.json({ error: 'Run not found or unauthorized' }, { status: 404 })
  }

  // Generate slug: nanoid(10)
  const slug = nanoid(10)

  // Update run: set is_public=true, slug=generatedSlug
  const { error: updateError } = await supabase
    .from('runs')
    .update({ is_public: true, slug })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ url: `${process.env.NEXT_PUBLIC_APP_URL}/r/${slug}` })
}
