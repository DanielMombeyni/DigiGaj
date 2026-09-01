import { useEffect, useState } from 'react'
import { adminApi } from '@/services/api'
import { useConfirm } from '@/components/common/ConfirmProvider'
import { AdminPageHeader, AdminTable, AdminEditButton, AdminDeleteButton } from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'

const empty = () => ({
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  phone: '',
  password: '',
  is_active: true,
})

function formatError(err) {
  const d = err.response?.data
  if (!d) return err.message || 'خطا'
  if (typeof d === 'string') return d
  if (d.detail) return typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail)
  return JSON.stringify(d)
}

export default function AdminCustomersPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(empty())
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setListLoading(true)
    return adminApi.customers
      .list()
      .then((r) => setItems(r.data.results || r.data))
      .finally(() => setListLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(empty())
    setError('')
    setOpen(true)
  }

  const openEdit = (u) => {
    setEditing(u)
    setForm({
      username: u.username || '',
      email: u.email || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      phone: u.phone || '',
      password: '',
      is_active: u.is_active !== false,
    })
    setError('')
    setOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const payload = {
      username: form.username.trim(),
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim(),
      is_active: form.is_active,
    }
    if (form.password) payload.password = form.password
    try {
      if (editing) {
        await adminApi.customers.update(editing.id, payload)
      } else {
        if (!form.password) {
          setError('رمز عبور الزامی است')
          setLoading(false)
          return
        }
        await adminApi.customers.create(payload)
      }
      setOpen(false)
      load()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="مشتریان"
        description="ثبت حساب مشتری — آدرس الزامی نیست"
        actions={
          <button type="button" className="btn-primary cursor-pointer" onClick={openCreate}>
            افزودن مشتری
          </button>
        }
      />

      {listLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
      ) : (
        <AdminTable columns={['کاربر', 'تماس', 'وضعیت', 'تاریخ عضویت', '']}>
          {items.map((u) => (
            <tr key={u.id} className="border-t border-mist-100 hover:bg-mist-50/80">
              <td className="px-4 py-3">
                <div className="font-medium text-ink-900">{u.username}</div>
                <div className="text-xs text-ink-700/45">
                  {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '—'}
                </div>
              </td>
              <td className="px-4 py-3 text-sm">{u.phone || u.email || '—'}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-lg px-2 py-1 text-xs ${
                    u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-mist-100 text-ink-700/50'
                  }`}
                >
                  {u.is_active ? 'فعال' : 'غیرفعال'}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-ink-700/50">
                {u.date_joined ? new Date(u.date_joined).toLocaleDateString('fa-IR') : '—'}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <AdminEditButton onClick={() => openEdit(u)} />
                  <AdminDeleteButton
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'غیرفعال کردن مشتری',
                        description: `حساب «${u.username}» غیرفعال شود؟`,
                        confirmLabel: 'تأیید',
                      })
                      if (!ok) return
                      try {
                        await adminApi.customers.remove(u.id)
                        load()
                      } catch (err) {
                        window.alert(formatError(err))
                      }
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}

      <AdminModal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title={editing ? 'ویرایش مشتری' : 'مشتری جدید'}
      >
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <label className="block">
            <span className="label">نام کاربری *</span>
            <input
              className="input"
              dir="ltr"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              disabled={!!editing}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">نام</span>
              <input
                className="input"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">نام خانوادگی</span>
              <input
                className="input"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </label>
          </div>
          <label className="block">
            <span className="label">ایمیل</span>
            <input
              className="input"
              type="email"
              dir="ltr"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">موبایل</span>
            <input
              className="input"
              dir="ltr"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="اختیاری"
            />
          </label>
          <label className="block">
            <span className="label">{editing ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور *'}</span>
            <input
              className="input"
              type="password"
              dir="ltr"
              required={!editing}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            حساب فعال
          </label>
          <p className="text-xs text-ink-700/45">آدرس در زمان ثبت سفارش یا بعداً قابل تکمیل است.</p>
          <div className="flex justify-end gap-2 pt-2">
            <ModalCancelButton onClick={() => !loading && setOpen(false)} />
            <ModalSubmitButton loading={loading}>{editing ? 'ذخیره' : 'ایجاد'}</ModalSubmitButton>
          </div>
        </form>
      </AdminModal>
    </div>
  )
}
