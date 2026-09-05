import BrandLogo from '@/components/common/BrandLogo'

/**
 * Branded loading UI.
 * - fullscreen: auth/config boot, full-viewport gate
 * - page: section / layout content area
 * - inline: compact block inside cards
 */
export default function LoadingScreen({
  variant = 'page',
  label = 'در حال بارگذاری...',
  tone = 'light',
  className = '',
}) {
  const dark = tone === 'dark'
  const mark = (
    <div className="loader-mark relative flex h-16 w-16 items-center justify-center sm:h-[4.5rem] sm:w-[4.5rem]">
      <span className="loader-ring absolute inset-0 rounded-full" aria-hidden />
      <span className="loader-ring-delay absolute inset-[6px] rounded-full" aria-hidden />
      <span
        className={`relative flex h-10 w-10 items-center justify-center rounded-full shadow-[0_8px_28px_rgba(217,119,87,0.35)] sm:h-11 sm:w-11 ${
          dark ? 'bg-copper-500' : 'bg-gradient-to-br from-copper-400 to-copper-600'
        }`}
      >
        <span className="loader-core h-2 w-2 rounded-full bg-white" aria-hidden />
      </span>
    </div>
  )

  const body = (
    <div
      className="flex flex-col items-center gap-5 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {mark}
      <div className="space-y-2">
        <BrandLogo
          size="md"
          className="block"
          accentClass={dark ? 'text-copper-400' : 'text-copper-500'}
          restClass={dark ? 'text-white' : 'text-ink-900'}
        />
        {label ? (
          <p
            className={`text-sm ${dark ? 'text-white/55' : 'text-ink-700/55'}`}
          >
            {label}
          </p>
        ) : null}
        <div className="mx-auto flex items-center justify-center gap-1.5 pt-1" aria-hidden>
          <span className="loader-dot h-1.5 w-1.5 rounded-full bg-copper-500" />
          <span className="loader-dot loader-dot-2 h-1.5 w-1.5 rounded-full bg-copper-500" />
          <span className="loader-dot loader-dot-3 h-1.5 w-1.5 rounded-full bg-copper-500" />
        </div>
      </div>
    </div>
  )

  if (variant === 'fullscreen') {
    return (
      <div
        className={`fixed inset-0 z-[90] flex items-center justify-center overflow-hidden ${
          dark ? 'bg-ink-950 text-white' : 'bg-[#f7f5f2] text-ink-900'
        } ${className}`}
      >
        <div
          className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-copper-400/20 blur-3xl animate-orb"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 bottom-8 h-64 w-64 rounded-full bg-sea-600/20 blur-3xl animate-orb-slow"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 hero-noise opacity-40" aria-hidden />
        <div className="relative animate-rise px-6">{body}</div>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 py-8 ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="loader-mark relative flex h-11 w-11 items-center justify-center">
          <span className="loader-ring absolute inset-0 rounded-full" aria-hidden />
          <span className="relative h-3.5 w-3.5 rounded-full bg-copper-500 shadow-[0_0_12px_rgba(217,119,87,0.45)]" />
        </div>
        {label ? (
          <p className={`text-xs ${dark ? 'text-white/50' : 'text-ink-700/50'}`}>{label}</p>
        ) : null}
      </div>
    )
  }

  // page
  return (
    <div
      className={`relative flex min-h-[50vh] items-center justify-center overflow-hidden px-4 py-16 ${
        dark ? 'text-white' : 'text-ink-900'
      } ${className}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 opacity-70 ${
          dark
            ? 'bg-[radial-gradient(ellipse_at_50%_40%,rgba(232,168,124,0.12),transparent_55%)]'
            : 'bg-[radial-gradient(ellipse_at_50%_40%,rgba(217,119,87,0.08),transparent_55%)]'
        }`}
        aria-hidden
      />
      <div className="relative animate-rise">{body}</div>
    </div>
  )
}
