import { useEffect, useMemo, useState } from 'react'
import { Plus, X, ImagePlus } from 'lucide-react'
import { adminApi } from '@/services/api'
import { toman } from '@/utils/format'
import { AdminPageHeader, AdminTable, AdminEditButton, AdminDeleteButton } from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'
import { useConfirm } from '@/components/common/ConfirmProvider'

const emptyForm = () => ({
  name: '',
  slug: '',
  category: '',
  price_toman: '',
  discount_percent: '',
  stock: 10,
  short_description: '',
  description: '',
  is_active: true,
  is_featured: false,
})

function discountPercentFromCompare(price, compareAt) {
  const p = Number(price)
  const c = Number(compareAt)
  if (!p || !c || c <= p) return ''
  return String(Math.round((1 - p / c) * 100))
}

function compareAtFromDiscount(price, percent) {
  const p = Number(price)
  const d = Number(percent)
  if (!p || !d || d <= 0 || d >= 100) return null
  return Math.round(p / (1 - d / 100))
}

let keySeq = 1
const nextKey = () => `k${keySeq++}`

function buildVariantRows(colors, sizes, prev = []) {
  const prevMap = new Map(prev.map((v) => [v._combo, v]))
  const rows = []
  if (!colors.length && !sizes.length) return []
  if (colors.length && sizes.length) {
    for (const c of colors) {
      for (const s of sizes) {
        const combo = `${c.key}|${s.key}`
        const old = prevMap.get(combo)
        rows.push({
          key: old?.key || nextKey(),
          _combo: combo,
          color_key: c.key,
          size_key: s.key,
          color_id: c.id || null,
          size_id: s.id || null,
          color_name: c.name,
          size_name: s.name,
          price_toman: old?.price_toman ?? '',
          stock: old?.stock ?? 0,
          is_active: old?.is_active !== false,
        })
      }
    }
  } else if (colors.length) {
    for (const c of colors) {
      const combo = `${c.key}|`
      const old = prevMap.get(combo)
      rows.push({
        key: old?.key || nextKey(),
        _combo: combo,
        color_key: c.key,
        size_key: '',
        color_id: c.id || null,
        size_id: null,
        color_name: c.name,
        size_name: '',
        price_toman: old?.price_toman ?? '',
        stock: old?.stock ?? 0,
        is_active: old?.is_active !== false,
      })
    }
  } else {
    for (const s of sizes) {
      const combo = `|${s.key}`
      const old = prevMap.get(combo)
      rows.push({
        key: old?.key || nextKey(),
        _combo: combo,
        color_key: '',
        size_key: s.key,
        color_id: null,
        size_id: s.id || null,
        color_name: '',
        size_name: s.name,
        price_toman: old?.price_toman ?? '',
        stock: old?.stock ?? 0,
        is_active: old?.is_active !== false,
      })
    }
  }
  return rows
}

