import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '@/services/api'
import { toman, faDigits } from '@/utils/format'
import { AdminPageHeader, AdminStatCard, AdminCard } from '@/components/dashboard/AdminUI'
import { PANEL_BASE } from '@/config/panel'

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

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
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
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

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <AdminCard title="میانبرهای سریع">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              [`${PANEL_BASE}/storefront`, 'صفحات فروشگاه'],
              [`${PANEL_BASE}/orders`, 'سفارش‌ها'],
              [`${PANEL_BASE}/tickets`, 'پشتیبانی'],
              [`${PANEL_BASE}/transactions`, 'تراکنش‌ها'],
              [`${PANEL_BASE}/settings`, 'تنظیمات فروشگاه'],
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
