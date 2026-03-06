import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — consilium',
}

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-8 text-sm">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: March 6, 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">1. Service</h2>
        <p>consilium (&quot;we&quot;, &quot;us&quot;) provides a multi-model AI deliberation tool at consilium.sh. By using this service you agree to these terms.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">2. Acceptable use</h2>
        <p>You may use consilium for lawful purposes only. You must not use it to generate content that is illegal, harmful, or violates the terms of the underlying AI providers (OpenRouter, OpenAI, Anthropic, Google, xAI, Zhipu, Moonshot).</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">3. Subscriptions and billing</h2>
        <p>Pro subscriptions are billed monthly at $10/mo via Stripe. Subscriptions auto-renew until cancelled. You can cancel at any time through the billing portal; access continues until the end of the current billing period. No refunds are issued for partial months.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">4. Free tier limits</h2>
        <p>Free tier accounts are limited to 20 deliberation runs per day. We reserve the right to adjust these limits.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">5. Availability</h2>
        <p>We provide the service on an &quot;as is&quot; basis and do not guarantee uptime. AI model availability depends on third-party providers outside our control.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">6. Limitation of liability</h2>
        <p>To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the service. AI outputs are not professional advice.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">7. Changes</h2>
        <p>We may update these terms at any time. Continued use after changes constitutes acceptance.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-base">8. Contact</h2>
        <p>Questions? Email us at <a href="mailto:terry@consilium.sh" className="underline">terry@consilium.sh</a></p>
      </section>
    </main>
  )
}
