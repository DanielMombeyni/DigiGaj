import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { paymentApi, shopApi } from '@/services/api'
import {
  AccountCard,
  OrderStatusBadge,
  OrderTrackingSteps,
} from '@/components/account/AccountUI'
import { toman, faDigits } from '@/utils/format'
import { PRICE_ON_REQUEST_LABEL } from '@/utils/pricing'

export default function AccountOrderDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [flash, setFlash] = useState(location.state?.flash || '')
  const [gateways, setGateways] = useState([])
  const [gateway, setGateway] = useState('')
  const [payBusy, setPayBusy] = useState(false)
  const [payError, setPayError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(false)
    shopApi
      .order(id)
      .then((r) => setOrder(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!order || order.status !== 'pending' || order.has_price_pending) return
    paymentApi
      .gateways('web')
      .then((r) => {
        const list = r.data?.gateways || r.data || []
        const arr = Array.isArray(list) ? list : []
        setGateways(arr)
        if (arr[0]?.provider_type) setGateway(arr[0].provider_type)
      })
      .catch(() => setGateways([]))
  }, [order])

  const pay = async () => {
    if (!gateway) {
      setPayError('درگاه پرداخت را انتخاب کنید')
      return
    }
    setPayBusy(true)
    setPayError('')
    try {
      const { data } = await shopApi.payOrder(id, { gateway, platform: 'web' })
      if (data.payment?.payment_url) {
        window.location.href = data.payment.payment_url
        return
      }
      if (data.payment?.extra?.card_number) {
        window.location.href = `/payment/result?status=pending&tracking=${data.payment.tracking_number}`
        return
      }
      setPayError('پاسخ پرداخت نامعتبر بود')
    } catch (err) {
      setPayError(err.response?.data?.detail || 'خطا در شروع پرداخت')
    } finally {
      setPayBusy(false)
    }
  }

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

  const canPay = order.status === 'pending' && !order.has_price_pending

  return (
    <div className="space-y-4">
      <Link to="/account/orders" className="inline-flex text-sm text-sea-600 hover:text-copper-600">
        ← بازگشت به سفارش‌ها
      </Link>

      {flash && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {flash}
          <button
            type="button"
            className="ms-2 cursor-pointer text-xs underline"
            onClick={() => setFlash('')}
          >
            بستن
          </button>
        </p>
      )}

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
              {order.postal_code && (
                <>
                  <br />
                  کد پستی: {order.postal_code}
                </>
              )}
            </p>
          </div>
          <div className="rounded-xl bg-mist-50 p-4 text-sm">
            <div className="font-semibold text-ink-900">مبلغ</div>
            <dl className="mt-2 space-y-1 text-ink-700/70">
              <div className="flex justify-between">
                <dt>جمع</dt>
                <dd>{toman(order.subtotal_toman)}</dd>
              </div>
              {order.discount_toman > 0 && (
                <div className="flex justify-between">
                  <dt>تخفیف</dt>
                  <dd>-{toman(order.discount_toman)}</dd>
                </div>
              )}
              {order.shipping_toman > 0 && (
                <div className="flex justify-between">
                  <dt>ارسال</dt>
                  <dd>{toman(order.shipping_toman)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-mist-200 pt-2 font-semibold text-ink-900">
                <dt>کل</dt>
                <dd className="text-copper-600">{toman(order.total_toman)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {canPay && (
          <div className="mt-6 rounded-xl border border-mist-200 bg-white p-4">
            <div className="text-sm font-semibold text-ink-900">پرداخت سفارش</div>
            {gateways.length === 0 ? (
              <p className="mt-2 text-xs text-ink-700/50">درگاه پرداخت در دسترس نیست.</p>
            ) : (
              <div className="mt-3 space-y-3">
                <select
                  className="input cursor-pointer"
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value)}
                >
                  {gateways.map((g) => (
                    <option key={g.provider_type} value={g.provider_type}>
                      {g.title || g.provider_type}
                    </option>
                  ))}
                </select>
                {payError && <p className="text-xs text-red-600">{payError}</p>}
                <button
                  type="button"
                  className="btn-primary cursor-pointer"
                  disabled={payBusy}
                  onClick={pay}
                >
                  {payBusy ? 'در حال انتقال...' : `پرداخت ${toman(order.total_toman)}`}
                </button>
              </div>
            )}
          </div>
        )}
      </AccountCard>

      <AccountCard title="اقلام سفارش">
        <div className="divide-y divide-mist-100">
          {(order.items || []).map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <div className="font-medium text-ink-900">{item.product_name}</div>
                {item.variant_label && (
                  <div className="text-xs text-ink-700/50">{item.variant_label}</div>
                )}
                <div className="text-xs text-ink-700/45">تعداد: {item.quantity}</div>
              </div>
              <div className="text-end font-semibold text-ink-900">
                {item.price_pending ? (
                  <span className="text-xs font-medium text-violet-700">{PRICE_ON_REQUEST_LABEL}</span>
                ) : (
                  toman(item.line_total_toman)
                )}
              </div>
            </div>
          ))}
        </div>
      </AccountCard>
    </div>
  )
}
