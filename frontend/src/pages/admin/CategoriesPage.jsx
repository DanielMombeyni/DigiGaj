import { useEffect, useMemo, useState } from 'react'
import { adminApi } from '@/services/api'
import { AdminPageHeader, AdminTable, AdminEditButton, AdminDeleteButton } from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'
import { useConfirm } from '@/components/common/ConfirmProvider'
import { mediaSrc } from '@/utils/media'
import { faDigits } from '@/utils/format'

const empty = {
  name: '',
  slug: '',
  description: '',
  parent: '',
  is_active: true,
  sort_order: 0,
}

function firstError(data) {
  if (!data) return 'خطا'
  if (typeof data !== 'object') return String(data)
  if (data.detail) return Array.isArray(data.detail) ? data.detail[0] : data.detail
  const first = Object.values(data)[0]
  return Array.isArray(first) ? first[0] : first || JSON.stringify(data)
}

/** Flat list ordered as tree: parents then children (one level + deeper via parent chain). */
function buildTreeRows(items) {
  const byParent = new Map()
  for (const c of items) {
    const key = c.parent == null ? 'root' : String(c.parent)
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(c)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, 'fa'))
  }
  const rows = []
  const walk = (parentKey, depth) => {
    for (const c of byParent.get(parentKey) || []) {
      rows.push({ ...c, depth })
      walk(String(c.id), depth + 1)
    }
  }
  walk('root', 0)
  // orphans (parent missing from list)
  const seen = new Set(rows.map((r) => r.id))
  for (const c of items) {
    if (!seen.has(c.id)) rows.push({ ...c, depth: 0 })
  }
  return rows
}

