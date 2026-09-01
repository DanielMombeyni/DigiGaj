import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { accountApi } from '@/services/api'
import { AccountCard, EmptyState } from '@/components/account/AccountUI'
import { TICKET_STATUS } from '@/config/account'
import { faDigits } from '@/utils/format'

export default function AccountTicketsPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ subject: '', message: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = () =>
    accountApi.tickets
      .list()
      .then((r) => setTickets(r.data.results || r.data))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { data } = await accountApi.tickets.create(form)
      setForm({ subject: '', message: '' })
      setShowForm(false)
      setTickets((list) => [data, ...list])
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در ثبت تیکت')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <AccountCard
        title="تیکت‌های پشتیبانی"
        actions={
          <button
            type="button"
            className="btn-primary cursor-pointer text-xs"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'انصراف' : 'تیکت جدید'}
          </button>
        }
      >
        {showForm && (
          <form onSubmit={submit} className="mb-6 space-y-3 rounded-xl border border-mist-200 bg-mist-50/50 p-4">
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <label className="block">
              <span className="label">موضوع</span>
              <input
                className="input"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
              />
            </label>
            <label className="block">
              <span className="label">پیام</span>
              <textarea
                className="input min-h-28 resize-y"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
              />
            </label>
            <button type="submit" className="btn-primary cursor-pointer text-xs" disabled={saving}>
              {saving ? 'در حال ارسال...' : 'ثبت تیکت'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-mist-100" />
            ))}
          </div>
        ) : tickets.length ? (
          <div className="divide-y divide-mist-100">
            {tickets.map((t) => {
              const st = TICKET_STATUS[t.status] || { label: t.status, cls: '' }
              return (
                <Link
                  key={t.id}
                  to={`/account/tickets/${t.ticket_number}`}
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-3 py-4 transition first:pt-0 last:pb-0 hover:opacity-80"
                >
                  <div>
                    <div className="font-medium text-ink-900">{t.subject}</div>
                    <div className="mt-1 font-mono text-xs text-ink-700/45" dir="ltr">
                      {t.ticket_number}
                    </div>
                  </div>
                  <div className="text-left text-xs">
                    <div className={`font-medium ${st.cls}`}>{st.label}</div>
                    <div className="mt-1 text-ink-700/45">
                      {faDigits(new Date(t.updated_at).toLocaleDateString('fa-IR'))}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <EmptyState message="تیکتی ثبت نشده است. برای تماس با پشتیبانی تیکت جدید بسازید." />
        )}
      </AccountCard>
    </div>
  )
}
