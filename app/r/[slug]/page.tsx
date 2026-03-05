// app/r/[slug]/page.tsx
// NOTE: This is a stub — Supabase query added in Phase 2 Task 6
export default function SharedRunPage({ params }: { params: { slug: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-muted-foreground">This run will be available once sharing is enabled.</p>
        <a href="/" className="text-sm underline">Run your own deliberation</a>
      </div>
    </main>
  )
}