export default function AdminCategoriesPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [listError, setListError] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [clearImage, setClearImage] = useState(false)

  const load = () =>
    adminApi.categories
      .list()
      .then((r) => setItems(r.data.results || r.data))
      .catch(() => setListError('خطا در بارگذاری دسته‌بندی‌ها'))

  useEffect(() => {
    load()
  }, [])

  const treeRows = useMemo(() => buildTreeRows(items), [items])

  const parentOptions = useMemo(() => {
    const exclude = new Set()
    if (editing) {
      exclude.add(editing.id)
      const walk = (id) => {
        for (const c of items) {
          if (c.parent === id) {
            exclude.add(c.id)
            walk(c.id)
          }
        }
      }
      walk(editing.id)
    }
    return treeRows.filter((c) => !exclude.has(c.id))
  }, [treeRows, items, editing])

  const openCreate = (parentId = '') => {
    setEditing(null)
    setForm({ ...empty, parent: parentId ? String(parentId) : '' })
    setImageFile(null)
    setImagePreview('')
    setClearImage(false)
    setError('')
    setOpen(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({
      name: c.name || '',
      slug: c.slug || '',
      description: c.description || '',
      parent: c.parent != null ? String(c.parent) : '',
      is_active: c.is_active !== false,
      sort_order: c.sort_order ?? 0,
    })
    setImageFile(null)
    setImagePreview(c.image || '')
    setClearImage(false)
    setError('')
    setOpen(true)
  }

  const close = () => {
    if (!loading) setOpen(false)
  }

  const onImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setClearImage(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fd = new FormData()
    fd.append('name', form.name)
    fd.append('slug', form.slug || form.name.replace(/\s+/g, '-'))
    fd.append('description', form.description || '')
    fd.append('is_active', form.is_active ? 'true' : 'false')
    fd.append('sort_order', String(Number(form.sort_order) || 0))
    if (form.parent) fd.append('parent', form.parent)
    else fd.append('parent', '')
    if (imageFile) fd.append('image', imageFile)
    if (clearImage) fd.append('clear_image', 'true')
    try {
      if (editing) {
        await adminApi.categories.update(editing.slug, fd)
      } else {
        await adminApi.categories.create(fd)
      }
      setOpen(false)
      load()
    } catch (err) {
      setError(firstError(err.response?.data) || err.message || 'خطا')
    } finally {
      setLoading(false)
    }
  }

  const remove = async (c) => {
    const childHint =
      (c.children_count || 0) > 0
        ? ` این دسته ${faDigits(c.children_count)} زیرمجموعه دارد که همراه آن حذف می‌شوند.`
        : ''
    const ok = await confirm({
      title: 'حذف دسته‌بندی',
      description: `آیا از حذف «${c.name}» مطمئن هستید؟${childHint} محصولات این دسته بدون دسته‌بندی می‌مانند.`,
      confirmLabel: 'حذف دسته',
    })
    if (!ok) return
    setListError('')
    try {
      await adminApi.categories.remove(c.slug)
      load()
    } catch (err) {
      setListError(firstError(err.response?.data) || 'حذف ناموفق بود')
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="دسته‌بندی‌ها"
        description="دسته و زیردسته با تصویر — همه دسته‌ها (حتی اولیه) قابل حذف‌اند"
        actions={
          <button type="button" className="btn-primary cursor-pointer" onClick={() => openCreate()}>
            افزودن دسته
          </button>
        }
      />

      {listError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{listError}</p>}

      <AdminTable columns={['تصویر', 'نام', 'والد', 'وضعیت', '']} emptyMessage="هنوز دسته‌ای ثبت نشده">
        {treeRows.map((c) => (
          <tr key={c.id} className="border-t border-mist-100 hover:bg-mist-50/80">
            <td className="px-4 py-3">
              {c.image ? (
                <img
                  src={mediaSrc(c.image)}
                  alt={c.name}
                  className="h-10 w-10 rounded-xl border border-mist-200 bg-mist-50 object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mist-100 text-xs text-ink-700/40">
                  —
                </div>
              )}
            </td>
            <td className="px-4 py-3">
              <div style={{ paddingInlineStart: `${(c.depth || 0) * 1.25}rem` }}>
                <div className="font-medium text-ink-900">
                  {(c.depth || 0) > 0 && <span className="me-1 text-ink-700/35">└</span>}
                  {c.name}
                </div>
                <div className="font-mono text-xs text-ink-700/40">{c.slug}</div>
                {(c.children_count || 0) > 0 && (
                  <div className="mt-0.5 text-[11px] text-ink-700/40">
                    {faDigits(c.children_count)} زیردسته
                  </div>
                )}
              </div>
            </td>
            <td className="px-4 py-3 text-sm text-ink-700/55">{c.parent_name || '—'}</td>
            <td className="px-4 py-3">
              <span
                className={`rounded-lg px-2 py-1 text-xs ${
                  c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-mist-100 text-ink-700/50'
                }`}
              >
                {c.is_active ? 'فعال' : 'غیرفعال'}
              </span>
            </td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  title="افزودن زیردسته"
                  className="cursor-pointer rounded-lg px-2 py-1 text-xs text-sea-600 hover:bg-sea-500/10"
                  onClick={() => openCreate(c.id)}
                >
                  + زیر
                </button>
                <AdminEditButton onClick={() => openEdit(c)} />
                <AdminDeleteButton onClick={() => remove(c)} />
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminModal
        open={open}
        onClose={close}
        title={editing ? 'ویرایش دسته‌بندی' : form.parent ? 'افزودن زیردسته' : 'افزودن دسته‌بندی'}
        size="md"
        footer={
          <>
            <ModalCancelButton onClick={close} />
            <ModalSubmitButton form="category-form" loading={loading}>
              {editing ? 'ذخیره' : 'افزودن'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="category-form" onSubmit={submit} className="space-y-3">
          <div>
            <span className="label">تصویر دسته / زیردسته</span>
            <div className="mt-1 flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-mist-200 bg-mist-50">
                {imagePreview && !clearImage ? (
                  <img src={mediaSrc(imagePreview)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-ink-700/35">بدون تصویر</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="btn-secondary cursor-pointer">
                  انتخاب تصویر
                  <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
                </label>
                {(imagePreview || imageFile) && !clearImage && (
                  <button
                    type="button"
                    className="cursor-pointer rounded-xl border border-mist-200 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setImageFile(null)
                      setImagePreview('')
                      setClearImage(true)
                    }}
                  >
                    حذف تصویر
                  </button>
                )}
              </div>
            </div>
          </div>
          <label className="block">
            <span className="label">دسته والد (اختیاری)</span>
            <select
              className="input"
              value={form.parent}
              onChange={(e) => setForm({ ...form, parent: e.target.value })}
            >
              <option value="">بدون والد — دسته اصلی</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {'—'.repeat(c.depth || 0)} {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">نام</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="label">اسلاگ</span>
            <input
              className="input"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="خودکار از نام"
            />
          </label>
          <label className="block">
            <span className="label">توضیحات</span>
            <textarea
              className="input min-h-[80px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">ترتیب نمایش</span>
            <input
              className="input"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            فعال
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      </AdminModal>
    </div>
  )
}
