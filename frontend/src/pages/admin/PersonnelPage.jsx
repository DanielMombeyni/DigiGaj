import { useEffect, useMemo, useState } from 'react'
import { Users, Shield } from 'lucide-react'
import { adminApi } from '@/services/api'
import { useConfirm } from '@/components/common/ConfirmProvider'
import { ADMIN_PAGES } from '@/config/adminPages'
import { AdminPageHeader, AdminTable, AdminEditButton, AdminDeleteButton } from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'
import { useAuthStore } from '@/store/auth'

const TABS = [
  { id: 'people', label: 'پرسنل', icon: Users },
  { id: 'roles', label: 'نقش‌ها و دسترسی', icon: Shield },
]

const emptyPerson = () => ({
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  role_id: '',
  is_active: true,
  is_superuser: false,
})

const emptyRole = () => ({
  name: '',
  description: '',
  pages: ['dashboard'],
  is_active: true,
})

function formatError(err) {
  const d = err.response?.data
  if (!d) return err.message || 'خطا'
  if (typeof d === 'string') return d
  if (d.detail) return typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail)
  return JSON.stringify(d)
}

export default function AdminPersonnelPage() {
  const confirm = useConfirm()
  const me = useAuthStore((s) => s.user)
  const [tab, setTab] = useState('people')
  const [people, setPeople] = useState([])
  const [roles, setRoles] = useState([])
  const [personForm, setPersonForm] = useState(emptyPerson())
  const [roleForm, setRoleForm] = useState(emptyRole())
  const [editingPerson, setEditingPerson] = useState(null)
  const [editingRole, setEditingRole] = useState(null)
  const [personOpen, setPersonOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activeRoles = useMemo(() => roles.filter((r) => r.is_active !== false), [roles])

  const load = () =>
    Promise.all([adminApi.personnel.list(), adminApi.roles.list()]).then(([p, r]) => {
      setPeople(p.data.results || p.data)
      setRoles(r.data.results || r.data)
    })

  useEffect(() => {
    load().catch(() => {})
  }, [])

  const openCreatePerson = () => {
    setEditingPerson(null)
    setPersonForm({
      ...emptyPerson(),
      role_id: activeRoles[0]?.id ? String(activeRoles[0].id) : '',
    })
    setError('')
    setPersonOpen(true)
  }

  const openEditPerson = (u) => {
    setEditingPerson(u)
    setPersonForm({
      username: u.username || '',
      email: u.email || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      password: '',
      role_id: u.role_id != null ? String(u.role_id) : '',
      is_active: u.is_active !== false,
      is_superuser: !!u.is_superuser,
    })
    setError('')
    setPersonOpen(true)
  }

  const openCreateRole = () => {
    setEditingRole(null)
    setRoleForm(emptyRole())
    setError('')
    setRoleOpen(true)
  }

  const openEditRole = (role) => {
    setEditingRole(role)
    setRoleForm({
      name: role.name || '',
      description: role.description || '',
      pages: Array.isArray(role.pages) ? [...role.pages] : [],
      is_active: role.is_active !== false,
    })
    setError('')
    setRoleOpen(true)
  }

  const togglePage = (key) => {
    setRoleForm((f) => {
      const has = f.pages.includes(key)
      return {
        ...f,
        pages: has ? f.pages.filter((p) => p !== key) : [...f.pages, key],
      }
    })
  }

  const submitPerson = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const payload = {
      username: personForm.username.trim(),
      email: personForm.email.trim(),
      first_name: personForm.first_name.trim(),
      last_name: personForm.last_name.trim(),
      is_active: personForm.is_active,
      role_id: personForm.role_id ? Number(personForm.role_id) : null,
    }
    if (me?.is_superuser) {
      payload.is_superuser = personForm.is_superuser
    }
    if (personForm.password) payload.password = personForm.password
    try {
      if (editingPerson) {
        await adminApi.personnel.update(editingPerson.id, payload)
      } else {
        if (!payload.password) {
          setError('رمز عبور الزامی است')
          setLoading(false)
          return
        }
        await adminApi.personnel.create(payload)
      }
      setPersonOpen(false)
      load()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  const submitRole = async (e) => {
    e.preventDefault()
    setError('')
    if (!roleForm.pages.length) {
      setError('حداقل یک صفحه را انتخاب کنید')
      return
    }
    setLoading(true)
    const payload = {
      name: roleForm.name.trim(),
      description: roleForm.description.trim(),
      pages: roleForm.pages,
      is_active: roleForm.is_active,
    }
    try {
      if (editingRole) {
        await adminApi.roles.update(editingRole.id, payload)
      } else {
        await adminApi.roles.create(payload)
      }
      setRoleOpen(false)
      load()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  const pageLabel = (key) => ADMIN_PAGES.find((p) => p.key === key)?.label || key

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="پرسنل و نقش‌ها"
        description="ساخت کاربر پنل و تعیین دسترسی هر نقش به صفحات"
        actions={
          tab === 'people' ? (
            <button type="button" className="btn-primary cursor-pointer" onClick={openCreatePerson}>
              افزودن پرسنل
            </button>
          ) : (
            <button type="button" className="btn-primary cursor-pointer" onClick={openCreateRole}>
              افزودن نقش
            </button>
          )
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
              onClick={() => setTab(t.id)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition ${
                active
                  ? 'bg-ink-950 text-white'
                  : 'bg-surface text-ink-700/70 ring-1 ring-mist-200 hover:bg-mist-50'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'people' && (
        <AdminTable columns={['کاربر', 'نقش', 'وضعیت', '']}>
          {people.map((u) => (
            <tr key={u.id} className="border-t border-mist-100 hover:bg-mist-50/80">
              <td className="px-4 py-3">
                <div className="font-medium text-ink-900">{u.username}</div>
                <div className="text-xs text-ink-700/45">
                  {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '—'}
                </div>
              </td>
              <td className="px-4 py-3 text-sm">
                {u.is_superuser ? (
                  <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">مدیرکل</span>
                ) : (
                  u.role_name || <span className="text-ink-700/40">بدون نقش</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-lg px-2 py-1 text-xs ${
                    u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-mist-100 text-ink-700/50'
                  }`}
                >
                  {u.is_active ? 'فعال' : 'غیرفعال'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <AdminEditButton onClick={() => openEditPerson(u)} />
                  {u.id !== me?.id && (
                    <AdminDeleteButton
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'حذف پرسنل',
                          description: `دسترسی پنل «${u.username}» برداشته شود؟`,
                          confirmLabel: 'حذف',
                        })
                        if (!ok) return
                        await adminApi.personnel.remove(u.id)
                        load()
                      }}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}

      {tab === 'roles' && (
        <AdminTable columns={['نقش', 'دسترسی‌ها', 'اعضا', 'وضعیت', '']}>
          {roles.map((role) => (
            <tr key={role.id} className="border-t border-mist-100 hover:bg-mist-50/80">
              <td className="px-4 py-3">
                <div className="font-medium text-ink-900">{role.name}</div>
                {role.description && (
                  <div className="mt-0.5 text-xs text-ink-700/45">{role.description}</div>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex max-w-md flex-wrap gap-1">
                  {(role.pages || []).map((k) => (
                    <span
                      key={k}
                      className="rounded-md bg-mist-100 px-1.5 py-0.5 text-[11px] text-ink-700/70"
                    >
                      {pageLabel(k)}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 tabular-nums">{role.members_count ?? 0}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-lg px-2 py-1 text-xs ${
                    role.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-mist-100 text-ink-700/50'
                  }`}
                >
                  {role.is_active ? 'فعال' : 'غیرفعال'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <AdminEditButton onClick={() => openEditRole(role)} />
                  <AdminDeleteButton
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'حذف نقش',
                        description: `نقش «${role.name}» حذف شود؟`,
                        confirmLabel: 'حذف',
                      })
                      if (!ok) return
                      try {
                        await adminApi.roles.remove(role.id)
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
        open={personOpen}
        onClose={() => !loading && setPersonOpen(false)}
        title={editingPerson ? 'ویرایش پرسنل' : 'پرسنل جدید'}
      >
        <form onSubmit={submitPerson} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <label className="block">
            <span className="label">نام کاربری *</span>
            <input
              className="input"
              dir="ltr"
              required
              value={personForm.username}
              onChange={(e) => setPersonForm({ ...personForm, username: e.target.value })}
              disabled={!!editingPerson}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">نام</span>
              <input
                className="input"
                value={personForm.first_name}
                onChange={(e) => setPersonForm({ ...personForm, first_name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">نام خانوادگی</span>
              <input
                className="input"
                value={personForm.last_name}
                onChange={(e) => setPersonForm({ ...personForm, last_name: e.target.value })}
              />
            </label>
          </div>
          <label className="block">
            <span className="label">ایمیل</span>
            <input
              className="input"
              type="email"
              dir="ltr"
              value={personForm.email}
              onChange={(e) => setPersonForm({ ...personForm, email: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">{editingPerson ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور *'}</span>
            <input
              className="input"
              type="password"
              dir="ltr"
              required={!editingPerson}
              value={personForm.password}
              onChange={(e) => setPersonForm({ ...personForm, password: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">نقش *</span>
            <select
              className="input"
              required={!personForm.is_superuser}
              value={personForm.role_id}
              onChange={(e) => setPersonForm({ ...personForm, role_id: e.target.value })}
            >
              <option value="">انتخاب نقش</option>
              {activeRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={personForm.is_active}
              onChange={(e) => setPersonForm({ ...personForm, is_active: e.target.checked })}
            />
            حساب فعال
          </label>
          {me?.is_superuser && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={personForm.is_superuser}
                onChange={(e) => setPersonForm({ ...personForm, is_superuser: e.target.checked })}
              />
              مدیرکل (دسترسی به همه صفحات)
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <ModalCancelButton onClick={() => !loading && setPersonOpen(false)} />
            <ModalSubmitButton loading={loading}>{editingPerson ? 'ذخیره' : 'ایجاد'}</ModalSubmitButton>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        open={roleOpen}
        onClose={() => !loading && setRoleOpen(false)}
        title={editingRole ? 'ویرایش نقش' : 'نقش جدید'}
      >
        <form onSubmit={submitRole} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <label className="block">
            <span className="label">نام نقش *</span>
            <input
              className="input"
              required
              value={roleForm.name}
              onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">توضیح</span>
            <input
              className="input"
              value={roleForm.description}
              onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
            />
          </label>
          <div>
            <div className="label mb-2">دسترسی به صفحات</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ADMIN_PAGES.map((p) => (
                <label
                  key={p.key}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-mist-200 bg-mist-50/50 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={roleForm.pages.includes(p.key)}
                    onChange={() => togglePage(p.key)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={roleForm.is_active}
              onChange={(e) => setRoleForm({ ...roleForm, is_active: e.target.checked })}
            />
            نقش فعال
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <ModalCancelButton onClick={() => !loading && setRoleOpen(false)} />
            <ModalSubmitButton loading={loading}>{editingRole ? 'ذخیره' : 'ایجاد'}</ModalSubmitButton>
          </div>
        </form>
      </AdminModal>
    </div>
  )
}
