import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Use createClient from @supabase/supabase-js directly with service role key for admin writes
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  let event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  switch (event.type) {
    case 'checkout.session.completed': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = event.data.object as any
      const userId = session.client_reference_id
      const stripeCustomerId = session.customer

      if (userId && stripeCustomerId) {
        await supabaseAdmin
          .from('profiles')
          .update({
            tier: 'pro',
            stripe_customer_id: stripeCustomerId,
          })
          .eq('id', userId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = event.data.object as any
      const stripeCustomerId = subscription.customer

      if (stripeCustomerId) {
        await supabaseAdmin
          .from('profiles')
          .update({ tier: 'free' })
          .eq('stripe_customer_id', stripeCustomerId)
      }
      break
    }

    default:
      // Unknown event type: return 200
      console.log(`Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