export default function AdminProductsPage() {
  const confirm = useConfirm()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [colors, setColors] = useState([])
  const [sizes, setSizes] = useState([])
  const [variants, setVariants] = useState([])
  const [attributes, setAttributes] = useState([])
  const [existingImages, setExistingImages] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rowBusy, setRowBusy] = useState('')
  const [error, setError] = useState('')
  const [tableError, setTableError] = useState('')

  const load = () => {
    adminApi.products.list().then((r) => setProducts(r.data.results || r.data))
    adminApi.categories.list().then((r) => setCategories(r.data.results || r.data))
  }

  useEffect(() => {
    load()
  }, [])

  const patchLocal = (slug, patch) => {
    setProducts((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p)),
    )
  }

  const toggleActive = async (p) => {
    if (rowBusy) return
    setTableError('')
    setRowBusy(p.slug)
    const next = !p.is_active
    patchLocal(p.slug, { is_active: next })
    try {
      const { data } = await adminApi.products.update(p.slug, { is_active: next })
      patchLocal(p.slug, {
        is_active: data.is_active,
        in_stock: data.in_stock,
        stock: data.stock,
      })
    } catch (err) {
      patchLocal(p.slug, { is_active: p.is_active })
      setTableError(err.response?.data?.detail || 'خطا در تغییر وضعیت')
    } finally {
      setRowBusy('')
    }
  }

  const toggleInStock = async (p) => {
    if (rowBusy) return
    setTableError('')
    setRowBusy(p.slug)
    const next = !p.in_stock
    const nextStock = next ? Math.max(Number(p.stock) || 0, 1) : 0
    patchLocal(p.slug, { in_stock: next, stock: nextStock })
    try {
      let data
      if (p.has_options) {
        const detail = (await adminApi.products.get(p.slug)).data
        data = (
          await adminApi.products.update(p.slug, {
            variants: (detail.variants || []).map((v) => ({
              color_id: v.color || undefined,
              size_id: v.size || undefined,
              price_toman: v.price_toman,
              stock: next ? Math.max(Number(v.stock) || 0, 1) : 0,
              is_active: v.is_active !== false,
            })),
          })
        ).data
      } else {
        data = (await adminApi.products.update(p.slug, { stock: nextStock })).data
      }
      // Keep intended availability — detail response can lag on related stock
      patchLocal(p.slug, {
        is_active: data.is_active ?? p.is_active,
        in_stock: next,
        stock: data.stock ?? nextStock,
      })
    } catch (err) {
      patchLocal(p.slug, { in_stock: p.in_stock, stock: p.stock })
      setTableError(err.response?.data?.detail || 'خطا در تغییر موجودی')
    } finally {
      setRowBusy('')
    }
  }
  const newFilePreviews = useMemo(
    () => newFiles.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [newFiles],
  )

  useEffect(() => {
    return () => newFilePreviews.forEach((p) => URL.revokeObjectURL(p.url))
  }, [newFilePreviews])

  const resetExtras = () => {
    setColors([])
    setSizes([])
    setVariants([])
    setAttributes([])
    setExistingImages([])
    setNewFiles([])
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    resetExtras()
    setError('')
    setOpen(true)
  }

  const openEdit = async (p) => {
    setError('')
    setLoading(true)
    try {
      const { data } = await adminApi.products.get(p.slug)
      setEditing(data)
      setForm({
        name: data.name || '',
        slug: data.slug || '',
        category: data.category || '',
        price_toman: data.price_toman ?? '',
        discount_percent: discountPercentFromCompare(
          data.price_toman,
          data.compare_at_price_toman,
        ),
        stock: data.stock ?? 0,
        short_description: data.short_description || '',
        description: data.description || '',
        is_active: data.is_active !== false,
        is_featured: !!data.is_featured,
      })
      const cols = (data.colors || []).map((c, i) => ({
        key: nextKey(),
        id: c.id,
        name: c.name,
        hex_code: c.hex_code || '',
        sort_order: i,
      }))
      const szs = (data.sizes || []).map((s, i) => ({
        key: nextKey(),
        id: s.id,
        name: s.name,
        sort_order: i,
      }))
      setColors(cols)
      setSizes(szs)
      const colorById = Object.fromEntries(cols.map((c) => [c.id, c]))
      const sizeById = Object.fromEntries(szs.map((s) => [s.id, s]))
      const prev = (data.variants || []).map((v) => {
        const ck = v.color ? colorById[v.color]?.key : ''
        const sk = v.size ? sizeById[v.size]?.key : ''
        return {
          key: nextKey(),
          _combo: `${ck}|${sk}`,
          color_key: ck,
          size_key: sk,
          color_id: v.color,
          size_id: v.size,
          color_name: colorById[v.color]?.name || '',
          size_name: sizeById[v.size]?.name || '',
          price_toman: v.price_toman ?? '',
          stock: v.stock ?? 0,
          is_active: v.is_active !== false,
        }
      })
      setVariants(buildVariantRows(cols, szs, prev))
      setAttributes(
        (data.attributes || []).map((a) => ({
          key: nextKey(),
          name: a.name,
          value: a.value,
        })),
      )
      setExistingImages(data.images || [])
      setNewFiles([])
      setOpen(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'خطا در بارگذاری محصول')
    } finally {
      setLoading(false)
    }
  }

  const close = () => {
    if (loading) return
    setOpen(false)
  }

  const setColorsAndRebuild = (next) => {
    setColors(next)
    setVariants((prev) => buildVariantRows(next, sizes, prev))
  }

  const setSizesAndRebuild = (next) => {
    setSizes(next)
    setVariants((prev) => buildVariantRows(colors, next, prev))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { discount_percent, ...formFields } = form
    const compareAt = compareAtFromDiscount(form.price_toman, discount_percent)
    const payload = {
      ...formFields,
      category: Number(form.category),
      price_toman: Number(form.price_toman),
      compare_at_price_toman: compareAt,
      stock: Number(form.stock) || 0,
      slug: form.slug || form.name.replace(/\s+/g, '-'),
      colors: colors
        .filter((c) => c.name.trim())
        .map((c, i) => ({
          id: c.id || undefined,
          key: c.key,
          name: c.name.trim(),
          hex_code: c.hex_code || '',
          sort_order: i,
        })),
      sizes: sizes
        .filter((s) => s.name.trim())
        .map((s, i) => ({
          id: s.id || undefined,
          key: s.key,
          name: s.name.trim(),
          sort_order: i,
        })),
      variants: variants.map((v) => ({
        color_key: v.color_key || undefined,
        size_key: v.size_key || undefined,
        color_id: v.color_id || undefined,
        size_id: v.size_id || undefined,
        price_toman: v.price_toman === '' || v.price_toman == null ? null : Number(v.price_toman),
        stock: Number(v.stock) || 0,
        is_active: v.is_active !== false,
      })),
      attributes: attributes
        .filter((a) => a.name.trim() && a.value.trim())
        .map((a, i) => ({ name: a.name.trim(), value: a.value.trim(), sort_order: i })),
    }
    try {
      let slug = editing?.slug
      if (editing) {
        const { data } = await adminApi.products.update(editing.slug, payload)
        slug = data.slug
      } else {
        const { data } = await adminApi.products.create(payload)
        slug = data.slug
      }
      if (newFiles.length && slug) {
        await adminApi.products.uploadImages(slug, newFiles)
      }
      setOpen(false)
      load()
    } catch (err) {
      setError(
        typeof err.response?.data === 'object'
          ? JSON.stringify(err.response.data)
          : err.message || 'خطا در ذخیره',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="محصولات"
        description="تصاویر، رنگ، سایز، قیمت تنوع و ویژگی‌ها"
        actions={
          <button type="button" className="btn-primary cursor-pointer" onClick={openCreate}>
            افزودن محصول
          </button>
        }
      />

      {tableError && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{tableError}</p>
      )}

      <AdminTable columns={['نام', 'قیمت', 'تخفیف', 'موجودی', 'وضعیت', '']}>
        {products.map((p) => {
          const disc = discountPercentFromCompare(
            p.min_price ?? p.price_toman,
            p.compare_at_price_toman,
          )
          const busy = rowBusy === p.slug
          return (
          <tr key={p.id} className="border-t border-mist-100 transition hover:bg-mist-50/80">
            <td className="px-4 py-3 font-medium">{p.name}</td>
            <td className="px-4 py-3">
              {p.has_options && p.min_price != null && p.min_price !== p.price_toman
                ? `از ${toman(p.min_price)}`
                : toman(p.price_toman)}
            </td>
            <td className="px-4 py-3">
              {disc ? (
                <span className="rounded-lg bg-copper-50 px-2 py-1 text-xs font-semibold text-copper-600">
                  ٪{disc}
                </span>
              ) : (
                <span className="text-ink-700/35">—</span>
              )}
            </td>
            <td className="px-4 py-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleInStock(p)}
                title={p.in_stock ? 'کلیک برای ناموجود کردن' : 'کلیک برای موجود کردن'}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:cursor-wait disabled:opacity-60 ${
                  p.in_stock
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                {p.in_stock ? 'موجود' : 'ناموجود'}
              </button>
            </td>
            <td className="px-4 py-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleActive(p)}
                title={p.is_active ? 'کلیک برای غیرفعال کردن' : 'کلیک برای فعال کردن'}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:cursor-wait disabled:opacity-60 ${
                  p.is_active
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-mist-100 text-ink-700/50 hover:bg-mist-200'
                }`}
              >
                {p.is_active ? 'فعال' : 'غیرفعال'}
              </button>
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center justify-end gap-1">
                <AdminEditButton onClick={() => openEdit(p)} />
                <AdminDeleteButton
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'حذف محصول',
                      description: `آیا از حذف «${p.name}» مطمئن هستید؟`,
                      confirmLabel: 'حذف محصول',
                    })
                    if (!ok) return
                    await adminApi.products.remove(p.slug)
                    load()
                  }}
                />
              </div>
            </td>
          </tr>
          )
        })}
      </AdminTable>

      <AdminModal
        open={open}
        onClose={close}
        title={editing ? 'ویرایش محصول' : 'افزودن محصول'}
        description="رنگ و سایز اختیاری‌اند؛ برای هر ترکیب می‌توانید قیمت جدا بگذارید یا خالی بگذارید تا قیمت پایه استفاده شود"
        size="xl"
        footer={
          <>
            <ModalCancelButton onClick={close} />
            <ModalSubmitButton form="product-form" loading={loading}>
              {editing ? 'ذخیره تغییرات' : 'افزودن'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="product-form" onSubmit={submit} className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">نام محصول</span>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="block">
              <span className="label">اسلاگ</span>
              <input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="خودکار از نام" />
            </label>
            <label className="block">
              <span className="label">دسته‌بندی</span>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                <option value="">انتخاب کنید</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">قیمت پایه (تومان)</span>
              <input
                className="input"
                type="number"
                min="0"
                value={form.price_toman}
                onChange={(e) => setForm({ ...form, price_toman: e.target.value })}
                required
              />
            </label>
            <label className="block">
              <span className="label">درصد تخفیف</span>
              <input
                className="input"
                type="number"
                min="0"
                max="99"
                step="1"
                value={form.discount_percent}
                onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                placeholder="مثلاً ۱۵"
              />
              {(() => {
                const before = compareAtFromDiscount(form.price_toman, form.discount_percent)
                if (!before) return null
                return (
                  <span className="mt-1 block text-[11px] text-ink-700/45">
                    قیمت قبل تخفیف: {toman(before)}
                  </span>
                )
              })()}
            </label>
            <label className="block">
              <span className="label">موجودی پایه</span>
              <input className="input" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              <span className="mt-1 block text-[11px] text-ink-700/40">اگر رنگ/سایز تعریف شود، موجودی از جدول تنوع خوانده می‌شود</span>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">توضیح کوتاه</span>
              <input className="input" value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">توضیحات</span>
              <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
              محصول ویژه
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              فعال
            </label>
          </section>

          {/* Images */}
          <section className="border-t border-mist-100 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-ink-900">تصاویر محصول</h3>
              <label className="btn-secondary inline-flex cursor-pointer items-center gap-1.5 text-xs">
                <ImagePlus className="h-4 w-4" />
                افزودن تصویر
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = [...(e.target.files || [])]
                    if (files.length) setNewFiles((prev) => [...prev, ...files])
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              {existingImages.map((img) => (
                <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-mist-200">
                  <img src={img.image} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute left-1 top-1 rounded-md bg-ink-950/70 p-0.5 text-white"
                    onClick={async () => {
                      if (!editing) return
                      await adminApi.products.deleteImage(editing.slug, img.id)
                      setExistingImages((prev) => prev.filter((x) => x.id !== img.id))
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {newFilePreviews.map((p, i) => (
                <div key={p.url} className="relative h-20 w-20 overflow-hidden rounded-xl border border-copper-400/40">
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    className="absolute left-1 top-1 rounded-md bg-ink-950/70 p-0.5 text-white"
                    onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {!existingImages.length && !newFiles.length && (
                <p className="text-xs text-ink-700/40">هنوز تصویری اضافه نشده</p>
              )}
            </div>
          </section>

          {/* Colors */}
          <section className="border-t border-mist-100 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-ink-900">رنگ‌ها</h3>
                <p className="text-xs text-ink-700/45">اختیاری — می‌توانید بدون رنگ بگذارید</p>
              </div>
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-1 text-xs"
                onClick={() => setColorsAndRebuild([...colors, { key: nextKey(), name: '', hex_code: '#000000' }])}
              >
                <Plus className="h-3.5 w-3.5" /> رنگ
              </button>
            </div>
            <div className="space-y-2">
              {colors.map((c, idx) => (
                <div key={c.key} className="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    className="h-10 w-12 cursor-pointer rounded-lg border border-mist-200 bg-white p-1"
                    value={c.hex_code || '#000000'}
                    onChange={(e) => {
                      const next = [...colors]
                      next[idx] = { ...c, hex_code: e.target.value }
                      setColors(next)
                    }}
                  />
                  <input
                    className="input max-w-xs flex-1"
                    placeholder="نام رنگ"
                    value={c.name}
                    onChange={(e) => {
                      const next = [...colors]
                      next[idx] = { ...c, name: e.target.value }
                      setColorsAndRebuild(next)
                    }}
                  />
                  <button
                    type="button"
                    className="text-red-500"
                    onClick={() => setColorsAndRebuild(colors.filter((_, i) => i !== idx))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Sizes */}
          <section className="border-t border-mist-100 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-ink-900">سایزها</h3>
                <p className="text-xs text-ink-700/45">اختیاری — مثلاً S / M / L یا ۴۲</p>
              </div>
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-1 text-xs"
                onClick={() => setSizesAndRebuild([...sizes, { key: nextKey(), name: '' }])}
              >
                <Plus className="h-3.5 w-3.5" /> سایز
              </button>
            </div>
            <div className="space-y-2">
              {sizes.map((s, idx) => (
                <div key={s.key} className="flex items-center gap-2">
                  <input
                    className="input max-w-xs flex-1"
                    placeholder="نام سایز"
                    value={s.name}
                    onChange={(e) => {
                      const next = [...sizes]
                      next[idx] = { ...s, name: e.target.value }
                      setSizesAndRebuild(next)
                    }}
                  />
                  <button
                    type="button"
                    className="text-red-500"
                    onClick={() => setSizesAndRebuild(sizes.filter((_, i) => i !== idx))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Variant prices */}
          {variants.length > 0 && (
            <section className="border-t border-mist-100 pt-5">
              <h3 className="mb-1 font-semibold text-ink-900">قیمت و موجودی تنوع‌ها</h3>
              <p className="mb-3 text-xs text-ink-700/45">
                قیمت خالی = قیمت پایه ({form.price_toman ? toman(Number(form.price_toman) || 0) : '—'})
              </p>
              <div className="overflow-x-auto rounded-xl border border-mist-200">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-mist-50 text-right text-ink-700/55">
                    <tr>
                      <th className="px-3 py-2 font-medium">ترکیب</th>
                      <th className="px-3 py-2 font-medium">قیمت</th>
                      <th className="px-3 py-2 font-medium">موجودی</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, idx) => (
                      <tr key={v.key} className="border-t border-mist-100">
                        <td className="px-3 py-2">
                          {[v.color_name, v.size_name].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="input"
                            type="number"
                            placeholder="پایه"
                            value={v.price_toman}
                            onChange={(e) => {
                              const next = [...variants]
                              next[idx] = { ...v, price_toman: e.target.value }
                              setVariants(next)
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="input"
                            type="number"
                            value={v.stock}
                            onChange={(e) => {
                              const next = [...variants]
                              next[idx] = { ...v, stock: e.target.value }
                              setVariants(next)
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Attributes */}
          <section className="border-t border-mist-100 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-ink-900">ویژگی‌ها</h3>
                <p className="text-xs text-ink-700/45">مثل گارانتی، جنس، وزن…</p>
              </div>
              <button
                type="button"
                className="btn-secondary inline-flex items-center gap-1 text-xs"
                onClick={() => setAttributes([...attributes, { key: nextKey(), name: '', value: '' }])}
              >
                <Plus className="h-3.5 w-3.5" /> ویژگی
              </button>
            </div>
            <div className="space-y-2">
              {attributes.map((a, idx) => (
                <div key={a.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    className="input"
                    placeholder="نام ویژگی"
                    value={a.name}
                    onChange={(e) => {
                      const next = [...attributes]
                      next[idx] = { ...a, name: e.target.value }
                      setAttributes(next)
                    }}
                  />
                  <input
                    className="input"
                    placeholder="مقدار"
                    value={a.value}
                    onChange={(e) => {
                      const next = [...attributes]
                      next[idx] = { ...a, value: e.target.value }
                      setAttributes(next)
                    }}
                  />
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center text-red-500"
                    onClick={() => setAttributes(attributes.filter((_, i) => i !== idx))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      </AdminModal>
    </div>
  )
}
