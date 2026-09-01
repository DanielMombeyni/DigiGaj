import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { shopApi } from '@/services/api'
import {
  AccountCard,
  OrderStatusBadge,
  OrderTrackingSteps,
} from '@/components/account/AccountUI'
import { toman, faDigits } from '@/utils/format'

export default function AccountOrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    shopApi
      .order(id)
      .then((r) => setOrder(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-mist-100" />
  }

  if (error || !order) {
    return (
      <AccountCard title="سفارش یافت نشد">
        <Link to="/account/orders" className="text-sm text-sea-600 hover:text-copper-600">
          بازگشت به لیست سفارش‌ها
        </Link>
      </AccountCard>
    )
  }

  return (
    <div className="space-y-4">
      <Link to="/account/orders" className="inline-flex text-sm text-sea-600 hover:text-copper-600">
        ← بازگشت به سفارش‌ها
      </Link>

      <AccountCard
        title={`سفارش ${order.order_number}`}
        actions={<OrderStatusBadge status={order.status} />}
      >
        <p className="mb-4 text-xs text-ink-700/50">
          ثبت: {faDigits(new Date(order.created_at).toLocaleString('fa-IR'))}
        </p>

        <h3 className="mb-3 text-sm font-semibold text-ink-900">پیگیری سفارش</h3>
        <OrderTrackingSteps status={order.status} />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-mist-50 p-4 text-sm">
            <div className="font-semibold text-ink-900">آدرس تحویل</div>
            <p className="mt-2 leading-7 text-ink-700/70">
              {order.full_name} · {order.phone}
              <br />
              {[order.province, order.city].filter(Boolean).join('، ')}
              {(order.province || order.city) && '، '}
              {order.address}
              {order.postal_code && <><br />کد پستی: {order.postal_code}</>}
            </p>
          </div>
          <div className="rounded-xl bg-mist-50 p-4 text-sm">
            <div className="font-semibold text-ink-900">مبلغ</div>
            <dl className="mt-2 space-y-1 text-ink-700/70">
              <div className="flex justify-between"><dt>جمع</dt><dd>{toman(order.subtotal_toman)}</dd></div>
              {order.discount_toman > 0 && (
                <div className="flex justify-between"><dt>تخفیف</dt><dd>-{toman(order.discount_toman)}</dd></div>
              )}
              {order.shipping_toman > 0 && (
                <div className="flex justify-between"><dt>ارسال</dt><dd>{toman(order.shipping_toman)}</dd></div>
              )}
              <div className="flex justify-between border-t border-mist-200 pt-2 font-semibold text-ink-900">
                <dt>کل</dt><dd className="text-copper-600">{toman(order.total_toman)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </AccountCard>

      <AccountCard title="اقلام سفارش">
        <div className="divide-y divide-mist-100">
          {(order.items || []).map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div>
                <div className="font-medium text-ink-900">{item.product_name}</div>
                {item.variant_label && (
                  <div className="text-xs text-ink-700/50">{item.variant_label}</div>
                )}
                <div className="text-xs text-ink-700/45">تعداد: {item.quantity}</div>
              </div>
              <div className="font-semibold text-ink-900">{toman(item.line_total_toman)}</div>
            </div>
          ))}
        </div>
      </AccountCard>
    </div>
  )
}
