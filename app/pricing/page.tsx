import { createClient } from '@/lib/supabase/server'
import { SubscriptionButton } from './SubscriptionButton'
import Link from 'next/link'

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let tier = 'free'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()
    
    if (profile?.tier) {
      tier = profile.tier
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto space-y-12 pt-16">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold">Simple pricing</h1>
        <p className="text-muted-foreground">Free with your own API key. Pro for sharing and sync.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free */}
        <div className="border rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Free</h2>
            <p className="text-3xl font-bold mt-1">$0</p>
            <p className="text-sm text-muted-foreground">Bring your own OpenRouter API key</p>
          </div>
          <ul className="space-y-2 text-sm">
            {['All 5 deliberation modes', 'Full streaming debate UI', 'Local history (browser)', 'Export to Markdown / PDF', 'Claude Code integration'].map(f => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-green-500">✓</span> {f}
              </li>
            ))}
          </ul>
          <a href="/" className="block w-full text-center border rounded-lg py-2 text-sm hover:bg-muted transition-colors">
            Start free
          </a>
        </div>

        {/* Pro */}
        <div className="border-2 border-primary rounded-xl p-6 space-y-4 relative">
          <div>
            <h2 className="text-xl font-semibold">Pro</h2>
            <p className="text-3xl font-bold mt-1">$10<span className="text-base font-normal text-muted-foreground">/mo</span></p>
            <p className="text-sm text-muted-foreground">No API key needed — we handle it</p>
          </div>
          <ul className="space-y-2 text-sm">
            {['No API key required', 'Cloud history sync', 'Shareable run URLs', 'CLI push + share', 'Cross-device access'].map(f => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-primary">✓</span> {f}
              </li>
            ))}
          </ul>
          <SubscriptionButton tier={tier} isSignedIn={!!user} />
        </div>
      </div>

      <div className="text-center">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">Back to app</Link>
      </div>
    </main>
  )
}
