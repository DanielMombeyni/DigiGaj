import { useEffect, useState } from 'react'
import { adminApi } from '@/services/api'
import { toman } from '@/utils/format'
import { AdminPageHeader, AdminTable } from '@/components/dashboard/AdminUI'

export default function AdminTransactionsPage() {
  const [items, setItems] = useState([])
  const [msg, setMsg] = useState('')

  const load = () => adminApi.gateways.transactions().then((r) => setItems(r.data))
  useEffect(() => { load() }, [])

  const confirmCard = async (tracking) => {
    try {
      await adminApi.gateways.cardConfirm(tracking)
      setMsg(`تأیید شد: ${tracking}`)
      load()
    } catch (err) {
      setMsg(err.response?.data?.detail || 'خطا')
    }
  }

  return (
    <div className="animate-rise">
      <AdminPageHeader title="تراکنش‌ها" description="وضعیت پرداخت‌ها و تأیید کارت‌به‌کارت" />
      {msg && <p className="mb-4 rounded-xl bg-sea-500/10 px-3 py-2 text-sm text-sea-600">{msg}</p>}
      <AdminTable columns={['پیگیری', 'درگاه', 'مبلغ', 'وضعیت', '']}>
        {items.map((t) => (
          <tr key={t.id} className="border-t border-mist-100 hover:bg-mist-50/80">
            <td className="px-4 py-3 font-mono text-xs">{t.tracking_number}</td>
            <td className="px-4 py-3">{t.gateway}</td>
            <td className="px-4 py-3">{toman(t.amount)}</td>
            <td className="px-4 py-3">
              <span
                className={`rounded-lg px-2 py-1 text-xs ${
                  t.status === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : t.status === 'pending'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-red-50 text-red-600'
                }`}
              >
                {t.status}
              </span>
            </td>
            <td className="px-4 py-3">
              {t.gateway === 'card' && t.status === 'pending' && (
                <button
                  type="button"
                  className="cursor-pointer text-sm font-medium text-emerald-600 hover:text-emerald-700"
                  onClick={() => confirmCard(t.tracking_number)}
                >
                  تأیید کارت‌به‌کارت
                </button>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  )
}
