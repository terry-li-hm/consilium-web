import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const authCookies = allCookies.filter(c => c.name.includes('auth-token'))
  
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  return NextResponse.json({
    cookieCount: allCookies.length,
    authCookies: authCookies.map(c => ({ name: c.name, len: c.value.length })),
    user: user?.email || null,
    error: error?.message || null,
  })
}
