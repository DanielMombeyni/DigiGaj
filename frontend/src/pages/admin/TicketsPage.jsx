import { useEffect, useMemo, useState } from 'react'
import { Headphones } from 'lucide-react'
import { adminApi } from '@/services/api'
import { useConfirm } from '@/components/common/ConfirmProvider'
import { AdminPageHeader, AdminTable, AdminDeleteButton } from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'
import { faDigits } from '@/utils/format'

const STATUS = {
  open: { label: 'باز', cls: 'bg-amber-50 text-amber-700' },
  in_progress: { label: 'در حال بررسی', cls: 'bg-sea-500/10 text-sea-600' },
  answered: { label: 'پاسخ‌داده‌شده', cls: 'bg-emerald-50 text-emerald-700' },
  closed: { label: 'بسته', cls: 'bg-mist-100 text-ink-700/50' },
}

const PRIORITY = {
  low: 'کم',
  normal: 'عادی',
  high: 'بالا',
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fa-IR')
  } catch {
    return iso
  }
}

export default function AdminTicketsPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [reply, setReply] = useState('')
  const [status, setStatus] = useState('answered')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = filter ? { status: filter } : {}
      const { data } = await adminApi.tickets.list(params)
      setItems(data.results || data)
    } catch {
      setError('خطا در بارگذاری تیکت‌ها')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filter])

  const openCounts = useMemo(
    () => items.filter((t) => t.status !== 'closed').length,
    [items],
  )

  const openTicket = async (row) => {
    setBusy(true)
    setError('')
    try {
      const { data } = await adminApi.tickets.get(row.ticket_number)
      setDetail(data)
      setReply('')
      setStatus(data.status === 'closed' ? 'closed' : 'answered')
    } catch {
      setError('خطا در باز کردن تیکت')
    } finally {
      setBusy(false)
    }
  }

  const closeDetail = () => {
    if (busy) return
    setDetail(null)
    setReply('')
  }

  const sendReply = async (e) => {
    e.preventDefault()
    if (!detail || !reply.trim()) return
    setBusy(true)
    setError('')
    try {
      const { data } = await adminApi.tickets.reply(detail.ticket_number, {
        body: reply.trim(),
        status,
      })
      setDetail(data)
      setReply('')
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در ارسال پاسخ')
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (next) => {
    if (!detail) return
    setBusy(true)
    try {
      const { data } = await adminApi.tickets.update(detail.ticket_number, { status: next })
      setDetail(data)
      setStatus(next)
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در تغییر وضعیت')
    } finally {
      setBusy(false)
    }
  }

  const removeTicket = async (row) => {
    const ok = await confirm({
      title: 'حذف تیکت',
      description: `آیا از حذف تیکت «${row.ticket_number}» مطمئن هستید؟`,
      confirmLabel: 'حذف تیکت',
    })
    if (!ok) return
    await adminApi.tickets.remove(row.ticket_number)
    if (detail?.ticket_number === row.ticket_number) setDetail(null)
    load()
  }

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="تیکت‌ها و پشتیبانی"
        description="بررسی پیام‌های مشتریان و پاسخ پشتیبانی"
        actions={
          <div className="flex items-center gap-2 text-xs text-ink-700/50">
            <Headphones className="h-4 w-4" strokeWidth={1.8} />
            باز / فعال: {faDigits(openCounts)}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[
          ['', 'همه'],
          ['open', 'باز'],
          ['in_progress', 'در حال بررسی'],
          ['answered', 'پاسخ‌داده‌شده'],
          ['closed', 'بسته'],
        ].map(([value, label]) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => setFilter(value)}
            className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              filter === value
                ? 'bg-ink-950 text-white'
                : 'border border-mist-200 bg-white text-ink-700/60 hover:bg-mist-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
      ) : (
        <AdminTable columns={['شماره', 'موضوع', 'مشتری', 'وضعیت', 'اولویت', 'به‌روزرسانی', '']}>
          {items.map((t) => {
            const st = STATUS[t.status] || STATUS.open
            return (
              <tr key={t.id} className="border-t border-mist-100 transition hover:bg-mist-50/80">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="cursor-pointer font-mono text-xs text-sea-600 hover:text-copper-600"
                    onClick={() => openTicket(t)}
                  >
                    {t.ticket_number}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="cursor-pointer text-right font-medium text-ink-900 hover:text-copper-600"
                    onClick={() => openTicket(t)}
                  >
                    {t.subject}
                  </button>
                  <div className="text-[11px] text-ink-700/40">
                    {faDigits(t.messages_count || 0)} پیام
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{t.full_name}</div>
                  <div className="text-xs text-ink-700/40">{t.phone || t.email || '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-lg px-2 py-1 text-xs ${st.cls}`}>{st.label}</span>
                </td>
                <td className="px-4 py-3 text-xs">{PRIORITY[t.priority] || t.priority}</td>
                <td className="px-4 py-3 text-xs text-ink-700/50">{formatWhen(t.updated_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <AdminDeleteButton onClick={() => removeTicket(t)} />
                  </div>
                </td>
              </tr>
            )
          })}
        </AdminTable>
      )}

      <AdminModal
        open={!!detail}
        onClose={closeDetail}
        title={detail ? detail.subject : ''}
        description={
          detail
            ? `${detail.ticket_number} — ${detail.full_name}${detail.phone ? ` · ${detail.phone}` : ''}${detail.email ? ` · ${detail.email}` : ''}`
            : ''
        }
        size="lg"
        footer={
          <>
            <ModalCancelButton onClick={closeDetail} />
            <ModalSubmitButton form="ticket-reply-form" loading={busy}>
              ارسال پاسخ
            </ModalSubmitButton>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-700/45">وضعیت:</span>
              {Object.entries(STATUS).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => changeStatus(key)}
                  className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs transition disabled:opacity-50 ${
                    detail.status === key ? meta.cls + ' ring-1 ring-current/20' : 'bg-mist-50 text-ink-700/45'
                  }`}
                >
                  {meta.label}
                </button>
              ))}
            </div>

            <div className="max-h-[40vh] space-y-3 overflow-y-auto rounded-xl border border-mist-100 bg-mist-50/50 p-3">
              {(detail.messages || []).map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl px-3 py-2.5 text-sm leading-7 ${
                    m.is_staff_reply
                      ? 'mr-6 bg-white border border-mist-200'
                      : 'ml-6 bg-copper-500/10 border border-copper-400/20'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-ink-700/40">
                    <span>{m.author_name}</span>
                    <span>{formatWhen(m.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-ink-900">{m.body}</p>
                </div>
              ))}
            </div>

            <form id="ticket-reply-form" onSubmit={sendReply} className="space-y-3">
              <label className="block">
                <span className="label">پاسخ پشتیبانی</span>
                <textarea
                  className="input min-h-[100px]"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="متن پاسخ را بنویسید..."
                  required
                />
              </label>
              <label className="block max-w-xs">
                <span className="label">وضعیت بعد از پاسخ</span>
                <select
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="answered">پاسخ‌داده‌شده</option>
                  <option value="in_progress">در حال بررسی</option>
                  <option value="closed">بسته</option>
                  <option value="open">باز</option>
                </select>
              </label>
            </form>
          </div>
        )}
      </AdminModal>
    </div>
  )
}
