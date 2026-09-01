import { useLocation, useSearchParams, Link } from 'react-router-dom'

export default function PaymentResultPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const status = params.get('status') || 'pending'
  const tracking = params.get('tracking')
  const extra = location.state?.extra

  const title =
    status === 'success' ? 'پرداخت موفق' : status === 'failed' ? 'پرداخت ناموفق' : 'در انتظار تأیید'

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold ${
          status === 'success'
            ? 'bg-emerald-100 text-emerald-600'
            : status === 'failed'
              ? 'bg-red-100 text-red-600'
              : 'bg-amber-100 text-amber-600'
        }`}
      >
        {status === 'success' ? '✓' : status === 'failed' ? '✕' : '…'}
      </div>
      <h1 className="mt-6 font-display text-2xl font-bold">{title}</h1>
      {tracking && <p className="mt-2 font-mono text-sm text-ink-700/60">{tracking}</p>}
      {extra?.card_number && (
        <div className="mt-6 rounded-2xl bg-white p-5 text-right shadow-soft text-sm space-y-2">
          <p>شماره کارت: <b dir="ltr">{extra.card_number}</b></p>
          <p>صاحب کارت: {extra.card_holder}</p>
          {extra.bank_name && <p>بانک: {extra.bank_name}</p>}
          <p className="text-ink-700/60">{extra.instructions}</p>
        </div>
      )}
      <Link to="/" className="btn-dark mt-8 inline-flex">بازگشت به فروشگاه</Link>
    </div>
  )
}
