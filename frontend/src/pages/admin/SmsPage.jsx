import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, RefreshCw, Send, Settings2, FileText, ScrollText } from 'lucide-react'
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
    event: 'custom',
    target_user: 'customer',
    mode,
    body_text: '',
    pattern_id: '',
    param_keys: '',
    param_bindings: {},
    sample_params: {},
    notes: '',
    is_enabled: true,
  }
}

function newClientRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `sms-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function renderPreview(body, context) {
  return String(body || '').replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{([a-zA-Z0-9_]+)\}/g,
    (match, a, b) => {
      const key = a || b
      return context?.[key] != null && context[key] !== '' ? String(context[key]) : match
    },
  )
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

function creditValue(balance, depth = 0) {
  if (balance == null || depth > 4) return null
  if (typeof balance === 'number') return balance
  if (typeof balance === 'string') {
    const text = balance.trim()
    if (!text) return null
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        return creditValue(JSON.parse(text), depth + 1)
      } catch {
        return text
      }
    }
    return text
  }
  if (typeof balance === 'object') {
    if (balance.data != null) {
      const nested = creditValue(balance.data, depth + 1)
      if (nested != null) return nested
    }
    for (const key of ['credit', 'balance', 'amount', 'value', 'remaining']) {
      if (balance[key] == null) continue
      const nested = creditValue(balance[key], depth + 1)
      if (nested != null) return nested
    }
  }
  return null
}

function formatBalance(balance) {
  const value = creditValue(balance)
  if (value == null || value === '') return null
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  if (Number.isFinite(numeric)) {
    return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(numeric)
  }
  return String(value)
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
  const [panel, setPanel] = useState('send') // send | templates | logs
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
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)

  const [sendMode, setSendMode] = useState('template') // template | text | pattern
  const [sendPhones, setSendPhones] = useState('')
  const [sendMessage, setSendMessage] = useState('')
  const [sendPatternId, setSendPatternId] = useState('')
  const [sendParams, setSendParams] = useState({})
  const [sendParamKeys, setSendParamKeys] = useState([])
  const [sendTemplateId, setSendTemplateId] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipientHits, setRecipientHits] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [manualParams, setManualParams] = useState({})
  const [recipientSearchBusy, setRecipientSearchBusy] = useState(false)

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

  useEffect(() => {
    if (sendMode !== 'template') return undefined
    const q = recipientQuery.trim()
    if (q.length < 2) {
      setRecipientHits([])
      return undefined
    }
    const t = setTimeout(async () => {
      setRecipientSearchBusy(true)
      try {
        const { data } = await adminApi.sms.recipients({ search: q })
        setRecipientHits(data.results || [])
      } catch {
        setRecipientHits([])
      } finally {
        setRecipientSearchBusy(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [recipientQuery, sendMode])

  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      const { data } = await adminApi.sms.logs({ page: 1 })
      setLogs(data.results || [])
    } catch {
      setError('خطا در بارگذاری گزارش پیامک')
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    if (panel === 'logs') loadLogs()
  }, [panel])

  const enabledTemplates = useMemo(
    () => items.filter((t) => t.is_enabled !== false),
    [items],
  )
  const rows = filter ? items.filter((row) => row.mode === filter) : items
  const balanceLabel = formatBalance(catalog.balance)
  const maxRecipients = catalog.manual_send_max_recipients || 100
  const phoneCount = parsePhones(sendPhones).length
  const selectedCount = selectedUsers.length
  const segments = sendMode === 'text' ? smsSegments(sendMessage) : 0
  const selectedTemplate = useMemo(
    () => items.find((t) => String(t.id) === String(sendTemplateId)) || null,
    [items, sendTemplateId],
  )
  const manualKeys = selectedTemplate?.manual_param_keys || []
  const paramSources = catalog.param_sources || []

  const modeOptions = useMemo(() => {
    if (catalog.modes?.length) return catalog.modes
    return [
      { key: 'text', label: 'متن آزاد' },
      { key: 'pattern', label: 'الگوی سیگنال' },
    ]
  }, [catalog.modes])

  const eventOptions = useMemo(() => {
    if (catalog.events?.length) return catalog.events
    return [
      { key: 'login_otp', label: 'کد ورود' },
      { key: 'signup_otp', label: 'کد تأیید ثبت‌نام' },
      { key: 'forgot_password', label: 'بازیابی رمز' },
      { key: 'order_created', label: 'ثبت سفارش' },
      { key: 'order_status_changed', label: 'تغییر وضعیت سفارش' },
      { key: 'order_paid', label: 'پرداخت موفق' },
      { key: 'order_shipped', label: 'ارسال سفارش' },
      { key: 'order_delivered', label: 'تحویل سفارش' },
      { key: 'custom', label: 'سفارشی' },
    ]
  }, [catalog.events])

  const targetOptions = useMemo(() => {
    if (catalog.targets?.length) return catalog.targets
    return [
      { key: 'customer', label: 'مشتری' },
      { key: 'admin', label: 'ادمین' },
      { key: 'all', label: 'همه' },
    ]
  }, [catalog.targets])

  const previewContext = catalog.samples?.[form.event] || {}
  const previewText = renderPreview(form.body_text, previewContext)

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
    if (!row) {
      setManualParams({})
      return
    }
    const keys = row.manual_param_keys || []
    const next = {}
    keys.forEach((k) => {
      next[k] = ''
    })
    setManualParams(next)
  }

  const toggleUser = (user) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id)
      if (exists) return prev.filter((u) => u.id !== user.id)
      if (prev.length >= maxRecipients) {
        setError(`حداکثر ${maxRecipients} گیرنده مجاز است.`)
        return prev
      }
      return [...prev, user]
    })
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
      event: row.event || 'custom',
      target_user: row.target_user || 'customer',
      mode: row.mode || 'text',
      body_text: row.body_text || '',
      pattern_id: row.pattern_id != null ? String(row.pattern_id) : '',
      param_keys: Array.isArray(row.param_keys) ? row.param_keys.join(', ') : '',
      param_bindings: { ...(row.param_bindings || {}) },
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
      const param_bindings = {}
      keys.forEach((k) => {
        const src = form.param_bindings?.[k]
        if (src) param_bindings[k] = src
      })
      const payload = {
        name: form.name.trim(),
        event: form.event,
        target_user: form.target_user,
        mode: form.mode,
        body_text: form.mode === 'text' ? form.body_text : '',
        pattern_id: form.mode === 'pattern' ? form.pattern_id : null,
        param_keys: keys,
        param_bindings,
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

  const onTemplateSend = async (e) => {
    e.preventDefault()
    if (!selectedTemplate) {
      setError('یک قالب فعال انتخاب کنید.')
      return
    }
    if (!selectedCount) {
      setError('حداقل یک کاربر انتخاب کنید.')
      return
    }
    if (selectedCount > maxRecipients) {
      setError(`حداکثر ${maxRecipients} گیرنده مجاز است.`)
      return
    }
    const okConfirm = await confirm({
      title: 'تأیید ارسال پیامک',
      description: `ارسال قالب «${selectedTemplate.name}» به ${faDigits(selectedCount)} کاربر؟`,
      confirmLabel: 'ارسال',
    })
    if (!okConfirm) return
    setSendBusy(true)
    setError('')
    setOk('')
    setLastResult(null)
    try {
      const r = await adminApi.sms.sendTemplate({
        template_id: selectedTemplate.id,
        user_ids: selectedUsers.map((u) => u.id),
        manual_params: manualParams,
        confirm: true,
        client_request_id: newClientRequestId(),
      })
      setOk(
        `ارسال انجام شد — موفق: ${faDigits(r.data?.sent || 0)}، ناموفق: ${faDigits(r.data?.failed || 0)}`,
      )
      setLastResult(r.data)
    } catch (err) {
      setError(firstError(err.response?.data))
    } finally {
      setSendBusy(false)
    }
  }

  const onQuickSend = async (e) => {
    e.preventDefault()
    if (phoneCount > maxRecipients) {
      setError(`حداکثر ${maxRecipients} شماره مجاز است.`)
      return
    }
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
        <button
          type="button"
          onClick={() => setPanel('logs')}
          className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
            panel === 'logs' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-700/55 hover:text-ink-900'
          }`}
        >
          <ScrollText className="h-4 w-4" strokeWidth={1.85} />
          گزارش
        </button>
      </div>

      {panel === 'send' ? (
        <section className="rounded-2xl border border-mist-200 bg-white p-4 shadow-soft sm:p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-bold text-ink-900">ارسال پیامک</h2>
            <p className="mt-0.5 text-xs text-ink-700/50">
              ارسال از قالب ذخیره‌شده به کاربران انتخاب‌شده (حداکثر {faDigits(maxRecipients)} نفر)، یا ارسال سریع با شماره.
            </p>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSendMode('template')}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sendMode === 'template'
                  ? 'bg-ink-950 text-white'
                  : 'bg-mist-100 text-ink-700/70 hover:bg-mist-200'
              }`}
            >
              قالب + کاربران
            </button>
            <button
              type="button"
              onClick={() => setSendMode('text')}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sendMode === 'text'
                  ? 'bg-ink-950 text-white'
                  : 'bg-mist-100 text-ink-700/70 hover:bg-mist-200'
              }`}
            >
              متن آزاد (سریع)
            </button>
            <button
              type="button"
              onClick={() => setSendMode('pattern')}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sendMode === 'pattern'
                  ? 'bg-ink-950 text-white'
                  : 'bg-mist-100 text-ink-700/70 hover:bg-mist-200'
              }`}
            >
              الگوی خام (سریع)
            </button>
          </div>

          {sendMode === 'template' ? (
            <form onSubmit={onTemplateSend} className="space-y-4">
              <label className="block max-w-md">
                <span className="label">قالب فعال</span>
                <select
                  className="input"
                  value={sendTemplateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  required
                >
                  <option value="">انتخاب قالب…</option>
                  {enabledTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.mode_label})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label">جستجوی کاربر (نام، نام کاربری، شماره)</span>
                <input
                  className="input"
                  value={recipientQuery}
                  onChange={(e) => setRecipientQuery(e.target.value)}
                  placeholder="حداقل ۲ نویسه…"
                />
              </label>
              {recipientSearchBusy ? (
                <p className="text-xs text-ink-700/45">در حال جستجو…</p>
              ) : null}
              {recipientHits.length > 0 && (
                <ul className="max-h-40 overflow-auto rounded-xl border border-mist-200 divide-y divide-mist-100">
                  {recipientHits.map((u) => {
                    const checked = selectedUsers.some((s) => s.id === u.id)
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => toggleUser(u)}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-right text-sm hover:bg-mist-50"
                        >
                          <span>
                            {u.name || u.username}
                            <span className="ms-2 font-mono text-xs text-ink-700/45" dir="ltr">
                              {u.phone || '—'}
                            </span>
                          </span>
                          <span className="text-xs text-copper-700">{checked ? 'حذف' : 'افزودن'}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              <div className="rounded-xl border border-mist-200 bg-mist-50 px-3 py-2 text-sm">
                انتخاب‌شده: <strong className="tabular-nums">{faDigits(selectedCount)}</strong> /{' '}
                {faDigits(maxRecipients)}
                {selectedUsers.length > 0 && (
                  <ul className="mt-2 max-h-28 space-y-1 overflow-auto text-xs text-ink-700/70">
                    {selectedUsers.map((u) => (
                      <li key={u.id} className="flex justify-between gap-2">
                        <span>
                          {u.name || u.username}{' '}
                          <span className="font-mono" dir="ltr">
                            {u.phone || 'بدون شماره'}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="cursor-pointer text-red-600"
                          onClick={() => toggleUser(u)}
                        >
                          حذف
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {manualKeys.length > 0 && (
                <div>
                  <span className="label">پارامترهای دستی قالب</span>
                  <ParamFields keys={manualKeys} values={manualParams} onChange={setManualParams} />
                </div>
              )}

              <button
                type="submit"
                className="btn-primary cursor-pointer"
                disabled={sendBusy || !selectedTemplate || !selectedCount}
              >
                {sendBusy ? 'در حال ارسال…' : 'تأیید و ارسال'}
              </button>

              {lastResult?.results && (
                <div className="rounded-xl border border-mist-200 bg-white px-3 py-2 text-xs">
                  <div className="mb-1 font-medium">نتایج (batch: {lastResult.batch_id})</div>
                  <ul className="max-h-40 space-y-1 overflow-auto">
                    {lastResult.results.map((r) => (
                      <li key={`${r.user_id}-${r.phone}`} className="flex justify-between gap-2">
                        <span dir="ltr" className="font-mono">
                          {r.phone || r.username}
                        </span>
                        <span className={r.status === 'sent' ? 'text-emerald-700' : 'text-red-600'}>
                          {r.status === 'sent' ? 'موفق' : r.error || 'ناموفق'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </form>
          ) : (
          <form onSubmit={onQuickSend} className="space-y-4">
            <label className="block">
              <span className="label">
                شماره گیرنده{phoneCount > 1 ? `ها (${faDigits(phoneCount)})` : ''} — حداکثر{' '}
                {faDigits(maxRecipients)}
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
          )}
        </section>
      ) : panel === 'templates' ? (
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
            <AdminTable columns={['قالب', 'رویداد', 'مخاطب', 'نوع', 'وضعیت', '']} emptyMessage="قالبی وجود ندارد">
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
                  <td className="px-4 py-3 text-sm text-ink-700/70">{row.event_label || row.event || '—'}</td>
                  <td className="px-4 py-3 text-sm text-ink-700/70">{row.target_label || row.target_user || '—'}</td>
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
      ) : panel === 'logs' ? (
        <section className="space-y-4">
          {logsLoading ? (
            <div className="h-48 animate-pulse rounded-2xl bg-surface" />
          ) : logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-mist-200 bg-white px-6 py-12 text-center text-sm text-ink-700/50">
              هنوز گزارشی ثبت نشده است.
            </div>
          ) : (
            <AdminTable
              columns={['زمان', 'شماره', 'رویداد', 'قالب', 'ادمین', 'وضعیت', 'خطا']}
              emptyMessage="گزارشی نیست"
            >
              {logs.map((row) => (
                <tr key={row.id} className="border-t border-mist-100">
                  <td className="px-4 py-3 text-xs text-ink-700/60" dir="ltr">
                    {row.created_at ? row.created_at.replace('T', ' ').slice(0, 19) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm" dir="ltr">
                    {row.phone}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {row.event}
                    {row.fallback_reason ? (
                      <span className="mt-0.5 block text-[10px] text-amber-700">
                        fallback: {row.fallback_reason}
                      </span>
                    ) : null}
                    {row.batch_id ? (
                      <span className="mt-0.5 block font-mono text-[10px] text-ink-700/40">
                        {row.batch_id.slice(0, 12)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs">{row.template_name || '—'}</td>
                  <td className="px-4 py-3 text-xs">{row.actor_username || '—'}</td>
                  <td className="px-4 py-3 text-sm">{row.status_label || row.status}</td>
                  <td className="px-4 py-3 text-xs text-red-700">{row.error || '—'}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </section>
      ) : null}

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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">رویداد</span>
              <select
                className="input"
                value={form.event}
                onChange={(e) => setForm({ ...form, event: e.target.value })}
              >
                {eventOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">مخاطب</span>
              <select
                className="input"
                value={form.target_user}
                onChange={(e) => setForm({ ...form, target_user: e.target.value })}
              >
                {targetOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-ink-700/45">
            برای هر رویداد فقط یک قالب فعال به‌ازای هر مخاطب می‌ماند. فعال کردن این قالب، قالب قبلی همان رویداد و مخاطب را خاموش می‌کند.
          </p>
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
              {previewText && (
                <div className="rounded-xl border border-mist-200 bg-mist-50 px-3 py-2">
                  <div className="mb-1 text-xs font-medium text-ink-700/50">پیش‌نمایش با داده نمونه</div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-ink-900">{previewText}</p>
                </div>
              )}
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
                <span className="label">نام پارامترها (با ویرگول) — دقیقاً مثل پنل سیگنال</span>
                <input
                  className="input"
                  value={form.param_keys}
                  onChange={(e) => setForm({ ...form, param_keys: e.target.value })}
                  placeholder="otp, name"
                  dir="ltr"
                />
                <span className="mt-1 block text-xs text-ink-700/45">
                  متن پیام در پنل سیگنال است؛ اینجا فقط شناسه و نگاشت پارامتر ذخیره می‌شود.
                </span>
              </label>
              {formParamKeys.length > 0 && (
                <div className="space-y-2">
                  <span className="label">منبع داده هر پارامتر (allowlist)</span>
                  {formParamKeys.map((key) => (
                    <label key={key} className="grid grid-cols-[1fr_1.4fr] items-center gap-2">
                      <span className="font-mono text-xs" dir="ltr">
                        {key}
                      </span>
                      <select
                        className="input"
                        value={form.param_bindings?.[key] || ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            param_bindings: {
                              ...(form.param_bindings || {}),
                              [key]: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">پیش‌فرض هوشمند</option>
                        {paramSources.map((src) => (
                          <option key={src.key} value={src.key}>
                            {src.key} — {src.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <div>
                    <span className="label">مقادیر نمونه برای تست (بدون OTP واقعی)</span>
                    <ParamFields
                      keys={formParamKeys}
                      values={form.sample_params}
                      onChange={(sample_params) => setForm({ ...form, sample_params })}
                    />
                  </div>
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
