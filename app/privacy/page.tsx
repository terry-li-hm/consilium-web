import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — consilium',
}

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-8 text-sm">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: March 6, 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">1. What we collect</h2>
        <p>When you sign in with Google or GitHub, we receive your email address and name from the OAuth provider. We store this in our database (Supabase, hosted in Tokyo) to manage your account and subscription.</p>
        <p>We log each deliberation run — the timestamp and your user ID — to enforce daily usage limits. We do not store the content of your questions or the AI responses.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">2. API keys</h2>
        <p>Free tier users supply their own OpenRouter API key. This key is stored only in your browser&apos;s local storage and is never sent to our servers.</p>
        <p>Pro tier users use our hosted key. API requests are proxied through our server and forwarded to OpenRouter. We do not log the content of these requests.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">3. Payments</h2>
        <p>Payments are processed by Stripe. We do not store your card details. Stripe&apos;s privacy policy applies to payment data.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">4. Third-party services</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Supabase — authentication and database</li>
          <li>OpenRouter — AI model routing</li>
          <li>Stripe — payment processing</li>
          <li>Vercel — hosting</li>
        </ul>
        <p>Each service operates under its own privacy policy.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">5. Data retention and deletion</h2>
        <p>You can delete your account at any time by contacting us at the address below. We will delete your account data within 30 days.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">6. Contact</h2>
        <p>Questions? Email us at <a href="mailto:terry@consilium.sh" className="underline">terry@consilium.sh</a></p>
      </section>
    </main>
  )
}
