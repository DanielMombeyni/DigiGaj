import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { shopApi } from '@/services/api'
import { AccountCard, EmptyState, OrderStatusBadge } from '@/components/account/AccountUI'
import { toman, faDigits } from '@/utils/format'

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    shopApi
      .orders()
      .then((r) => setOrders(r.data.results || r.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AccountCard title="سوابق سفارش‌ها">
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-mist-100" />
          ))}
        </div>
      ) : orders.length ? (
        <div className="divide-y divide-mist-100">
          {orders.map((o) => (
            <Link
              key={o.id}
              to={`/account/orders/${o.id}`}
              className="flex cursor-pointer flex-wrap items-center justify-between gap-3 py-4 transition first:pt-0 last:pb-0 hover:opacity-80"
            >
              <div>
                <div className="font-medium text-ink-900">{o.order_number}</div>
                <div className="mt-1 text-xs text-ink-700/50">
                  {faDigits(new Date(o.created_at).toLocaleDateString('fa-IR'))} · {o.items?.length || 0} قلم
                </div>
              </div>
              <div className="flex items-center gap-3">
                <OrderStatusBadge status={o.status} />
                <span className="font-semibold text-copper-600">{toman(o.total_toman)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState message="هنوز سفارشی ثبت نکرده‌اید." actionTo="/products" actionLabel="مشاهده محصولات" />
      )}
    </AccountCard>
  )
}
