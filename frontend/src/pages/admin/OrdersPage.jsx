import { useEffect, useState, Fragment } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { adminApi } from '@/services/api'
import { toman } from '@/utils/format'
import { AdminPageHeader, AdminTable } from '@/components/dashboard/AdminUI'

const STATUS_OPTIONS = [
  { value: 'awaiting_price', label: 'در انتظار قیمت' },
  { value: 'pending', label: 'در انتظار پرداخت' },
  { value: 'paid', label: 'پرداخت‌شده' },
  { value: 'processing', label: 'آماده‌سازی' },
  { value: 'shipped', label: 'ارسال' },
  { value: 'delivered', label: 'تحویل' },
  { value: 'cancelled', label: 'لغو' },
  { value: 'refunded', label: 'مسترد' },
]

const statusCls = {
  awaiting_price: 'border-violet-200 bg-violet-50 text-violet-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  processing: 'border-sea-500/30 bg-sea-500/10 text-sea-600',
  shipped: 'border-sea-500/30 bg-sea-500/10 text-sea-600',
  delivered: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-mist-200 bg-mist-100 text-ink-700/50',
  refunded: 'border-red-200 bg-red-50 text-red-600',
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [rowBusy, setRowBusy] = useState(null)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [priceDrafts, setPriceDrafts] = useState({})
  const [priceBusy, setPriceBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const load = (params = {}) => {
    setLoading(true)
    setError('')
    return adminApi.orders
      .list(params)
      .then((r) => setOrders(r.data.results || r.data))
      .catch(() => setError('خطا در بارگذاری سفارش‌ها'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const params = {}
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter
    load(params)
  }, [search, statusFilter])

  const changeStatus = async (order, next) => {
    if (next === order.status || rowBusy) return
    setError('')
    setRowBusy(order.id)
    const prev = order.status
    setOrders((list) =>
      list.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
    )
    try {
      const { data } = await adminApi.orders.setStatus(order.id, next)
      setOrders((list) =>
        list.map((o) => (o.id === order.id ? { ...o, ...data } : o)),
      )
    } catch (err) {
      setOrders((list) =>
        list.map((o) => (o.id === order.id ? { ...o, status: prev } : o)),
      )
      setError(err.response?.data?.detail || 'خطا در تغییر وضعیت')
    } finally {
      setRowBusy(null)
    }
  }

  const toggleExpand = (order) => {
    if (expandedId === order.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(order.id)
    const drafts = {}
    for (const item of order.items || []) {
      drafts[item.id] = item.price_pending ? '' : String(item.unit_price_toman || '')
    }
    setPriceDrafts(drafts)
  }

  const savePrices = async (order) => {
    const pendingItems = (order.items || []).filter((i) => i.price_pending)
    if (!pendingItems.length) return
    const items = []
    for (const item of pendingItems) {
      const raw = priceDrafts[item.id]
      const unit = Number(String(raw || '').replace(/[^\d]/g, ''))
      if (!unit || unit < 1) {
        setError(`قیمت «${item.product_name}» را وارد کنید`)
        return
      }
      items.push({ id: item.id, unit_price_toman: unit })
    }
    setPriceBusy(true)
    setError('')
    try {
      const { data } = await adminApi.orders.setItemPrices(order.id, items)
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, ...data } : o)))
      const drafts = {}
      for (const item of data.items || []) {
        drafts[item.id] = String(item.unit_price_toman || '')
      }
      setPriceDrafts(drafts)
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در ذخیره قیمت')
    } finally {
      setPriceBusy(false)
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="سفارش‌ها"
        description="پیگیری سفارش‌ها — برای اقلام بدون قیمت، قیمت را از جزئیات سفارش اعلام کنید"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-700/35"
            strokeWidth={1.8}
          />
          <input
            className="input pe-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی کد پیگیری، نام یا شماره تماس..."
            aria-label="جستجوی سفارش"
          />
        </div>
        <select
          className="input w-full cursor-pointer sm:w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="فیلتر وضعیت"
        >
          <option value="">همه وضعیت‌ها</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <AdminTable columns={['', 'کد پیگیری', 'مشتری', 'تماس', 'مبلغ', 'وضعیت']}>
          {orders.map((o) => {
            const open = expandedId === o.id
            const pendingCount = (o.items || []).filter((i) => i.price_pending).length
            return (
              <Fragment key={o.id}>
                <tr className="border-t border-mist-100 hover:bg-mist-50/80">
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-700/50 transition hover:bg-mist-100 hover:text-ink-900"
                      onClick={() => toggleExpand(o)}
                      aria-expanded={open}
                      aria-label="جزئیات سفارش"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`}
                        strokeWidth={2}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold tracking-wide text-sea-600">
                    {o.tracking_code || o.order_number}
                    {pendingCount > 0 && (
                      <span className="ms-2 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                        بدون قیمت
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{o.full_name}</td>
                  <td className="px-4 py-3 text-xs text-ink-700/55">{o.phone || '—'}</td>
                  <td className="px-4 py-3">{toman(o.total_toman)}</td>
                  <td className="px-4 py-3">
                    <select
                      className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-medium outline-none transition disabled:cursor-wait disabled:opacity-60 ${
                        statusCls[o.status] || 'border-mist-200 bg-mist-50 text-ink-700'
                      }`}
                      value={o.status}
                      disabled={rowBusy === o.id}
                      onChange={(e) => changeStatus(o, e.target.value)}
                      aria-label={`وضعیت سفارش ${o.order_number}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
                {open && (
                  <tr className="border-t border-mist-100 bg-mist-50/40">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="space-y-3">
                        <p className="text-xs text-ink-700/50">
                          {[o.province, o.city].filter(Boolean).join('، ')}
                          {(o.province || o.city) && ' — '}
                          {o.address}
                        </p>
                        <ul className="divide-y divide-mist-200 overflow-hidden rounded-xl border border-mist-200 bg-white">
                          {(o.items || []).map((item) => (
                            <li
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-ink-900">{item.product_name}</div>
                                {item.variant_label ? (
                                  <div className="text-xs text-ink-700/45">{item.variant_label}</div>
                                ) : null}
                                <div className="text-xs text-ink-700/40">× {item.quantity}</div>
                              </div>
                              {item.price_pending ? (
                                <label className="flex items-center gap-2 text-xs">
                                  <span className="text-violet-700">قیمت واحد</span>
                                  <input
                                    className="input w-36 py-1.5 text-sm"
                                    type="number"
                                    min="1"
                                    placeholder="تومان"
                                    value={priceDrafts[item.id] ?? ''}
                                    onChange={(e) =>
                                      setPriceDrafts((d) => ({ ...d, [item.id]: e.target.value }))
                                    }
                                  />
                                </label>
                              ) : (
                                <div className="text-sm font-semibold text-ink-900">
                                  {toman(item.line_total_toman)}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                        {pendingCount > 0 && (
                          <button
                            type="button"
                            className="btn-primary cursor-pointer text-xs"
                            disabled={priceBusy}
                            onClick={() => savePrices(o)}
                          >
                            {priceBusy ? 'در حال ذخیره...' : 'اعلام قیمت و فعال‌سازی پرداخت'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </AdminTable>
      )}
    </div>
  )
}
