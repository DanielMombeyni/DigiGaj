import { useEffect, useState } from 'react'
import { PencilLine, RefreshCw, ShieldCheck } from 'lucide-react'
import AuthShell, { AuthError } from '@/components/auth/AuthShell'

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 8) return phone || ''
  return `${digits.slice(0, 4)}***${digits.slice(-4)}`
}

export default function OtpCodeStep({
  phone,
  title = 'تأیید شماره موبایل',
  subtitle = 'کد ارسال‌شده را وارد کنید',
  successText,
  submitLabel = 'تأیید',
  submitting = false,
  resending = false,
  error = '',
  debugCode = '',
  resendAfter = 60,
  onSubmit,
  onResend,
  onEditPhone,
}) {
  const [code, setCode] = useState('')
  const [seconds, setSeconds] = useState(Math.max(0, Number(resendAfter) || 60))

  useEffect(() => {
    setSeconds(Math.max(0, Number(resendAfter) || 60))
  }, [resendAfter, phone])

  useEffect(() => {
    if (seconds <= 0) return undefined
    const timer = window.setInterval(() => {
      setSeconds((value) => (value <= 1 ? 0 : value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [seconds])

  const submitCode = (value) => {
    const next = String(value || '').trim()
    if (next.length < 5 || submitting) return
    onSubmit?.(next)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    submitCode(code)
  }

  return (
    <AuthShell title={title} subtitle={subtitle}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="relative overflow-hidden rounded-2xl border border-mist-200 bg-gradient-to-l from-mist-50 via-white to-copper-50/40 px-4 py-4">
          <div className="pointer-events-none absolute -left-6 -top-8 h-24 w-24 rounded-full bg-copper-200/30 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-copper-600 shadow-sm ring-1 ring-mist-200/80">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">کد به این شماره ارسال شد</p>
              <p className="mt-1.5 font-mono text-lg tracking-[0.18em] text-ink-800" dir="ltr">
                {maskPhone(phone)}
              </p>
              {successText ? <p className="mt-1.5 text-xs leading-5 text-ink-700/55">{successText}</p> : null}
            </div>
            <button
              type="button"
              onClick={onEditPhone}
              className="inline-flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-sea-600 transition hover:bg-white hover:text-copper-600"
            >
              <PencilLine className="h-3.5 w-3.5" strokeWidth={1.9} />
              ویرایش
            </button>
          </div>
        </div>

        <label className="block">
          <span className="label">کد تأیید ۶ رقمی</span>
          <input
            className="input min-h-14 text-center font-mono text-2xl tracking-[0.4em] shadow-inner"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, '').slice(0, 6)
              setCode(next)
              if (next.length === 6) submitCode(next)
            }}
            placeholder="------"
            required
            dir="ltr"
          />
          {debugCode ? (
            <span className="mt-1.5 block text-[11px] text-amber-700">کد آزمایشی: {debugCode}</span>
          ) : null}
        </label>

        <AuthError message={error} />

        <button type="submit" className="btn-primary min-h-11 w-full cursor-pointer" disabled={submitting || code.length < 5}>
          {submitting ? 'در حال بررسی...' : submitLabel}
        </button>

        <button
          type="button"
          disabled={seconds > 0 || resending}
          onClick={async () => {
            await onResend?.()
            setSeconds(Math.max(0, Number(resendAfter) || 60))
          }}
          className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-mist-200 bg-white text-sm text-ink-700 transition hover:bg-mist-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} strokeWidth={1.85} />
          {resending
            ? 'در حال ارسال مجدد...'
            : seconds > 0
              ? `ارسال مجدد تا ${seconds} ثانیه`
              : 'ارسال مجدد کد'}
        </button>
      </form>
    </AuthShell>
  )
}
