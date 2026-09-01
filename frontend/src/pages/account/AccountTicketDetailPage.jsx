import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { accountApi } from '@/services/api'
import { AccountCard } from '@/components/account/AccountUI'
import { TICKET_STATUS } from '@/config/account'
import { faDigits } from '@/utils/format'

export default function AccountTicketDetailPage() {
  const { number } = useParams()
  const [ticket, setTicket] = useState(null)
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () =>
    accountApi.tickets
      .get(number)
      .then((r) => setTicket(r.data))
      .catch(() => setTicket(null))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [number])

  const sendReply = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    setSaving(true)
    setError('')
    try {
      const { data } = await accountApi.tickets.reply(number, { body: reply.trim() })
      setTicket(data)
      setReply('')
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در ارسال پیام')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="h-48 animate-pulse rounded-2xl bg-mist-100" />

  if (!ticket) {
    return (
      <AccountCard title="تیکت یافت نشد">
        <Link to="/account/tickets" className="text-sm text-sea-600">بازگشت</Link>
      </AccountCard>
    )
  }

  const st = TICKET_STATUS[ticket.status] || { label: ticket.status, cls: '' }

  return (
    <div className="space-y-4">
      <Link to="/account/tickets" className="inline-flex text-sm text-sea-600 hover:text-copper-600">
        ← بازگشت به تیکت‌ها
      </Link>

      <AccountCard title={ticket.subject} actions={<span className={`text-sm font-medium ${st.cls}`}>{st.label}</span>}>
        <p className="mb-4 font-mono text-xs text-ink-700/45" dir="ltr">{ticket.ticket_number}</p>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto overscroll-contain rounded-xl border border-mist-100 bg-mist-50/40 p-3">
          {(ticket.messages || []).map((m) => (
            <div
              key={m.id}
              className={`rounded-xl px-3 py-2.5 text-sm ${
                m.is_staff_reply
                  ? 'ml-0 mr-8 bg-white border border-mist-200'
                  : 'ml-8 mr-0 bg-sea-500/10 border border-sea-500/20'
              }`}
            >
              <div className="mb-1 text-xs font-medium text-ink-700/50">
                {m.author_name} · {faDigits(new Date(m.created_at).toLocaleString('fa-IR'))}
              </div>
              <p className="leading-7 text-ink-800">{m.body}</p>
            </div>
          ))}
        </div>

        {ticket.status !== 'closed' && (
          <form onSubmit={sendReply} className="mt-4 space-y-3">
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <label className="block">
              <span className="label">پاسخ شما</span>
              <textarea
                className="input min-h-24 resize-y"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="پیام خود را بنویسید..."
              />
            </label>
            <button type="submit" className="btn-primary cursor-pointer text-xs" disabled={saving}>
              {saving ? 'در حال ارسال...' : 'ارسال پیام'}
            </button>
          </form>
        )}
      </AccountCard>
    </div>
  )
}
