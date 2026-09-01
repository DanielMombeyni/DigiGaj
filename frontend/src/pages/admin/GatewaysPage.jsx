import { useEffect, useMemo, useState } from 'react'
import { adminApi } from '@/services/api'
import { AdminPageHeader, AdminTable, AdminEditButton, AdminDeleteButton } from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'
import { useConfirm } from '@/components/common/ConfirmProvider'

function CredentialFields({ schema, creds, setCreds }) {
  return (schema || []).map((field) => (
    <label key={field.key} className="block">
      <span className="label">
        {field.label}
        {field.required ? ' *' : ''}
      </span>
      {field.type === 'boolean' ? (
        <input
          type="checkbox"
          checked={!!creds[field.key]}
          onChange={(e) => setCreds({ ...creds, [field.key]: e.target.checked })}
        />
      ) : field.type === 'select' ? (
        <select
          className="input"
          value={creds[field.key] || ''}
          onChange={(e) => setCreds({ ...creds, [field.key]: e.target.value })}
        >
          <option value="">انتخاب</option>
          {(field.options || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
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
          placeholder={field.secret && String(creds[field.key] || '').startsWith('••••') ? 'برای تغییر، مقدار جدید وارد کنید' : ''}
        />
      )}
      {field.hint && <span className="mt-1 block text-xs text-ink-700/40">{field.hint}</span>}
    </label>
  ))
}

function flowLabel(flow) {
  if (flow === 'card') return 'کارت‌به‌کارت'
  if (flow === 'redirect') return 'درگاه آنلاین'
  return flow || '—'
}

export default function AdminGatewaysPage() {
  const confirm = useConfirm()
  const [catalog, setCatalog] = useState([])
  const [gateways, setGateways] = useState([])
  const [mode, setMode] = useState(null) // 'create' | 'edit'
  const [editing, setEditing] = useState(null)
  const [providerType, setProviderType] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [creds, setCreds] = useState({})
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [enableWeb, setEnableWeb] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const [c, g] = await Promise.all([adminApi.gateways.catalog(), adminApi.gateways.list()])
    setCatalog(c.data.drivers || [])
    setGateways(g.data || [])
  }

  useEffect(() => {
    load()
  }, [])

  const availableDrivers = useMemo(
    () => catalog.filter((d) => !d.already_added),
    [catalog],
  )

  const selectedDriver = useMemo(() => {
    if (mode === 'edit' && editing) {
      return catalog.find((d) => d.provider_type === editing.provider_type) || {
        provider_type: editing.provider_type,
        label: editing.label || editing.display_name,
        credential_schema: editing.credential_schema || [],
        flow: editing.flow,
      }
    }
    return catalog.find((d) => d.provider_type === providerType) || null
  }, [mode, editing, catalog, providerType])

  const openCreate = () => {
    const first = availableDrivers[0]
    setMode('create')
    setEditing(null)
    setProviderType(first?.provider_type || '')
    setDisplayName(first?.label || '')
    setCreds({})
    setLogoFile(null)
    setLogoPreview('')
    setEnableWeb(false)
    setError('')
    setMsg('')
  }

  const openEdit = (gw) => {
    setMode('edit')
    setEditing(gw)
    setProviderType(gw.provider_type)
    setDisplayName(gw.display_name || '')
    setCreds({ ...(gw.credentials || {}) })
    setLogoFile(null)
    setLogoPreview(gw.logo_url || gw.logo || '')
    setEnableWeb(!!gw.is_enabled_web)
    setError('')
    setMsg('')
  }

  const close = () => {
    if (loading) return
    setMode(null)
    setEditing(null)
    setLogoFile(null)
  }

  const onProviderChange = (value) => {
    setProviderType(value)
    const d = catalog.find((x) => x.provider_type === value)
    if (d) setDisplayName(d.label)
    setCreds({})
  }

  const onLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (mode === 'create' && !providerType) {
      setError('نوع درگاه را انتخاب کنید')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('display_name', displayName)
      fd.append('is_enabled_web', enableWeb ? 'true' : 'false')
      fd.append('credentials', JSON.stringify(creds || {}))
      if (logoFile) fd.append('logo', logoFile)

      if (mode === 'create') {
        fd.append('provider_type', providerType)
        await adminApi.gateways.create(fd)
        setMsg('درگاه اضافه شد')
      } else {
        await adminApi.gateways.update(editing.id, fd)
        setMsg('درگاه به‌روز شد')
      }
      close()
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در ذخیره درگاه')
    } finally {
      setLoading(false)
    }
  }

  const toggle = async (gw, field) => {
    try {
      await adminApi.gateways.update(gw.id, { [field]: !gw[field] })
      load()
    } catch (err) {
      setMsg(err.response?.data?.detail || 'خطا در تغییر وضعیت')
    }
  }

  const open = !!mode

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="درگاه‌های پرداخت"
        description="مدیریت درگاه‌ها، تصویر نمایشی و فعال‌سازی وب"
        actions={
          <button
            type="button"
            className="btn-primary cursor-pointer"
            onClick={openCreate}
            disabled={!availableDrivers.length}
            title={!availableDrivers.length ? 'همه انواع درگاه اضافه شده‌اند' : undefined}
          >
            افزودن درگاه
          </button>
        }
      />

      {msg && (
        <p className="rounded-xl bg-sea-500/10 px-3 py-2 text-sm text-sea-600">{msg}</p>
      )}

      <AdminTable columns={['تصویر', 'نام', 'نوع', 'وضعیت', 'فعال', '']}>
        {gateways.map((gw) => (
          <tr key={gw.id} className="border-t border-mist-100 hover:bg-mist-50/80">
            <td className="px-4 py-3">
              {gw.logo_url || gw.logo ? (
                <img
                  src={gw.logo_url || gw.logo}
                  alt={gw.display_name}
                  className="h-10 w-10 rounded-xl object-contain bg-mist-50 border border-mist-200"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mist-100 text-xs text-ink-700/40">
                  —
                </div>
              )}
            </td>
            <td className="px-4 py-3">
              <div className="font-medium">{gw.display_name}</div>
              <div className="text-xs text-ink-700/40">{flowLabel(gw.flow)}</div>
            </td>
            <td className="px-4 py-3 font-mono text-xs">{gw.provider_type}</td>
            <td className="px-4 py-3">
              <span
                className={`rounded-lg px-2 py-1 text-xs ${
                  gw.is_ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {gw.is_ready ? 'آماده' : 'ناقص'}
              </span>
            </td>
            <td className="px-4 py-3">
              <button
                type="button"
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs ${
                  gw.is_enabled_web ? 'bg-emerald-100 text-emerald-700' : 'bg-mist-100 text-ink-700/50'
                }`}
                onClick={() => toggle(gw, 'is_enabled_web')}
              >
                {gw.is_enabled_web ? 'فعال' : 'خاموش'}
              </button>
            </td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-1">
                <AdminEditButton onClick={() => openEdit(gw)} />
                <AdminDeleteButton
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'حذف درگاه پرداخت',
                      description: `آیا از حذف درگاه «${gw.display_name}» مطمئن هستید؟`,
                      confirmLabel: 'حذف درگاه',
                    })
                    if (!ok) return
                    await adminApi.gateways.remove(gw.id)
                    load()
                  }}
                />
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminModal
        open={open}
        onClose={close}
        title={mode === 'edit' ? 'ویرایش درگاه' : 'افزودن درگاه پرداخت'}
        description="نوع درگاه را انتخاب کنید، تصویر نمایشی برای مشتری آپلود کنید و تنظیمات را کامل کنید"
        size="lg"
        footer={
          <>
            <ModalCancelButton onClick={close} />
            <ModalSubmitButton form="gateway-form" loading={loading}>
              {mode === 'edit' ? 'ذخیره' : 'افزودن'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="gateway-form" onSubmit={submit} className="space-y-4">
          {mode === 'create' ? (
            <label className="block">
              <span className="label">نوع درگاه</span>
              <select
                className="input"
                value={providerType}
                onChange={(e) => onProviderChange(e.target.value)}
                required
              >
                <option value="">انتخاب کنید</option>
                {availableDrivers.map((d) => (
                  <option key={d.provider_type} value={d.provider_type}>
                    {d.label} ({flowLabel(d.flow)})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-xl bg-mist-50 px-3 py-2 text-sm text-ink-700/60">
              نوع: <span className="font-medium text-ink-900">{editing?.label || editing?.provider_type}</span>
            </div>
          )}

          <label className="block">
            <span className="label">نام نمایشی</span>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </label>

          <div>
            <span className="label">تصویر درگاه (برای انتخاب مشتری)</span>
            <div className="mt-1 flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-mist-200 bg-mist-50">
                {logoPreview ? (
                  <img src={logoPreview} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs text-ink-700/35">بدون تصویر</span>
                )}
              </div>
              <label className="btn-secondary cursor-pointer">
                انتخاب تصویر
                <input type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
              </label>
            </div>
            <p className="mt-1.5 text-xs text-ink-700/40">
              این تصویر در صفحه تسویه حساب کنار نام درگاه نمایش داده می‌شود
            </p>
          </div>

          {selectedDriver && (
            <div className="space-y-3 border-t border-mist-100 pt-4">
              <p className="text-sm font-medium text-ink-900">تنظیمات دسترسی</p>
              <CredentialFields
                schema={selectedDriver.credential_schema || editing?.credential_schema}
                creds={creds}
                setCreds={setCreds}
              />
            </div>
          )}

          <div className="border-t border-mist-100 pt-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enableWeb} onChange={(e) => setEnableWeb(e.target.checked)} />
              فعال برای وب
            </label>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      </AdminModal>
    </div>
  )
}
