import { useEffect, useState } from 'react'
import { adminApi } from '@/services/api'
import { AdminPageHeader, AdminTable, AdminEditButton, AdminDeleteButton } from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'
import { useConfirm } from '@/components/common/ConfirmProvider'

const empty = {
  code: '',
  description: '',
  discount_type: 'percent',
  value: 10,
  is_active: true,
  min_order_toman: 0,
  max_uses: '',
}

export default function AdminDiscountsPage() {
  const confirm = useConfirm()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = () => adminApi.discounts.list().then((r) => setItems(r.data.results || r.data))
  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setError('')
    setOpen(true)
  }

  const openEdit = (d) => {
    setEditing(d)
    setForm({
      code: d.code || '',
      description: d.description || '',
      discount_type: d.discount_type || 'percent',
      value: d.value ?? 10,
      is_active: d.is_active !== false,
      min_order_toman: d.min_order_toman ?? 0,
      max_uses: d.max_uses ?? '',
    })
    setError('')
    setOpen(true)
  }

  const close = () => {
    if (!loading) setOpen(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const payload = {
      ...form,
      value: Number(form.value),
      min_order_toman: Number(form.min_order_toman) || 0,
      max_uses: form.max_uses === '' || form.max_uses == null ? null : Number(form.max_uses),
    }
    try {
      if (editing) {
        await adminApi.discounts.update(editing.id, payload)
      } else {
        await adminApi.discounts.create(payload)
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
        title="کدهای تخفیف"
        description="ساخت و مدیریت کوپن‌های تخفیف"
        actions={
          <button type="button" className="btn-primary cursor-pointer" onClick={openCreate}>
            افزودن کد
          </button>
        }
      />

      <AdminTable columns={['کد', 'نوع', 'مقدار', 'استفاده', 'وضعیت', '']}>
        {items.map((d) => (
          <tr key={d.id} className="border-t border-mist-100 hover:bg-mist-50/80">
            <td className="px-4 py-3 font-mono">{d.code}</td>
            <td className="px-4 py-3">{d.discount_type === 'percent' ? 'درصدی' : 'ثابت'}</td>
            <td className="px-4 py-3">{d.value}</td>
            <td className="px-4 py-3">{d.used_count}</td>
            <td className="px-4 py-3">
              <span
                className={`rounded-lg px-2 py-1 text-xs ${
                  d.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-mist-100 text-ink-700/50'
                }`}
              >
                {d.is_active ? 'فعال' : 'غیرفعال'}
              </span>
            </td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-1">
                <AdminEditButton onClick={() => openEdit(d)} />
                <AdminDeleteButton
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'حذف کد تخفیف',
                      description: `آیا از حذف کد «${d.code}» مطمئن هستید؟`,
                      confirmLabel: 'حذف کد',
                    })
                    if (!ok) return
                    await adminApi.discounts.remove(d.id)
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
        title={editing ? 'ویرایش کد تخفیف' : 'افزودن کد تخفیف'}
        size="md"
        footer={
          <>
            <ModalCancelButton onClick={close} />
            <ModalSubmitButton form="discount-form" loading={loading}>
              {editing ? 'ذخیره' : 'افزودن'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="discount-form" onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="label">کد</span>
            <input
              className="input font-mono uppercase"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              disabled={!!editing}
            />
          </label>
          <label className="block">
            <span className="label">توضیح</span>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">نوع</span>
              <select
                className="input"
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
              >
                <option value="percent">درصدی</option>
                <option value="fixed">مبلغ ثابت</option>
              </select>
            </label>
            <label className="block">
              <span className="label">مقدار</span>
              <input
                className="input"
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                required
                min={1}
              />
            </label>
            <label className="block">
              <span className="label">حداقل سفارش (تومان)</span>
              <input
                className="input"
                type="number"
                value={form.min_order_toman}
                onChange={(e) => setForm({ ...form, min_order_toman: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">سقف استفاده</span>
              <input
                className="input"
                type="number"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                placeholder="نامحدود"
              />
            </label>
          </div>
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
