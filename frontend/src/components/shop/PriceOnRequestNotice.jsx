import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { PRICE_ON_REQUEST_LABEL } from '@/utils/pricing'
import { cn } from '@/utils/format'
import { getStorefrontConfig, peekStorefrontConfig } from '@/services/storefrontConfig'

function normalizePhone(raw) {
  const phone = String(raw || '').trim()
  return phone || ''
}

function ContactAction({ phone, className, children, stopPropagation = false }) {
  if (phone) {
    return (
      <a
        href={`tel:${phone}`}
        className={className}
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation()
        }}
        aria-label={`تماس با ${phone}`}
      >
        {children}
      </a>
    )
  }
  return (
    <Link
      to="/contact"
      className={className}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation()
      }}
    >
      {children}
    </Link>
  )
}

/**
 * Contact-for-price notice — used on product cards and detail.
 * Prefer dialing company phone; fall back to /contact when missing.
 * @param {'card' | 'detail'} variant
 */
export default function PriceOnRequestNotice({ variant = 'card', className = '' }) {
  const [phone, setPhone] = useState(() => normalizePhone(peekStorefrontConfig()?.company_phone))

  useEffect(() => {
    let cancelled = false
    getStorefrontConfig()
      .then((data) => {
        if (!cancelled) setPhone(normalizePhone(data?.company_phone))
      })
      .catch(() => {
        if (!cancelled) setPhone('')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (variant === 'detail') {
    return (
      <div
        className={cn(
          'w-full max-w-md overflow-hidden rounded-2xl border border-copper-400/25 bg-gradient-to-l from-copper-500/10 via-mist-50 to-white p-5 shadow-soft',
          className,
        )}
      >
        <div className="flex gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-copper-400">
            <Phone className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-copper-600">قیمت اعلامی</p>
            <p className="mt-1 font-display text-base font-bold leading-7 text-ink-900 sm:text-lg">
              {PRICE_ON_REQUEST_LABEL}
            </p>
            <p className="mt-1.5 text-xs leading-6 text-ink-700/55">
              قیمت این کالا ثابت نیست؛ برای دریافت قیمت روز با پشتیبانی تماس بگیرید.
            </p>
            {phone ? (
              <p className="mt-2 font-mono text-sm font-semibold tracking-wide text-ink-900" dir="ltr">
                {phone}
              </p>
            ) : null}
          </div>
        </div>
        <ContactAction
          phone={phone}
          className="btn-primary mt-4 inline-flex min-h-11 w-full cursor-pointer justify-center sm:w-auto sm:px-6"
        >
          {phone ? 'تماس بگیرید' : 'تماس با ما'}
        </ContactAction>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-2 rounded-xl border border-copper-400/20 bg-copper-500/[0.06] px-3 py-2.5',
        className,
      )}
    >
      <p className="text-[11px] font-semibold leading-5 text-ink-800">{PRICE_ON_REQUEST_LABEL}</p>
      <ContactAction
        phone={phone}
        stopPropagation
        className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-copper-600 transition hover:text-copper-700"
      >
        <Phone className="h-3 w-3" strokeWidth={2} aria-hidden />
        {phone ? (
          <span className="inline-flex flex-col items-start gap-0.5">
            <span>تماس بگیرید</span>
            <span className="font-mono text-[10px] font-medium text-ink-700/55" dir="ltr">
              {phone}
            </span>
          </span>
        ) : (
          'تماس بگیرید'
        )}
      </ContactAction>
    </div>
  )
}
