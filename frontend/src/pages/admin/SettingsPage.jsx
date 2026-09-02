import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Building2, ShieldCheck, MessageSquare, Mail } from 'lucide-react'
import { adminApi } from '@/services/api'
import { useConfirm } from '@/components/common/ConfirmProvider'
import { AdminPageHeader, AdminTable, AdminEditButton, AdminDeleteButton } from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'
import { invalidateStorefrontConfig } from '@/services/storefrontConfig'
import { PANEL_BASE } from '@/config/panel'

const TABS = [
  { id: 'auth', label: 'ورود مشتریان', icon: KeyRound },
  { id: 'company', label: 'اطلاعات شرکت', icon: Building2 },
  { id: 'enamad', label: 'اینماد', icon: ShieldCheck },
  { id: 'email', label: 'ایمیل', icon: Mail },
  { id: 'sms', label: 'سرویس پیامک', icon: MessageSquare },
]

const AUTH_OPTIONS = [
  {
    key: 'username_password',
    title: 'نام کاربری و رمز عبور',
    hint: 'حالت پیش‌فرض — ورود با یوزرنیم',
  },
  {
    key: 'email_password',
    title: 'ایمیل و رمز عبور',
    hint: 'ورود با آدرس ایمیل ثبت‌شده',
  },
  {
    key: 'phone_password',
    title: 'شماره تلفن و رمز عبور',
    hint: 'شماره باید در پروفایل کاربر ثبت شده باشد',
  },
  {
    key: 'phone_otp',
    title: 'شماره تلفن و رمز یک‌بارمصرف',
    hint: 'نیاز به فعال بودن یکی از سرویس‌های پیامک در همین صفحه',
  },
]

const empty = () => ({
  auth_methods: {
    username_password: true,
    email_password: false,
    phone_password: false,
    phone_otp: false,
  },
  company_phone: '',
  company_email: '',
  company_address: '',
  enamad_html: '',
})

const emptySmtp = () => ({
  enabled: false,
  host: '',
  port: 587,
  username: '',
  password: '',
  use_tls: true,
  use_ssl: false,
  from_email: '',
  from_name: '',
  timeout: 20,
  is_ready: false,
})

function CredentialFields({ schema, creds, setCreds }) {
  return (schema || []).map((field) => (
    <label key={field.key} className="block">
      <span className="label">
        {field.label}
        {field.required ? ' *' : ''}
      </span>
      {field.type === 'textarea' ? (
        <textarea
          className="input min-h-[88px]"
          value={creds[field.key] || ''}
          onChange={(e) => setCreds({ ...creds, [field.key]: e.target.value })}
        />
      ) : (
        <input
          className="input"
          type={field.secret ? 'password' : 'text'}
          value={creds[field.key] || ''}
          onChange={(e) => setCreds({ ...creds, [field.key]: e.target.value })}
          placeholder={
            field.secret && String(creds[field.key] || '').startsWith('••••')
              ? 'برای تغییر، مقدار جدید وارد کنید'
              : ''
          }
          dir={field.secret || field.key.includes('api') || field.key.includes('key') ? 'ltr' : undefined}
        />
      )}
      {field.hint && <span className="mt-1 block text-xs text-ink-700/40">{field.hint}</span>}
    </label>
  ))
}

