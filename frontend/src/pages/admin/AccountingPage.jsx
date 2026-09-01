import { useEffect, useState } from 'react'
import { adminApi } from '@/services/api'
import { toman } from '@/utils/format'
import { AdminPageHeader, AdminStatCard, AdminTable } from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'

const empty = () => ({
  entry_type: 'expense',
  title: '',
  amount_toman: '',
  description: '',
  occurred_at: new Date().toISOString().slice(0, 16),
})

const typeLabel = {
  income: 'درآمد',
  expense: 'هزینه',
  refund: 'استرداد',
  adjustment: 'تعدیل',
}

export default function AdminAccountingPage() {
  const [summary, setSummary] = useState(null)
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState(empty())
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    adminApi.accounting.summary().then((r) => setSummary(r.data))
    adminApi.accounting.list().then((r) => setEntries(r.data.results || r.data))
  }
  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setForm(empty())
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
    try {
      await adminApi.accounting.create({
        ...form,
        amount_toman: Number(form.amount_toman),
        occurred_at: new Date(form.occurred_at).toISOString(),
      })
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
        title="حسابداری"
        description="درآمد، هزینه و اسناد مالی"
        actions={
          <button type="button" className="btn-primary cursor-pointer" onClick={openCreate}>
            ثبت سند
          </button>
        }
      />

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard label="درآمد" value={toman(summary.income)} accent="emerald" />
          <AdminStatCard label="هزینه" value={toman(summary.expense)} accent="amber" />
          <AdminStatCard label="استرداد" value={toman(summary.refund)} accent="ink" />
          <AdminStatCard label="خالص" value={toman(summary.net)} accent="copper" />
        </div>
      )}

      <AdminTable columns={['عنوان', 'نوع', 'مبلغ']}>
        {entries.map((e) => (
          <tr key={e.id} className="border-t border-mist-100 hover:bg-mist-50/80">
            <td className="px-4 py-3">{e.title}</td>
            <td className="px-4 py-3 text-ink-700/50">{typeLabel[e.entry_type] || e.entry_type}</td>
            <td className="px-4 py-3 font-medium">{toman(e.amount_toman)}</td>
          </tr>
        ))}
      </AdminTable>

      <AdminModal
        open={open}
        onClose={close}
        title="ثبت سند مالی"
        description="سند جدید به دفتر اضافه می‌شود"
        size="md"
        footer={
          <>
            <ModalCancelButton onClick={close} />
            <ModalSubmitButton form="accounting-form" loading={loading}>
              ثبت سند
            </ModalSubmitButton>
          </>
        }
      >
        <form id="accounting-form" onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="label">نوع</span>
            <select
              className="input"
              value={form.entry_type}
              onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
            >
              <option value="income">درآمد</option>
              <option value="expense">هزینه</option>
              <option value="refund">استرداد</option>
              <option value="adjustment">تعدیل</option>
            </select>
          </label>
          <label className="block">
            <span className="label">عنوان</span>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="label">مبلغ (تومان)</span>
            <input
              className="input"
              type="number"
              value={form.amount_toman}
              onChange={(e) => setForm({ ...form, amount_toman: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="label">تاریخ</span>
            <input
              className="input"
              type="datetime-local"
              value={form.occurred_at}
              onChange={(e) => setForm({ ...form, occurred_at: e.target.value })}
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
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      </AdminModal>
    </div>
  )
}
