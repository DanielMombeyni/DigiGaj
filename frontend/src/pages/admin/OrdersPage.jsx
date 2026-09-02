import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { adminApi } from '@/services/api'
import { toman } from '@/utils/format'
import { AdminPageHeader, AdminTable } from '@/components/dashboard/AdminUI'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'در انتظار' },
  { value: 'paid', label: 'پرداخت‌شده' },
  { value: 'processing', label: 'آماده‌سازی' },
  { value: 'shipped', label: 'ارسال‌شده' },
  { value: 'delivered', label: 'تحویل' },
  { value: 'cancelled', label: 'لغو' },
  { value: 'refunded', label: 'مسترد' },
]

const statusCls = {
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

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="سفارش‌ها"
        description="پیگیری سفارش‌ها با کد پیگیری — وضعیت را از جدول تغییر دهید"
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
        <AdminTable columns={['کد پیگیری', 'مشتری', 'تماس', 'مبلغ', 'وضعیت']}>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-mist-100 hover:bg-mist-50/80">
              <td className="px-4 py-3 font-mono text-xs font-semibold tracking-wide text-sea-600">
                {o.tracking_code || o.order_number}
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
          ))}
        </AdminTable>
      )}
    </div>
  )
}