export default function AdminSettingsPage() {
  const confirm = useConfirm()
  const [tab, setTab] = useState('auth')
  const [form, setForm] = useState(empty)
  const [smsAvailable, setSmsAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const [smsRows, setSmsRows] = useState([])
  const [smsCatalog, setSmsCatalog] = useState([])
  const [smsLoading, setSmsLoading] = useState(false)
  const [smsError, setSmsError] = useState('')
  const [smsMode, setSmsMode] = useState(null) // 'create' | 'edit'
  const [editingSms, setEditingSms] = useState(null)
  const [smsProviderType, setSmsProviderType] = useState('')
  const [smsCreds, setSmsCreds] = useState({})
  const [smsName, setSmsName] = useState('')
  const [smsBusy, setSmsBusy] = useState(false)
  const [smtp, setSmtp] = useState(emptySmtp)
  const [smtpLoading, setSmtpLoading] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testBusy, setTestBusy] = useState(false)

  const availableSmsDrivers = useMemo(
    () => smsCatalog.filter((d) => !d.already_added),
    [smsCatalog],
  )

  const selectedSmsDriver = useMemo(() => {
    if (smsMode === 'edit' && editingSms) {
      return (
        smsCatalog.find((d) => d.provider_type === editingSms.provider_type) || {
          provider_type: editingSms.provider_type,
          label: editingSms.label,
          credential_schema: editingSms.credential_schema || [],
        }
      )
    }
    return smsCatalog.find((d) => d.provider_type === smsProviderType) || null
  }, [smsMode, editingSms, smsCatalog, smsProviderType])

  const load = () => {
    setLoading(true)
    setError('')
    adminApi.storeConfig
      .get()
      .then((r) => {
        setSmsAvailable(!!r.data.sms_available)
        setForm({
          ...empty(),
          ...r.data,
          auth_methods: { ...empty().auth_methods, ...r.data.auth_methods },
        })
      })
      .catch(() => setError('خطا در بارگذاری تنظیمات'))
      .finally(() => setLoading(false))
  }

  const refreshSmsAvailability = () => {
    adminApi.storeConfig
      .get()
      .then((r) => {
        setSmsAvailable(!!r.data.sms_available)
        setForm((prev) => ({
          ...prev,
          auth_methods: { ...prev.auth_methods, ...r.data.auth_methods },
        }))
      })
      .catch(() => {})
  }

  const loadSms = async () => {
    setSmsLoading(true)
    setSmsError('')
    try {
      const [listRes, catRes] = await Promise.all([
        adminApi.smsProviders.list(),
        adminApi.smsProviders.catalog(),
      ])
      setSmsRows(listRes.data || [])
      setSmsCatalog(catRes.data?.drivers || [])
    } catch {
      setSmsError('خطا در بارگذاری سرویس‌های پیامک')
    } finally {
      setSmsLoading(false)
    }
  }

  const loadSmtp = async () => {
    setSmtpLoading(true)
    setError('')
    try {
      const { data } = await adminApi.emailSmtp.get()
      setSmtp({ ...emptySmtp(), ...data })
    } catch {
      setError('خطا در بارگذاری تنظیمات ایمیل')
    } finally {
      setSmtpLoading(false)
    }
  }

  const saveSmtp = async (e) => {
    e?.preventDefault()
    setError('')
    setOk('')
    setSaving(true)
    try {
      const { data } = await adminApi.emailSmtp.update({
        ...smtp,
        port: Number(smtp.port) || 587,
        timeout: Number(smtp.timeout) || 20,
      })
      setSmtp({ ...emptySmtp(), ...data })
      setOk('تنظیمات ایمیل ذخیره شد.')
    } catch (err) {
      const detail = err.response?.data
      setError(
        typeof detail === 'object'
          ? detail.enabled || detail.from_email || detail.host || detail.detail || JSON.stringify(detail)
          : err.message || 'خطا در ذخیره',
      )
    } finally {
      setSaving(false)
    }
  }

  const sendSmtpTest = async (e) => {
    e.preventDefault()
    setError('')
    setOk('')
    setTestBusy(true)
    try {
      await adminApi.emailSmtp.test(testTo.trim())
      setOk('ایمیل آزمایشی ارسال شد.')
    } catch (err) {
      const detail = err.response?.data
      setError(
        typeof detail === 'object'
          ? detail.to || detail.detail || JSON.stringify(detail)
          : 'ارسال آزمایشی ناموفق بود',
      )
    } finally {
      setTestBusy(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (tab === 'sms') loadSms()
    if (tab === 'email') loadSmtp()
  }, [tab])

  const activeCount = useMemo(
    () => Object.values(form.auth_methods || {}).filter(Boolean).length,
    [form.auth_methods],
  )

  const toggleAuth = (key) => {
    if (key === 'phone_otp' && !smsAvailable && !form.auth_methods?.phone_otp) {
      setError('برای فعال‌سازی ورود با رمز یک‌بارمصرف، ابتدا یک سرویس پیامک فعال و تنظیم‌شده اضافه کنید.')
      return
    }
    setForm((prev) => {
      const next = { ...prev.auth_methods, [key]: !prev.auth_methods[key] }
      if (!Object.values(next).some(Boolean)) {
        setError('حداقل یک روش ورود باید فعال بماند.')
        return prev
      }
      setError('')
      return { ...prev, auth_methods: next }
    })
  }

  const save = async (e) => {
    e?.preventDefault()
    if (tab === 'sms' || tab === 'email') return
    setError('')
    setOk('')
    if (activeCount < 1) {
      setError('حداقل یک روش ورود باید فعال باشد.')
      setTab('auth')
      return
    }
    setSaving(true)
    try {
      const { data } = await adminApi.storeConfig.update(form)
      setSmsAvailable(!!data.sms_available)
      setForm({
        ...empty(),
        ...data,
        auth_methods: { ...empty().auth_methods, ...data.auth_methods },
      })
      invalidateStorefrontConfig()
      setOk('تنظیمات ذخیره شد.')
    } catch (err) {
      const detail = err.response?.data
      setError(
        typeof detail === 'object'
          ? detail.auth_methods || detail.company_email || detail.detail || JSON.stringify(detail)
          : err.message || 'خطا در ذخیره',
      )
    } finally {
      setSaving(false)
    }
  }

  const openSmsCreate = () => {
    const first = availableSmsDrivers[0]
    setSmsMode('create')
    setEditingSms(null)
    setSmsProviderType(first?.provider_type || '')
    setSmsName(first?.label || '')
    setSmsCreds({})
    setSmsError('')
  }

  const openSmsEdit = (row) => {
    setSmsMode('edit')
    setEditingSms(row)
    setSmsProviderType(row.provider_type)
    setSmsName(row.display_name || row.label || '')
    setSmsCreds({ ...(row.credentials || {}) })
    setSmsError('')
  }

  const closeSmsModal = () => {
    if (smsBusy) return
    setSmsMode(null)
    setEditingSms(null)
  }

  const onSmsProviderChange = (value) => {
    setSmsProviderType(value)
    const d = smsCatalog.find((x) => x.provider_type === value)
    if (d) setSmsName(d.label)
    setSmsCreds({})
  }

  const saveSms = async (e) => {
    e.preventDefault()
    setSmsBusy(true)
    setSmsError('')
    try {
      if (smsMode === 'create') {
        if (!smsProviderType) {
          setSmsError('نوع سرویس را انتخاب کنید')
          setSmsBusy(false)
          return
        }
        await adminApi.smsProviders.create({
          provider_type: smsProviderType,
          display_name: smsName,
          credentials: smsCreds,
          is_enabled: false,
        })
        setOk('سرویس پیامک اضافه شد.')
      } else if (editingSms) {
        await adminApi.smsProviders.update(editingSms.id, {
          display_name: smsName,
          credentials: smsCreds,
        })
        setOk('تنظیمات سرویس پیامک ذخیره شد.')
      }
      closeSmsModal()
      await loadSms()
      refreshSmsAvailability()
    } catch (err) {
      setSmsError(err.response?.data?.detail || 'خطا در ذخیره سرویس پیامک')
    } finally {
      setSmsBusy(false)
    }
  }

  const toggleSms = async (row) => {
    setSmsError('')
    setSmsBusy(true)
    try {
      await adminApi.smsProviders.update(row.id, { is_enabled: !row.is_enabled })
      await loadSms()
      refreshSmsAvailability()
    } catch (err) {
      setSmsError(err.response?.data?.detail || 'برای فعال‌سازی ابتدا اطلاعات را کامل کنید')
    } finally {
      setSmsBusy(false)
    }
  }

  const removeSms = async (row) => {
    const ok = await confirm({
      title: 'حذف سرویس پیامک',
      description: `آیا از حذف «${row.display_name || row.label}» مطمئن هستید؟`,
      confirmLabel: 'حذف سرویس',
    })
    if (!ok) return
    setSmsError('')
    setSmsBusy(true)
    try {
      await adminApi.smsProviders.remove(row.id)
      await loadSms()
      refreshSmsAvailability()
      setOk('سرویس حذف شد.')
    } catch (err) {
      setSmsError(err.response?.data?.detail || 'خطا در حذف')
    } finally {
      setSmsBusy(false)
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="تنظیمات فروشگاه"
        description="ورود مشتریان، اطلاعات شرکت، اینماد، ایمیل و سرویس پیامک"
        actions={
          tab === 'email' ? (
            <button
              type="button"
              className="btn-primary cursor-pointer"
              disabled={saving || smtpLoading}
              onClick={saveSmtp}
            >
              {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          ) : tab !== 'sms' ? (
            <button
              type="button"
              className="btn-primary cursor-pointer"
              disabled={saving || loading}
              onClick={save}
            >
              {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-mist-200 pb-3">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id)
                setError('')
                setOk('')
                setSmsError('')
              }}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-ink-950 text-white'
                  : 'bg-surface text-ink-700/70 hover:bg-mist-50 border border-mist-200'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} />
              {t.label}
            </button>
          )
        })}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}
      {smsError && tab === 'sms' && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{smsError}</p>
      )}

      {tab === 'email' ? (
        smtpLoading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-surface" />
        ) : (
          <form onSubmit={saveSmtp} className="space-y-4 rounded-2xl border border-mist-200/80 bg-surface p-5 shadow-soft sm:p-6">
            <p className="text-sm text-ink-700/55">
              این تنظیمات برای ایمیل‌های فروشگاه (سفارش، تیکت، ثبت‌نام) است. قالب‌ها را در صفحه{' '}
              <Link to={`${PANEL_BASE}/emails`} className="font-medium text-copper-700 underline underline-offset-2">
                ایمیل‌ها
              </Link>{' '}
              بسازید و فعال کنید.
            </p>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-mist-200 px-4 py-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!smtp.enabled}
                onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })}
              />
              <span>
                <span className="block font-medium text-ink-900">ارسال ایمیل فعال باشد</span>
                <span className="mt-0.5 block text-xs text-ink-700/45">
                  تا وقتی خاموش است هیچ قالب تراکنشی ارسال نمی‌شود.
                </span>
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">میزبان SMTP</span>
                <input
                  className="input"
                  dir="ltr"
                  value={smtp.host}
                  onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                  placeholder="smtp.example.com"
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="label">پورت</span>
                <input
                  className="input"
                  type="number"
                  dir="ltr"
                  min={1}
                  max={65535}
                  value={smtp.port}
                  onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="label">نام کاربری</span>
                <input
                  className="input"
                  dir="ltr"
                  value={smtp.username}
                  onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="label">رمز عبور</span>
                <input
                  className="input"
                  type="password"
                  dir="ltr"
                  value={smtp.password}
                  onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                  placeholder={String(smtp.password || '').startsWith('••••') ? 'برای تغییر، مقدار جدید وارد کنید' : ''}
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className="label">ایمیل فرستنده</span>
                <input
                  className="input"
                  type="email"
                  dir="ltr"
                  value={smtp.from_email}
                  onChange={(e) => setSmtp({ ...smtp, from_email: e.target.value })}
                  placeholder="noreply@example.com"
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className="label">نام فرستنده</span>
                <input
                  className="input"
                  value={smtp.from_name}
                  onChange={(e) => setSmtp({ ...smtp, from_name: e.target.value })}
                  placeholder="فروشگاه"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!smtp.use_tls && !smtp.use_ssl}
                  onChange={(e) => setSmtp({ ...smtp, use_tls: e.target.checked, use_ssl: false })}
                />
                TLS (پورت ۵۸۷)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!smtp.use_ssl}
                  onChange={(e) =>
                    setSmtp({ ...smtp, use_ssl: e.target.checked, use_tls: !e.target.checked })
                  }
                />
                SSL (پورت ۴۶۵)
              </label>
            </div>
            <div className="border-t border-mist-100 pt-4">
              <p className="mb-2 text-sm font-medium text-ink-900">ارسال آزمایشی</p>
              <div className="flex max-w-md flex-col gap-2 sm:flex-row">
                <input
                  className="input"
                  type="email"
                  dir="ltr"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                />
                <button
                  type="button"
                  className="btn-dark cursor-pointer shrink-0"
                  disabled={testBusy || !testTo.trim()}
                  onClick={sendSmtpTest}
                >
                  {testBusy ? 'در حال ارسال...' : 'ارسال آزمایشی'}
                </button>
              </div>
            </div>
          </form>
        )
      ) : tab === 'sms' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-700/55">
              سرویس را اضافه کنید، از جدول فعال/غیرفعال کنید. فقط یک سرویس می‌تواند همزمان فعال باشد.
            </p>
            <button
              type="button"
              className="btn-primary cursor-pointer text-xs"
              onClick={openSmsCreate}
              disabled={!availableSmsDrivers.length || smsBusy}
              title={!availableSmsDrivers.length ? 'همه سرویس‌ها اضافه شده‌اند' : undefined}
            >
              افزودن سرویس
            </button>
          </div>
          {smsLoading ? (
            <div className="h-40 animate-pulse rounded-2xl bg-surface" />
          ) : (
            <AdminTable columns={['سرویس', 'وضعیت', 'فعال', '']}>
              {smsRows.map((row) => (
                <tr key={row.id} className="border-t border-mist-100 hover:bg-mist-50/80">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-900">{row.display_name || row.label}</div>
                    <div className="text-xs text-ink-700/40">{row.provider_type}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-lg px-2 py-1 text-xs ${
                        row.is_ready
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {row.is_ready ? 'آماده' : 'ناقص'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={smsBusy}
                      onClick={() => toggleSms(row)}
                      className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
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
                      <AdminEditButton onClick={() => openSmsEdit(row)} />
                      <AdminDeleteButton onClick={() => removeSms(row)} />
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}

          <AdminModal
            open={!!smsMode}
            onClose={closeSmsModal}
            title={
              smsMode === 'create'
                ? 'افزودن سرویس پیامک'
                : `ویرایش ${editingSms?.label || editingSms?.display_name || ''}`
            }
            description="اطلاعات پنل پیامک را وارد کنید"
            footer={
              <>
                <ModalCancelButton onClick={closeSmsModal} disabled={smsBusy} />
                <ModalSubmitButton form="sms-form" loading={smsBusy}>
                  {smsMode === 'create' ? 'افزودن' : 'ذخیره'}
                </ModalSubmitButton>
              </>
            }
          >
            <form id="sms-form" onSubmit={saveSms} className="space-y-3">
              {smsMode === 'create' && (
                <label className="block">
                  <span className="label">نوع سرویس</span>
                  <select
                    className="input"
                    value={smsProviderType}
                    onChange={(e) => onSmsProviderChange(e.target.value)}
                    required
                  >
                    <option value="">انتخاب کنید</option>
                    {availableSmsDrivers.map((d) => (
                      <option key={d.provider_type} value={d.provider_type}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="label">نام نمایشی</span>
                <input
                  className="input"
                  value={smsName}
                  onChange={(e) => setSmsName(e.target.value)}
                  required
                />
              </label>
              <CredentialFields
                schema={
                  smsMode === 'edit'
                    ? editingSms?.credential_schema
                    : selectedSmsDriver?.credential_schema
                }
                creds={smsCreds}
                setCreds={setSmsCreds}
              />
              {selectedSmsDriver?.docs_url && (
                <a
                  href={selectedSmsDriver.docs_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs text-sea-600 hover:text-copper-600"
                >
                  مشاهده مستندات سرویس ←
                </a>
              )}
            </form>
          </AdminModal>
        </div>
      ) : loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <form onSubmit={save} className="rounded-2xl border border-mist-200/80 bg-surface p-5 shadow-soft sm:p-6">
          {tab === 'auth' && (
            <div className="space-y-4">
              <p className="text-sm text-ink-700/55">
                روش‌هایی که مشتری می‌تواند با آن‌ها وارد شود را انتخاب کنید. حداقل یک مورد باید فعال باشد.
              </p>
              <div className="grid gap-3">
                {AUTH_OPTIONS.map((opt) => {
                  const on = !!form.auth_methods[opt.key]
                  const otpBlocked = opt.key === 'phone_otp' && !smsAvailable
                  return (
                    <label
                      key={opt.key}
                      className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                        otpBlocked
                          ? 'cursor-not-allowed border-mist-200 bg-mist-50/60 opacity-70'
                          : on
                            ? 'cursor-pointer border-copper-400/50 bg-copper-500/5'
                            : 'cursor-pointer border-mist-200 hover:bg-mist-50/80'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={on}
                        disabled={otpBlocked}
                        onChange={() => toggleAuth(opt.key)}
                      />
                      <span>
                        <span className="block font-medium text-ink-900">{opt.title}</span>
                        <span className="mt-0.5 block text-xs text-ink-700/45">
                          {otpBlocked
                            ? 'ابتدا در تب «سرویس پیامک» یک سرویس فعال و تنظیم‌شده اضافه کنید.'
                            : opt.hint}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'company' && (
            <div className="space-y-4">
              <p className="text-sm text-ink-700/55">
                تلفن، ایمیل و آدرس اختیاری‌اند. هر کدام را پر کنید در فوتر و صفحه تماس نمایش داده می‌شود؛ خالی‌ها نشان داده نمی‌شوند.
              </p>
              <label className="block max-w-md">
                <span className="label">شماره تلفن شرکت</span>
                <input
                  className="input"
                  value={form.company_phone || ''}
                  onChange={(e) => setForm({ ...form, company_phone: e.target.value })}
                  placeholder="مثلاً ۰۲۱-۹۱۰۰۰۰۰۰"
                />
              </label>
              <label className="block max-w-md">
                <span className="label">ایمیل شرکت</span>
                <input
                  className="input"
                  type="email"
                  dir="ltr"
                  value={form.company_email || ''}
                  onChange={(e) => setForm({ ...form, company_email: e.target.value })}
                  autoComplete="email"
                  placeholder="info@example.com"
                />
              </label>
              <label className="block max-w-xl">
                <span className="label">آدرس شرکت</span>
                <textarea
                  className="input min-h-[100px]"
                  value={form.company_address || ''}
                  onChange={(e) => setForm({ ...form, company_address: e.target.value })}
                  placeholder="آدرس کامل دفتر / انبار"
                />
              </label>
            </div>
          )}

          {tab === 'enamad' && (
            <div className="space-y-4">
              <p className="text-sm text-ink-700/55">
                تگ یا اسکریپت اینماد را از پنل اینماد کپی کنید. در صورت خالی بودن، چیزی در فوتر نشان داده نمی‌شود.
              </p>
              <label className="block">
                <span className="label">کد HTML اینماد</span>
                <textarea
                  className="input min-h-[160px] font-mono text-xs"
                  value={form.enamad_html}
                  onChange={(e) => setForm({ ...form, enamad_html: e.target.value })}
                  placeholder='مثلاً <a referrerpolicy="origin" target="_blank" href="https://trustseal.enamad.ir/..."><img ... /></a>'
                  dir="ltr"
                />
              </label>
              {form.enamad_html.trim() && (
                <div>
                  <div className="mb-2 text-xs font-medium text-ink-700/50">پیش‌نمایش</div>
                  <div
                    className="inline-block rounded-xl border border-mist-200 bg-mist-50 p-3"
                    dangerouslySetInnerHTML={{ __html: form.enamad_html }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end border-t border-mist-100 pt-4">
            <button type="submit" className="btn-primary cursor-pointer" disabled={saving}>
              {saving ? 'در حال ذخیره...' : 'ذخیره'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
