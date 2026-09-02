import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { adminApi } from '@/services/api'
import { useConfirm } from '@/components/common/ConfirmProvider'
import { AdminPageHeader, AdminTable, AdminEditButton, AdminDeleteButton } from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'
import { PANEL_BASE } from '@/config/panel'

function emptyForm(event = 'order_created') {
  return {
    name: '',
    event,
    trigger_status: '',
    subject: '',
    body_html: '',
    is_enabled: true,
  }
}

function firstError(data) {
  if (!data) return 'خطا'
  if (typeof data !== 'object') return String(data)
  if (data.detail) return Array.isArray(data.detail) ? data.detail[0] : data.detail
  const first = Object.values(data)[0]
  return Array.isArray(first) ? first[0] : first || 'خطا'
}

function insertAtCursor(el, value, token, setter) {
  if (!el) {
    setter(`${value}${token}`)
    return
  }
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  const next = `${value.slice(0, start)}${token}${value.slice(end)}`
  setter(next)
  requestAnimationFrame(() => {
    el.focus()
    const pos = start + token.length
    el.setSelectionRange(pos, pos)
  })
}

export default function AdminEmailsPage() {
  const confirm = useConfirm()
  const subjectRef = useRef(null)
  const bodyRef = useRef(null)
  const [items, setItems] = useState([])
  const [catalog, setCatalog] = useState({ events: [], placeholders: [], smtp_ready: false })
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [busy, setBusy] = useState(false)
  const [testRow, setTestRow] = useState(null)
  const [testTo, setTestTo] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, catRes] = await Promise.all([
        adminApi.emailTemplates.list(),
        adminApi.emailTemplates.catalog(),
      ])
      setItems(listRes.data || [])
      setCatalog(catRes.data || { events: [], placeholders: [], smtp_ready: false })
    } catch {
      setError('خطا در بارگذاری قالب‌های ایمیل')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const eventsByKey = useMemo(() => {
    const map = {}
    for (const ev of catalog.events || []) map[ev.key] = ev
    return map
  }, [catalog.events])

  const selectedEvent = eventsByKey[form.event]
  const rows = filter ? items.filter((row) => row.event === filter) : items

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(filter || 'order_created'))
    setError('')
    setOk('')
    setOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name || '',
      event: row.event,
      trigger_status: row.trigger_status || '',
      subject: row.subject || '',
      body_html: row.body_html || '',
      is_enabled: row.is_enabled !== false,
    })
    setError('')
    setOk('')
    setOpen(true)
  }

  const close = () => {
    if (!busy) setOpen(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        event: form.event,
        trigger_status: form.trigger_status,
        subject: form.subject.trim(),
        body_html: form.body_html.trim(),
        is_enabled: form.is_enabled,
      }
      if (editing) {
        await adminApi.emailTemplates.update(editing.id, payload)
      } else {
        await adminApi.emailTemplates.create(payload)
      }
      setOpen(false)
      setOk(editing ? 'قالب ذخیره شد.' : 'قالب اضافه شد.')
      await load()
    } catch (err) {
      setError(firstError(err.response?.data))
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (row) => {
    setError('')
    try {
      await adminApi.emailTemplates.update(row.id, { is_enabled: !row.is_enabled })
      await load()
    } catch (err) {
      setError(firstError(err.response?.data))
    }
  }

  const remove = async (row) => {
    const okConfirm = await confirm({
      title: 'حذف قالب ایمیل',
      description: `آیا از حذف «${row.name}» مطمئن هستید؟`,
      confirmLabel: 'حذف قالب',
    })
    if (!okConfirm) return
    try {
      await adminApi.emailTemplates.remove(row.id)
      setOk('قالب حذف شد.')
      await load()
    } catch (err) {
      setError(firstError(err.response?.data))
    }
  }

  const sendTest = async (e) => {
    e.preventDefault()
    if (!testRow) return
    setBusy(true)
    setError('')
    try {
      await adminApi.emailTemplates.test(testRow.id, testTo.trim())
      setOk(`ایمیل آزمایشی «${testRow.name}» ارسال شد.`)
      setTestRow(null)
      setTestTo('')
    } catch (err) {
      setError(firstError(err.response?.data))
    } finally {
      setBusy(false)
    }
  }

  const token = (key) => `{{${key}}}`

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="ایمیل‌ها"
        description="قالب‌های ایمیل سفارش، تیکت و ثبت‌نام را بسازید و فعال یا خاموش کنید."
        actions={
          <button type="button" className="btn-primary cursor-pointer" onClick={openCreate}>
            افزودن نوع ایمیل
          </button>
        }
      />

      {!catalog.smtp_ready && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ارسال SMTP هنوز آماده نیست.{' '}
          <Link to={`${PANEL_BASE}/settings`} className="font-medium underline underline-offset-2">
            تنظیمات ایمیل
          </Link>{' '}
          را کامل و فعال کنید.
        </p>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-700/70">
          <span>نوع رویداد</span>
          <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">همه</option>
            {(catalog.events || []).map((ev) => (
              <option key={ev.key} value={ev.key}>
                {ev.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <AdminTable columns={['قالب', 'رویداد', 'وضعیت', '']} emptyMessage="قالبی وجود ندارد">
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-mist-100 hover:bg-mist-50/80">
              <td className="px-4 py-3">
                <div className="font-medium text-ink-900">{row.name}</div>
                <div className="mt-0.5 text-xs text-ink-700/40">{row.subject}</div>
              </td>
              <td className="px-4 py-3 text-sm text-ink-700/70">
                {row.event_label}
                {row.trigger_status ? (
                  <span className="mt-1 block text-xs text-ink-700/40">فقط وضعیت {row.trigger_status}</span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggle(row)}
                  className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    row.is_enabled
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-mist-100 text-ink-700/50 hover:bg-mist-200'
                  }`}
                >
                  {row.is_enabled ? 'فعال' : 'خاموش'}
                </button>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    title="ارسال آزمایشی"
                    aria-label="ارسال آزمایشی"
                    onClick={() => {
                      setTestRow(row)
                      setTestTo('')
                      setError('')
                    }}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-copper-600 transition hover:bg-copper-500/10"
                  >
                    <Mail className="h-4 w-4" strokeWidth={1.85} />
                  </button>
                  <AdminEditButton onClick={() => openEdit(row)} />
                  {!row.is_builtin && <AdminDeleteButton onClick={() => remove(row)} />}
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}

      <AdminModal
        open={open}
        onClose={close}
        size="lg"
        title={editing ? 'ویرایش قالب ایمیل' : 'افزودن نوع ایمیل'}
        description="با {{نام_متغیر}} مقدار واقعی سفارش یا مشتری جایگزین می‌شود."
        footer={
          <>
            <ModalCancelButton onClick={close} disabled={busy} />
            <ModalSubmitButton form="email-template-form" loading={busy}>
              {editing ? 'ذخیره' : 'افزودن'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="email-template-form" onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <label className="block">
            <span className="label">نام قالب</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="مثلاً اطلاع ارسال سفارش"
            />
          </label>
          <label className="block">
            <span className="label">رویداد</span>
            <select
              className="input"
              value={form.event}
              disabled={!!editing?.is_builtin}
              onChange={(e) => setForm({ ...form, event: e.target.value, trigger_status: '' })}
            >
              {(catalog.events || []).map((ev) => (
                <option key={ev.key} value={ev.key}>
                  {ev.label}
                </option>
              ))}
            </select>
          </label>
          {selectedEvent?.has_status_filter && (
            <label className="block">
              <span className="label">فقط برای این وضعیت (اختیاری)</span>
              <select
                className="input"
                value={form.trigger_status}
                onChange={(e) => setForm({ ...form, trigger_status: e.target.value })}
              >
                <option value="">همه وضعیت‌ها</option>
                {(selectedEvent.statuses || []).map((st) => (
                  <option key={st.key} value={st.key}>
                    {st.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_enabled}
              onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
            />
            فعال باشد
          </label>
          <div>
            <span className="label">متغیرها</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(catalog.placeholders || []).map((ph) => (
                <button
                  key={ph.key}
                  type="button"
                  className="cursor-pointer rounded-lg border border-mist-200 bg-mist-50 px-2 py-1 text-xs text-ink-700/70 transition hover:border-copper-400/40 hover:text-copper-700"
                  onClick={() => {
                    const intoSubject = document.activeElement === subjectRef.current
                    if (intoSubject) {
                      insertAtCursor(subjectRef.current, form.subject, token(ph.key), (next) =>
                        setForm((prev) => ({ ...prev, subject: next })),
                      )
                    } else {
                      insertAtCursor(bodyRef.current, form.body_html, token(ph.key), (next) =>
                        setForm((prev) => ({ ...prev, body_html: next })),
                      )
                    }
                  }}
                >
                  {ph.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="label">موضوع</span>
            <input
              ref={subjectRef}
              className="input"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required
              placeholder="سفارش {{order_number}} ثبت شد"
            />
          </label>
          <label className="block">
            <span className="label">متن ایمیل (HTML)</span>
            <textarea
              ref={bodyRef}
              className="input min-h-[180px] font-mono text-xs"
              value={form.body_html}
              onChange={(e) => setForm({ ...form, body_html: e.target.value })}
              required
            />
          </label>
        </form>
      </AdminModal>

      <AdminModal
        open={!!testRow}
        onClose={() => !busy && setTestRow(null)}
        title="ارسال آزمایشی"
        description={testRow ? `قالب «${testRow.name}» با داده‌های نمونه ارسال می‌شود.` : ''}
        footer={
          <>
            <ModalCancelButton onClick={() => setTestRow(null)} disabled={busy} />
            <ModalSubmitButton form="email-test-form" loading={busy}>
              ارسال
            </ModalSubmitButton>
          </>
        }
      >
        <form id="email-test-form" onSubmit={sendTest} className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <label className="block">
            <span className="label">ایمیل گیرنده</span>
            <input
              className="input"
              type="email"
              dir="ltr"
              required
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              autoComplete="email"
            />
          </label>
        </form>
      </AdminModal>
    </div>
  )
}
