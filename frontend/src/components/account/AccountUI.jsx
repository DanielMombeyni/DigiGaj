import { Link } from 'react-router-dom'
import { ORDER_STATUS, ORDER_STATUS_FLOW } from '@/config/account'
import { toman, faDigits } from '@/utils/format'

export function OrderStatusBadge({ status }) {
  const meta = ORDER_STATUS[status] || { label: status, cls: 'border-mist-200 bg-mist-100 text-ink-700/60' }
  return (
    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium ${meta.cls}`}>
      {meta.label}
    </span>
  )
}

export function OrderTrackingSteps({ status }) {
  if (status === 'cancelled' || status === 'refunded') {
    return (
      <p className="text-sm text-ink-700/55">
        این سفارش {ORDER_STATUS[status]?.label || status} است.
      </p>
    )
  }

  if (status === 'awaiting_price') {
    return (
      <p className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm leading-7 text-violet-800">
        برخی اقلام این سفارش هنوز قیمت ندارند. پس از اعلام قیمت توسط فروشگاه می‌توانید پرداخت کنید.
      </p>
    )
  }

  const currentIdx = ORDER_STATUS_FLOW.indexOf(status)
  const steps = ORDER_STATUS_FLOW.slice(1)

  return (
    <ol className="grid gap-3 sm:grid-cols-4">
      {steps.map((step, i) => {
        const done = currentIdx >= ORDER_STATUS_FLOW.indexOf(step)
        const active = status === step
        const meta = ORDER_STATUS[step]
        return (
          <li
            key={step}
            className={`rounded-xl border px-3 py-3 text-center text-xs ${
              done
                ? 'border-copper-400/40 bg-copper-500/5 text-ink-900'
                : 'border-mist-200 bg-white text-ink-700/40'
            } ${active ? 'ring-2 ring-copper-400/30' : ''}`}
          >
            <div className="font-semibold">{meta?.label || step}</div>
          </li>
        )
      })}
    </ol>
  )
}

export function AccountCard({ title, children, actions }) {
  return (
    <section className="rounded-2xl border border-mist-200/80 bg-white p-5 shadow-soft">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="font-semibold text-ink-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function EmptyState({ message, actionTo, actionLabel }) {
  return (
    <div className="rounded-2xl border border-dashed border-mist-200 bg-mist-50/50 px-6 py-14 text-center">
      <p className="text-sm text-ink-700/55">{message}</p>
      {actionTo && actionLabel && (
        <Link to={actionTo} className="btn-primary mt-4 inline-flex cursor-pointer text-xs">
          {actionLabel}
        </Link>
      )}
    </div>
  )
}

export function formatOrderRow(order) {
  return {
    id: order.id,
    number: order.order_number,
    status: order.status,
    total: toman(order.total_toman),
    date: faDigits(new Date(order.created_at).toLocaleDateString('fa-IR')),
  }
}
