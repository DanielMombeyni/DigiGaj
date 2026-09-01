import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getStorefrontConfig, peekStorefrontConfig } from '@/services/storefrontConfig'
import { isPageEnabled } from '@/config/publicPages'

export default function PublicPageGuard({ pageKey, children }) {
  const cached = peekStorefrontConfig()
  const [state, setState] = useState(() =>
    cached
      ? { loading: false, allowed: isPageEnabled(cached.pages, pageKey) }
      : { loading: true, allowed: true },
  )

  useEffect(() => {
    let cancelled = false
    getStorefrontConfig()
      .then((data) => {
        if (cancelled) return
        setState({
          loading: false,
          allowed: isPageEnabled(data?.pages, pageKey),
        })
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, allowed: true })
      })
    return () => {
      cancelled = true
    }
  }, [pageKey])

  if (state.loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-mist-200" />
      </div>
    )
  }

  if (!state.allowed) {
    return <Navigate to="/" replace />
  }

  return children
}
