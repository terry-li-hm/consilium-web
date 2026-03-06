import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const authCookies = allCookies.filter(c => c.name.includes('auth-token'))

  const supabase = await createClient()
  const getUserResult = await supabase.auth.getUser()
  const getSessionResult = await supabase.auth.getSession()

  return NextResponse.json({
    cookieCount: allCookies.length,
    authCookies: authCookies.map(c => ({ name: c.name, len: c.value.length })),
    getUser: { email: getUserResult.data.user?.email || null, error: getUserResult.error?.message || null },
    getSession: { email: getSessionResult.data.session?.user.email || null, error: getSessionResult.error?.message || null },
  })
}
