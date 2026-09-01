import { useEffect, useState } from 'react'
import { accountApi } from '@/services/api'
import { AccountCard, EmptyState } from '@/components/account/AccountUI'
import { TX_STATUS } from '@/config/account'
import { toman, faDigits } from '@/utils/format'

const GATEWAY_LABELS = {
  zarinpal: 'زرین‌پال',
  zibal: 'زیبال',
  payping: 'پی‌پینگ',
  card: 'کارت‌به‌کارت',
}

export default function AccountTransactionsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    accountApi.transactions
      .list()
      .then((r) => setItems(r.data.results || r.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AccountCard title="تراکنش‌های پرداخت">
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-mist-100" />
          ))}
        </div>
      ) : items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-right text-xs text-ink-700/50">
              <tr>
                <th className="pb-3 font-medium">کد پیگیری</th>
                <th className="pb-3 font-medium">سفارش</th>
                <th className="pb-3 font-medium">درگاه</th>
                <th className="pb-3 font-medium">وضعیت</th>
                <th className="pb-3 font-medium">مبلغ</th>
                <th className="pb-3 font-medium">تاریخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist-100">
              {items.map((tx) => {
                const st = TX_STATUS[tx.status] || { label: tx.status, cls: '' }
                return (
                  <tr key={tx.id}>
                    <td className="py-3 font-mono text-xs" dir="ltr">{tx.tracking_number}</td>
                    <td className="py-3">{tx.order_number || '—'}</td>
                    <td className="py-3">{GATEWAY_LABELS[tx.gateway] || tx.gateway}</td>
                    <td className={`py-3 font-medium ${st.cls}`}>{st.label}</td>
                    <td className="py-3 font-semibold text-copper-600">{toman(tx.amount)}</td>
                    <td className="py-3 text-xs text-ink-700/50">
                      {faDigits(new Date(tx.created_at).toLocaleDateString('fa-IR'))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="تراکنش پرداختی ثبت نشده است." />
      )}
    </AccountCard>
  )
}
