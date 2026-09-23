import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '@/services/api'
import { toman, faDigits } from '@/utils/format'
import { AdminPageHeader, AdminStatCard, AdminCard } from '@/components/dashboard/AdminUI'
import { PANEL_BASE } from '@/config/panel'

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [percent, setPercent] = useState('')
  const [priceBusy, setPriceBusy] = useState(false)
  const [priceMsg, setPriceMsg] = useState('')
  const [priceErr, setPriceErr] = useState('')

  useEffect(() => {
    adminApi
      .dashboard()
      .then((r) => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    { label: 'محصولات فعال', value: data?.active_products, accent: 'sea', hint: 'در کاتالوگ عمومی' },
    { label: 'سفارش در انتظار', value: data?.orders_pending, accent: 'amber', hint: 'نیاز به پیگیری' },
    { label: 'پرداخت‌شده این ماه', value: data?.orders_paid_month, accent: 'emerald', hint: 'سفارش‌های موفق' },
    {
      label: 'درآمد ماه',
      value: data ? toman(data.revenue_month) : '—',
      accent: 'copper',
      hint: 'از اسناد حسابداری',
    },
    { label: 'موجودی کم', value: data?.low_stock, accent: 'ink', hint: '۳ عدد یا کمتر' },
    {
      label: 'کارت‌به‌کارت معلق',
      value: data?.pending_card_payments,
      accent: 'amber',
      hint: 'منتظر تأیید ادمین',
    },
    {
      label: 'تیکت‌های باز',
      value: data?.open_tickets,
      accent: 'sea',
      hint: 'نیاز به پاسخ پشتیبانی',
    },
  ]

  const applyBulkPrice = async (e) => {
    e.preventDefault()
    setPriceMsg('')
    setPriceErr('')
    const n = Number(String(percent).replace(/[^\d.-]/g, ''))
    if (!Number.isFinite(n) || n === 0) {
      setPriceErr('یک درصد غیرصفر وارد کنید (مثلاً ۱۰ یا ۵-)')
      return
    }
    setPriceBusy(true)
    try {
      const { data: res } = await adminApi.products.bulkPriceAdjust(n)
      setPriceMsg(
        `اعمال شد: ${faDigits(res.updated_products || 0)} محصول و ${faDigits(res.updated_variants || 0)} تنوع`,
      )
      setPercent('')
    } catch (err) {
      setPriceErr(err.response?.data?.detail || err.message || 'خطا در اعمال درصد')
    } finally {
      setPriceBusy(false)
    }
  }

  return (
    <div className="animate-rise">
      <AdminPageHeader
        title="داشبورد"
        description="نمای کلی وضعیت فروشگاه در یک نگاه"
        actions={
          <>
            <Link to={`${PANEL_BASE}/products`} className="btn-dark cursor-pointer text-xs">
              افزودن محصول
            </Link>
            <Link to={`${PANEL_BASE}/gateways`} className="btn-primary cursor-pointer text-xs">
              مدیریت درگاه
            </Link>
          </>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <AdminStatCard
              key={c.label}
              label={c.label}
              value={typeof c.value === 'number' ? faDigits(c.value) : c.value}
              hint={c.hint}
              accent={c.accent}
            />
          ))}
        </div>
      )}

      <AdminCard title="تغییر گروهی قیمت‌ها" className="mt-8">
        <p className="text-sm leading-7 text-ink-700/65">
          درصد را وارد کنید تا به قیمت همه محصولاتی که قیمت ثابت دارند اضافه یا از آن‌ها کم شود.
          محصولات «قیمت با تماس» تغییر نمی‌کنند.
        </p>
        <form onSubmit={applyBulkPrice} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block min-w-[10rem] flex-1">
            <span className="label">درصد تغییر</span>
            <input
              className="input"
              type="number"
              step="any"
              name="percent"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="مثلاً ۱۰ یا ۵-"
              disabled={priceBusy}
            />
          </label>
          <button
            type="submit"
            className="btn-primary min-h-11 cursor-pointer px-6 disabled:opacity-50"
            disabled={priceBusy}
          >
            {priceBusy ? 'در حال اعمال...' : 'اعمال'}
          </button>
        </form>
        {priceMsg ? <p className="mt-3 text-sm text-emerald-700">{priceMsg}</p> : null}
        {priceErr ? <p className="mt-3 text-sm text-red-600">{priceErr}</p> : null}
      </AdminCard>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <AdminCard title="میانبرهای سریع">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              [`${PANEL_BASE}/storefront`, 'صفحات فروشگاه'],
              [`${PANEL_BASE}/orders`, 'سفارش‌ها'],
              [`${PANEL_BASE}/tickets`, 'پشتیبانی'],
              [`${PANEL_BASE}/transactions`, 'تراکنش‌ها'],
              [`${PANEL_BASE}/settings`, 'تنظیمات فروشگاه'],
              [`${PANEL_BASE}/emails`, 'ایمیل‌ها'],
            ].map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className="cursor-pointer rounded-xl border border-mist-200 px-4 py-3 text-sm transition hover:border-copper-400/40 hover:bg-mist-50"
              >
                {label}
              </Link>
            ))}
          </div>
        </AdminCard>
      </div>

      <AdminCard title="نکته عملیاتی" className="mt-4">
        <p className="text-sm leading-7 text-ink-700/65">
          برای فعال‌سازی درگاه، ابتدا credentials را کامل کنید سپس وضعیت وب/اپ را روشن کنید.
          تراکنش‌های کارت‌به‌کارت تا تأیید دستی در بخش تراکنش‌ها معلق می‌مانند.
        </p>
      </AdminCard>
    </div>
  )
}
