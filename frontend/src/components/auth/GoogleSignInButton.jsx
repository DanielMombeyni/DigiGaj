import { useState } from 'react'
import { beginGoogleRedirect } from '@/utils/googleAuth'

export default function GoogleSignInButton({ clientId, nextPath = '/', label = 'ورود با گوگل' }) {
  const [busy, setBusy] = useState(false)

  if (!clientId) return null

  const start = async () => {
    setBusy(true)
    try {
      await beginGoogleRedirect(clientId, nextPath)
    } catch {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-mist-200 bg-white px-4 text-sm font-medium text-ink-900 transition hover:bg-mist-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
        <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5z" />
        <path fill="#34A853" d="M12 24c3.2 0 5.8-1 7.7-2.8l-3.7-2.9c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.6v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.4 14.6A7.2 7.2 0 0 1 5 12c0-.9.2-1.8.4-2.6V6.3H1.6A12 12 0 0 0 0 12c0 1.9.5 3.8 1.6 5.4l3.8-2.8z" />
        <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.8 1.2 15.2 0 12 0A12 12 0 0 0 1.6 6.3l3.8 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
      </svg>
      {busy ? 'در حال انتقال به گوگل...' : label}
    </button>
  )
}
