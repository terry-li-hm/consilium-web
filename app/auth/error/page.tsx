export default function AuthErrorPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="font-medium">Authentication failed.</p>
      <a href="/" className="text-sm underline text-muted-foreground">Back to app</a>
    </main>
  )
}
