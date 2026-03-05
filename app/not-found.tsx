export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-muted-foreground">This page doesn't exist.</p>
      <a href="/" className="text-sm underline">Back to app</a>
    </main>
  )
}
