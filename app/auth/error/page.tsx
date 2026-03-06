export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="font-medium">Authentication failed.</p>
      {reason && (
        <p className="text-sm text-muted-foreground max-w-sm text-center">
          {decodeURIComponent(reason)}
        </p>
      )}
      <a href="/" className="text-sm underline text-muted-foreground">Back to app</a>
    </main>
  )
}
