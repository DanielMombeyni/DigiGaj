import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, RefreshCw, Send, Settings2, FileText } from 'lucide-react'
import { adminApi } from '@/services/api'
import { useConfirm } from '@/components/common/ConfirmProvider'
import {
  AdminPageHeader,
  AdminTable,
  AdminEditButton,
  AdminDeleteButton,
} from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'
import { PANEL_BASE } from '@/config/panel'
import { faDigits } from '@/utils/format'

function emptyForm(mode = 'text') {
  return {
    name: '',
    mode,
    body_text: '',
    pattern_id: '',
    param_keys: '',
    sample_params: {},
    notes: '',
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

function formatBalance(balance) {
  if (balance == null) return null
  if (typeof balance === 'number' || typeof balance === 'string') return String(balance)
  if (typeof balance === 'object') {
    for (const key of ['credit', 'balance', 'amount', 'value', 'remaining']) {
      if (balance[key] != null) return String(balance[key])
    }
    try {
      return JSON.stringify(balance)
    } catch {
      return '—'
    }
  }
  return '—'
}

function parsePhones(raw) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/** Rough SMS page count for Persian/UCS-2 (70 then 67). */
function smsSegments(text) {
  const len = [...String(text || '')].length
  if (len <= 0) return 0
  if (len <= 70) return 1
  return Math.ceil(len / 67)
}

function parseParamKeys(raw) {
  if (Array.isArray(raw)) return raw.map((k) => String(k).trim()).filter(Boolean)
  return String(raw || '')
    .split(/[,|\s]+/)
    .map((k) => k.trim())
    .filter(Boolean)
}

function ParamFields({ keys, values, onChange }) {
  if (!keys.length) {
    return (
      <p className="text-xs text-ink-700/45">
        پارامتری تعریف نشده. در قالب، نام پارامترها را وارد کنید یا شناسه الگو را مستقیم بفرستید.
      </p>
    )
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {keys.map((key) => (
        <label key={key} className="block">
          <span className="label font-mono text-[11px]">{key}</span>
          <input
            className="input"
            dir="ltr"
            value={values[key] ?? ''}
            onChange={(e) => onChange({ ...values, [key]: e.target.value })}
          />
        </label>
      ))}
    </div>
  )
}

export default function AdminSmsPage() {
  const confirm = useConfirm()
  const bodyRef = useRef(null)
  const [panel, setPanel] = useState('send') // send | templates
  const [items, setItems] = useState([])
  const [catalog, setCatalog] = useState({
    placeholders: [],
    modes: [],
    signal_ready: false,
    balance: null,
    balance_error: null,
    docs_url: '',
  })
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [busy, setBusy] = useState(false)

  const [sendMode, setSendMode] = useState('text')
  const [sendPhones, setSendPhones] = useState('')
  const [sendMessage, setSendMessage] = useState('')
  const [sendPatternId, setSendPatternId] = useState('')
  const [sendParams, setSendParams] = useState({})
  const [sendParamKeys, setSendParamKeys] = useState([])
  const [sendTemplateId, setSendTemplateId] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  const [testRow, setTestRow] = useState(null)
  const [testPhone, setTestPhone] = useState('')
  const [testParams, setTestParams] = useState({})

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, catRes] = await Promise.all([
        adminApi.smsTemplates.list(),
        adminApi.sms.catalog(),
      ])
      setItems(listRes.data || [])
      setCatalog(
        catRes.data || {
          placeholders: [],
          modes: [],
          signal_ready: false,
          balance: null,
        },
      )
    } catch {
      setError('خطا در بارگذاری بخش پیامک')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const enabledTemplates = useMemo(
    () => items.filter((t) => t.is_enabled !== false),
    [items],
  )
  const rows = filter ? items.filter((row) => row.mode === filter) : items
  const balanceLabel = formatBalance(catalog.balance)
  const phoneCount = parsePhones(sendPhones).length
  const segments = sendMode === 'text' ? smsSegments(sendMessage) : 0

  const modeOptions = useMemo(() => {
    if (catalog.modes?.length) return catalog.modes
    return [
      { key: 'text', label: 'متن آزاد' },
      { key: 'pattern', label: 'الگوی سیگنال' },
    ]
  }, [catalog.modes])

  const refreshBalance = async () => {
    setError('')
    try {
      const r = await adminApi.sms.balance()
      setCatalog((prev) => ({
        ...prev,
        balance: r.data?.balance ?? null,
        balance_error: null,
        signal_ready: true,
      }))
      setOk('اعتبار پنل به‌روز شد.')
    } catch (err) {
      setError(firstError(err.response?.data))
    }
  }

  const applyTemplate = (id) => {
    setSendTemplateId(id)
    const row = items.find((t) => String(t.id) === String(id))
    if (!row) return
    setSendMode(row.mode === 'pattern' ? 'pattern' : 'text')
    if (row.mode === 'pattern') {
      setSendPatternId(row.pattern_id != null ? String(row.pattern_id) : '')
      const keys = parseParamKeys(row.param_keys)
      setSendParamKeys(keys)
      setSendParams({ ...(row.sample_params || {}) })
      setSendMessage('')
    } else {
      setSendMessage(row.body_text || '')
      setSendPatternId('')
      setSendParamKeys([])
      setSendParams({})
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(filter || 'text'))
    setError('')
    setOk('')
    setOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name || '',
      mode: row.mode || 'text',
      body_text: row.body_text || '',
      pattern_id: row.pattern_id != null ? String(row.pattern_id) : '',
      param_keys: Array.isArray(row.param_keys) ? row.param_keys.join(', ') : '',
      sample_params: { ...(row.sample_params || {}) },
      notes: row.notes || '',
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
      const keys = parseParamKeys(form.param_keys)
      const sample_params = {}
      for (const key of keys) {
        sample_params[key] = form.sample_params?.[key] ?? ''
      }
      const payload = {
        name: form.name.trim(),
        mode: form.mode,
        body_text: form.body_text,
        pattern_id: form.mode === 'pattern' ? form.pattern_id : null,
        param_keys: keys,
        sample_params,
        notes: form.notes.trim(),
        is_enabled: form.is_enabled,
      }
      if (editing) {
        await adminApi.smsTemplates.update(editing.id, payload)
      } else {
        await adminApi.smsTemplates.create(payload)
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
      await adminApi.smsTemplates.update(row.id, { is_enabled: !row.is_enabled })
      await load()
    } catch (err) {
      setError(firstError(err.response?.data))
    }
  }

  const remove = async (row) => {
    const okConfirm = await confirm({
      title: 'حذف قالب پیامک',
      description: `آیا از حذف «${row.name}» مطمئن هستید؟`,
      confirmLabel: 'حذف قالب',
    })
    if (!okConfirm) return
    try {
      await adminApi.smsTemplates.remove(row.id)
      setOk('قالب حذف شد.')
      await load()
    } catch (err) {
      setError(firstError(err.response?.data))
    }
  }

  const onQuickSend = async (e) => {
    e.preventDefault()
    setSendBusy(true)
    setError('')
    setOk('')
    setLastResult(null)
    try {
      const payload = { phones: sendPhones }
      if (sendMode === 'pattern') {
        payload.pattern_id = sendPatternId
        payload.parameters = sendParams
      } else {
        payload.message = sendMessage
      }
      const r = await adminApi.sms.send(payload)
      setOk(r.data?.detail || 'پیامک ارسال شد.')
      setLastResult(r.data?.result ?? r.data)
      if (sendMode === 'text') setSendMessage('')
    } catch (err) {
      setError(firstError(err.response?.data))
    } finally {
      setSendBusy(false)
    }
  }

  const sendTest = async (e) => {
    e.preventDefault()
    if (!testRow) return
    setBusy(true)
    setError('')
    try {
      await adminApi.smsTemplates.test(testRow.id, {
        phone: testPhone.trim(),
        parameters: testParams,
      })
      setOk(`پیامک آزمایشی «${testRow.name}» ارسال شد.`)
      setTestRow(null)
      setTestPhone('')
    } catch (err) {
      setError(firstError(err.response?.data))
    } finally {
      setBusy(false)
    }
  }

  const token = (key) => `{{${key}}}`
  const formParamKeys = parseParamKeys(form.param_keys)

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="پیامک"
        description="ارسال از سیگنال و مدیریت قالب‌های متنی یا الگوی خدماتی."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to={`${PANEL_BASE}/settings?tab=sms`}
              className="btn-dark inline-flex cursor-pointer items-center gap-1.5 text-xs"
            >
              <Settings2 className="h-3.5 w-3.5" strokeWidth={1.85} />
              تنظیم سرویس
            </Link>
            <button type="button" className="btn-primary cursor-pointer" onClick={openCreate}>
              افزودن قالب
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
            catalog.signal_ready
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-800'
          }`}
        >
          {catalog.signal_ready ? 'سیگنال آماده است' : 'سیگنال آماده نیست'}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-mist-100 px-2.5 py-1 text-xs text-ink-700/70">
          اعتبار:{' '}
          <strong className="tabular-nums text-ink-900">{balanceLabel || '—'}</strong>
          <button
            type="button"
            onClick={refreshBalance}
            className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded text-ink-700/45 transition hover:bg-white hover:text-ink-900"
            title="به‌روزرسانی اعتبار"
            aria-label="به‌روزرسانی اعتبار"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.85} />
          </button>
        </span>
        {catalog.docs_url ? (
          <a
            href={catalog.docs_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-sea-600 hover:text-copper-600"
          >
            مستندات سیگنال ←
          </a>
        ) : null}
      </div>

      {!catalog.signal_ready && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          برای ارسال، سرویس سیگنال را در{' '}
          <Link
            to={`${PANEL_BASE}/settings?tab=sms`}
            className="font-medium underline underline-offset-2"
          >
            تنظیمات → سرویس پیامک
          </Link>{' '}
          کامل کنید یا{' '}
          <code className="rounded bg-amber-100 px-1">SIGNAL_SMS_API_KEY</code> و{' '}
          <code className="rounded bg-amber-100 px-1">SIGNAL_SMS_FROM</code> را در سرور تنظیم کنید.
        </p>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}
      {catalog.balance_error && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{catalog.balance_error}</p>
      )}

      <div className="flex gap-1 rounded-xl bg-mist-100 p-1">
        <button
          type="button"
          onClick={() => setPanel('send')}
          className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
            panel === 'send' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-700/55 hover:text-ink-900'
          }`}
        >
          <Send className="h-4 w-4" strokeWidth={1.85} />
          ارسال
        </button>
        <button
          type="button"
          onClick={() => setPanel('templates')}
          className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
            panel === 'templates'
              ? 'bg-white text-ink-900 shadow-sm'
              : 'text-ink-700/55 hover:text-ink-900'
          }`}
        >
          <FileText className="h-4 w-4" strokeWidth={1.85} />
          قالب‌ها
          <span className="tabular-nums text-ink-700/40">({faDigits(items.length)})</span>
        </button>
      </div>

      {panel === 'send' ? (
        <section className="rounded-2xl border border-mist-200 bg-white p-4 shadow-soft sm:p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-bold text-ink-900">ارسال پیامک</h2>
            <p className="mt-0.5 text-xs text-ink-700/50">
              شماره‌ها را با فاصله یا ویرگول جدا کنید. می‌توانید از قالب ذخیره‌شده هم استفاده کنید.
            </p>
          </div>

          <form onSubmit={onQuickSend} className="space-y-4">
            {enabledTemplates.length > 0 && (
              <label className="block max-w-md">
                <span className="label">بارگذاری از قالب</span>
                <select
                  className="input"
                  value={sendTemplateId}
                  onChange={(e) => {
                    if (!e.target.value) {
                      setSendTemplateId('')
                      return
                    }
                    applyTemplate(e.target.value)
                  }}
                >
                  <option value="">بدون قالب — ورود دستی</option>
                  {enabledTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.mode_label})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSendMode('text')
                  setSendTemplateId('')
                }}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  sendMode === 'text'
                    ? 'bg-ink-950 text-white'
                    : 'bg-mist-100 text-ink-700/70 hover:bg-mist-200'
                }`}
              >
                متن آزاد
              </button>
              <button
                type="button"
                onClick={() => {
                  setSendMode('pattern')
                  setSendTemplateId('')
                }}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  sendMode === 'pattern'
                    ? 'bg-ink-950 text-white'
                    : 'bg-mist-100 text-ink-700/70 hover:bg-mist-200'
                }`}
              >
                الگوی سیگنال
              </button>
            </div>

            <label className="block">
              <span className="label">
                شماره گیرنده{phoneCount > 1 ? `ها (${faDigits(phoneCount)})` : ''}
              </span>
              <input
                className="input"
                value={sendPhones}
                onChange={(e) => setSendPhones(e.target.value)}
                placeholder="0912xxxxxxx, 0935xxxxxxx"
                required
                dir="ltr"
              />
            </label>

            {sendMode === 'text' ? (
              <label className="block">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="label mb-0">متن پیامک</span>
                  <span className="text-[11px] tabular-nums text-ink-700/40">
                    {faDigits([...sendMessage].length)} نویسه
                    {segments > 0 ? ` · حدود ${faDigits(segments)} پیامک` : ''}
                  </span>
                </div>
                <textarea
                  className="input min-h-[120px]"
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  required
                  placeholder="متن پیامک…"
                />
              </label>
            ) : (
              <div className="space-y-3">
                <label className="block max-w-xs">
                  <span className="label">شناسه الگو</span>
                  <input
                    className="input"
                    value={sendPatternId}
                    onChange={(e) => setSendPatternId(e.target.value)}
                    required
                    dir="ltr"
                    placeholder="مثلاً 12345"
                  />
                </label>
                <div>
                  <span className="label">پارامترهای الگو</span>
                  <ParamFields
                    keys={sendParamKeys.length ? sendParamKeys : Object.keys(sendParams)}
                    values={sendParams}
                    onChange={setSendParams}
                  />
                  {!sendParamKeys.length && (
                    <label className="mt-2 block">
                      <span className="label">نام پارامترها (با ویرگول) — برای فیلدهای بالا</span>
                      <input
                        className="input"
                        dir="ltr"
                        placeholder="otp, name"
                        onBlur={(e) => {
                          const keys = parseParamKeys(e.target.value)
                          setSendParamKeys(keys)
                          setSendParams((prev) => {
                            const next = { ...prev }
                            for (const k of keys) if (next[k] == null) next[k] = ''
                            return next
                          })
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {lastResult != null && (
                <p className="max-w-md truncate text-xs text-ink-700/45" title={JSON.stringify(lastResult)}>
                  آخرین پاسخ API ثبت شد.
                </p>
              )}
              <button
                type="submit"
                disabled={sendBusy || !catalog.signal_ready}
                className="btn-primary ms-auto inline-flex cursor-pointer items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" strokeWidth={1.85} />
                {sendBusy ? 'در حال ارسال…' : 'ارسال پیامک'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-700/70">
              <span>فیلتر نوع</span>
              <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">همه</option>
                {modeOptions.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="h-48 animate-pulse rounded-2xl bg-surface" />
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-mist-200 bg-white px-6 py-12 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-ink-700/25" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-ink-900">هنوز قالبی ندارید</p>
              <p className="mt-1 text-xs text-ink-700/45">
                قالب متنی یا الگوی سیگنال بسازید تا در ارسال سریع قابل انتخاب باشد.
              </p>
              <button type="button" className="btn-primary mt-4 cursor-pointer" onClick={openCreate}>
                افزودن اولین قالب
              </button>
            </div>
          ) : (
            <AdminTable columns={['قالب', 'نوع', 'وضعیت', '']} emptyMessage="قالبی وجود ندارد">
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-mist-100 hover:bg-mist-50/80">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-900">{row.name}</div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-ink-700/40">
                      {row.mode === 'pattern'
                        ? `الگو #${row.pattern_id}${
                            row.param_keys?.length ? ` — ${row.param_keys.join(', ')}` : ''
                          }`
                        : row.body_text}
                    </div>
                    {row.notes ? (
                      <div className="mt-0.5 text-[11px] text-ink-700/35">{row.notes}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-700/70">{row.mode_label}</td>
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
                        title="استفاده در ارسال"
                        aria-label="استفاده در ارسال"
                        onClick={() => {
                          applyTemplate(row.id)
                          setPanel('send')
                          setOk(`قالب «${row.name}» در فرم ارسال بارگذاری شد.`)
                        }}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-sea-600 transition hover:bg-sea-500/10"
                      >
                        <Send className="h-4 w-4" strokeWidth={1.85} />
                      </button>
                      <button
                        type="button"
                        title="ارسال آزمایشی"
                        aria-label="ارسال آزمایشی"
                        onClick={() => {
                          setTestRow(row)
                          setTestPhone('')
                          setTestParams({ ...(row.sample_params || {}) })
                          setError('')
                        }}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-copper-600 transition hover:bg-copper-500/10"
                      >
                        <MessageSquare className="h-4 w-4" strokeWidth={1.85} />
                      </button>
                      <AdminEditButton onClick={() => openEdit(row)} />
                      <AdminDeleteButton onClick={() => remove(row)} />
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}
        </section>
      )}

      <AdminModal
        open={open}
        onClose={close}
        size="lg"
        title={editing ? 'ویرایش قالب پیامک' : 'افزودن قالب پیامک'}
        description="متن آزاد با {{متغیر}}؛ الگوی سیگنال با شناسه پنل و پارامترها."
        footer={
          <>
            <ModalCancelButton onClick={close} disabled={busy} />
            <ModalSubmitButton form="sms-template-form" loading={busy}>
              {editing ? 'ذخیره' : 'افزودن'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="sms-template-form" onSubmit={submit} className="space-y-3">
          {error && open && <p className="text-sm text-red-600">{error}</p>}
          <label className="block">
            <span className="label">نام قالب</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="مثلاً کد تأیید ورود"
            />
          </label>
          <label className="block">
            <span className="label">نوع</span>
            <select
              className="input"
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
            >
              {modeOptions.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          {form.mode === 'text' ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {(catalog.placeholders || []).map((ph) => (
                  <button
                    key={ph.key}
                    type="button"
                    className="cursor-pointer rounded-md border border-mist-200 bg-mist-50 px-2 py-0.5 text-[11px] text-ink-700/70 transition hover:border-copper-300 hover:text-copper-700"
                    onClick={() =>
                      insertAtCursor(bodyRef.current, form.body_text, token(ph.key), (next) =>
                        setForm((f) => ({ ...f, body_text: next })),
                      )
                    }
                  >
                    {ph.label}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="label">متن پیامک</span>
                <textarea
                  ref={bodyRef}
                  className="input min-h-[120px]"
                  value={form.body_text}
                  onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                  required={form.mode === 'text'}
                />
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="label">شناسه الگوی سیگنال</span>
                <input
                  className="input"
                  value={form.pattern_id}
                  onChange={(e) => setForm({ ...form, pattern_id: e.target.value })}
                  required
                  dir="ltr"
                />
              </label>
              <label className="block">
                <span className="label">نام پارامترها (با ویرگول)</span>
                <input
                  className="input"
                  value={form.param_keys}
                  onChange={(e) => setForm({ ...form, param_keys: e.target.value })}
                  placeholder="otp, name"
                  dir="ltr"
                />
              </label>
              {formParamKeys.length > 0 && (
                <div>
                  <span className="label">مقادیر نمونه برای تست</span>
                  <ParamFields
                    keys={formParamKeys}
                    values={form.sample_params}
                    onChange={(sample_params) => setForm({ ...form, sample_params })}
                  />
                </div>
              )}
            </>
          )}

          <label className="block">
            <span className="label">یادداشت (اختیاری)</span>
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-800">
            <input
              type="checkbox"
              checked={form.is_enabled}
              onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
            />
            فعال باشد
          </label>
        </form>
      </AdminModal>

      <AdminModal
        open={!!testRow}
        onClose={() => !busy && setTestRow(null)}
        title="ارسال آزمایشی قالب"
        description={testRow ? `قالب «${testRow.name}»` : ''}
        footer={
          <>
            <ModalCancelButton onClick={() => setTestRow(null)} disabled={busy} />
            <ModalSubmitButton form="sms-test-form" loading={busy}>
              ارسال
            </ModalSubmitButton>
          </>
        }
      >
        <form id="sms-test-form" onSubmit={sendTest} className="space-y-3">
          {error && testRow && <p className="text-sm text-red-600">{error}</p>}
          <label className="block">
            <span className="label">شماره موبایل</span>
            <input
              className="input"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              required
              dir="ltr"
              placeholder="0912xxxxxxx"
            />
          </label>
          {testRow?.mode === 'pattern' && (
            <div>
              <span className="label">پارامترها</span>
              <ParamFields
                keys={
                  parseParamKeys(testRow.param_keys).length
                    ? parseParamKeys(testRow.param_keys)
                    : Object.keys(testParams)
                }
                values={testParams}
                onChange={setTestParams}
              />
            </div>
          )}
        </form>
      </AdminModal>
    </div>
  )
}
