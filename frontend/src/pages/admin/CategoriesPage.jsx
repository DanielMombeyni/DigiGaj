import { useEffect, useState } from 'react'
import { adminApi } from '@/services/api'
import { AdminPageHeader, AdminTable, AdminEditButton, AdminDeleteButton } from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'
import { useConfirm } from '@/components/common/ConfirmProvider'
import { mediaSrc } from '@/utils/media'

const empty = { name: '', slug: '', description: '', is_active: true, sort_order: 0 }

export default function AdminCategoriesPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')

  const load = () => adminApi.categories.list().then((r) => setItems(r.data.results || r.data))
  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setImageFile(null)
    setImagePreview('')
    setError('')
    setOpen(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({
      name: c.name || '',
      slug: c.slug || '',
      description: c.description || '',
      is_active: c.is_active !== false,
      sort_order: c.sort_order ?? 0,
    })
    setImageFile(null)
    setImagePreview(c.image || '')
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
    if (imageFile) fd.append('image', imageFile)
    try {
      if (editing) {
        await adminApi.categories.update(editing.slug, fd)
      } else {
        await adminApi.categories.create(fd)
      }
      setOpen(false)
      load()
    } catch (err) {
      setError(
        typeof err.response?.data === 'object'
          ? JSON.stringify(err.response.data)
          : err.message || 'خطا',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="دسته‌بندی‌ها"
        description="ساختار کاتالوگ فروشگاه"
        actions={
          <button type="button" className="btn-primary cursor-pointer" onClick={openCreate}>
            افزودن دسته
          </button>
        }
      />

      <AdminTable columns={['تصویر', 'نام', 'اسلاگ', 'وضعیت', '']}>
        {items.map((c) => (
          <tr key={c.id} className="border-t border-mist-100 hover:bg-mist-50/80">
            <td className="px-4 py-3">
              {c.image ? (
                <img
                  src={mediaSrc(c.image)}
                  alt={c.name}
                  className="h-10 w-10 rounded-xl object-cover border border-mist-200 bg-mist-50"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mist-100 text-xs text-ink-700/40">
                  —
                </div>
              )}
            </td>
            <td className="px-4 py-3 font-medium">{c.name}</td>
            <td className="px-4 py-3 font-mono text-xs text-ink-700/50">{c.slug}</td>
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
                <AdminEditButton onClick={() => openEdit(c)} />
                <AdminDeleteButton
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'حذف دسته‌بندی',
                      description: `آیا از حذف «${c.name}» مطمئن هستید؟`,
                      confirmLabel: 'حذف دسته',
                    })
                    if (!ok) return
                    await adminApi.categories.remove(c.slug)
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
        title={editing ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی'}
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
            <span className="label">تصویر دسته</span>
            <div className="mt-1 flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-mist-200 bg-mist-50">
                {imagePreview ? (
                  <img src={mediaSrc(imagePreview)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-ink-700/35">بدون تصویر</span>
                )}
              </div>
              <label className="btn-secondary cursor-pointer">
                انتخاب تصویر
                <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
              </label>
            </div>
          </div>
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
