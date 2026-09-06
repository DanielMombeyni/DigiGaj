import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  X,
  ImagePlus,
  ImageOff,
  FolderOpen,
  FolderX,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Package,
  Layers,
  Search,
  ChevronsUpDown,
} from 'lucide-react'
import { adminApi } from '@/services/api'
import { faDigits, toman } from '@/utils/format'
import { mediaSrc } from '@/utils/media'
import {
  AdminPageHeader,
  AdminTable,
  AdminEditButton,
  AdminDeleteButton,
  AdminStatCard,
} from '@/components/dashboard/AdminUI'
import AdminModal, { ModalCancelButton, ModalSubmitButton } from '@/components/dashboard/AdminModal'
import ProductImageLightbox from '@/components/dashboard/ProductImageLightbox'
import { useConfirm } from '@/components/common/ConfirmProvider'
import { categorySelectOptions } from '@/utils/categories'
import { fetchAllPages } from '@/utils/pagination'
import LoadingScreen from '@/components/common/LoadingScreen'

const emptyForm = () => ({
  name: '',
  slug: '',
  category: '',
  price_toman: '',
  discount_percent: '',
  price_on_request: false,
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

const UNCATEGORIZED_KEY = 'uncategorized'
const GROUP_PAGE_SIZE = 20

function buildGroupMeta(categories, counts) {
  const ordered = []
  const catOpts = categorySelectOptions(categories)
  const used = new Set()

  for (const opt of catOpts) {
    const key = String(opt.id)
    const count = Number(counts[key]) || 0
    if (!count) continue
    used.add(key)
    ordered.push({
      key,
      categoryId: opt.id,
      title: opt.label.replace(/^—+\s*/, ''),
      depth: opt.depth || 0,
      fullLabel: opt.label,
      count,
    })
  }

  for (const [key, raw] of Object.entries(counts)) {
    const count = Number(raw) || 0
    if (!count || key === UNCATEGORIZED_KEY || used.has(key)) continue
    ordered.push({
      key,
      categoryId: Number(key) || null,
      title: `دسته #${key}`,
      depth: 0,
      fullLabel: `دسته #${key}`,
      count,
    })
  }

  const uncategorizedCount = Number(counts[UNCATEGORIZED_KEY]) || 0
  if (uncategorizedCount) {
    ordered.push({
      key: UNCATEGORIZED_KEY,
      categoryId: null,
      title: 'بدون دسته‌بندی',
      depth: 0,
      fullLabel: 'بدون دسته‌بندی',
      count: uncategorizedCount,
      uncategorized: true,
    })
  }

  return ordered
}

function groupListParams(key, page) {
  const params = { page, page_size: GROUP_PAGE_SIZE }
  if (key === UNCATEGORIZED_KEY) params.uncategorized = true
  else params.category_exact = key
  return params
}

function ProductRow({ p, busy, onOpenGallery, onToggleInStock, onToggleActive, onEdit, onDelete }) {
  const disc = discountPercentFromCompare(p.min_price ?? p.price_toman, p.compare_at_price_toman)
  const thumb = p.primary_image || p.images?.[0]?.image
  const galleryImages =
    Array.isArray(p.images) && p.images.length
      ? [...p.images].sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1
          if (!a.is_primary && b.is_primary) return 1
          return (a.sort_order || 0) - (b.sort_order || 0)
        })
      : thumb
        ? [{ image: thumb, is_primary: true }]
        : []

  return (
    <tr className="border-t border-mist-100/90 transition hover:bg-gradient-to-l hover:from-mist-50/90 hover:to-transparent">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          {thumb ? (
            <button
              type="button"
              className="group relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-mist-200 bg-mist-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400"
              onClick={() =>
                onOpenGallery({
                  title: p.name,
                  images: galleryImages,
                  startIndex: 0,
                })
              }
              aria-label={`مشاهده تصاویر ${p.name}`}
              title="مشاهده تصاویر"
            >
              <img
                src={mediaSrc(thumb)}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
                loading="lazy"
              />
              {galleryImages.length > 1 && (
                <span className="absolute inset-x-0 bottom-0 bg-ink-950/75 py-0.5 text-center text-[9px] font-bold text-white">
                  {faDigits(galleryImages.length)}
                </span>
              )}
            </button>
          ) : (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-mist-200 bg-mist-50 text-ink-700/30"
              aria-hidden
            >
              <ImageOff className="h-4 w-4" strokeWidth={1.75} />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-semibold text-ink-900">{p.name}</span>
              {p.is_featured ? (
                <span className="rounded-md bg-copper-50 px-1.5 py-0.5 text-[10px] font-bold text-copper-600">
                  ویژه
                </span>
              ) : null}
            </div>
            {p.slug ? (
              <div className="mt-0.5 truncate text-[11px] text-ink-700/40" dir="ltr">
                {p.slug}
              </div>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        {p.price_on_request || Number(p.price_toman) === 0 ? (
          <span className="inline-flex max-w-[11rem] rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium leading-4 text-amber-800">
            قیمت با تماس
          </span>
        ) : p.has_options && p.min_price != null && p.min_price !== p.price_toman ? (
          <span className="tabular-nums text-ink-800">از {toman(p.min_price)}</span>
        ) : (
          <span className="font-semibold tabular-nums text-ink-900">{toman(p.price_toman)}</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        {disc ? (
          <span className="inline-flex rounded-full bg-copper-500/10 px-2.5 py-1 text-xs font-bold text-copper-600">
            ٪{faDigits(disc)}
          </span>
        ) : (
          <span className="text-ink-700/30">—</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleInStock(p)}
          title={p.in_stock ? 'کلیک برای ناموجود کردن' : 'کلیک برای موجود کردن'}
          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
            p.in_stock
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/70 hover:bg-amber-100'
          }`}
        >
          {p.in_stock ? 'موجود' : 'ناموجود'}
        </button>
      </td>
      <td className="px-4 py-3.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleActive(p)}
          title={p.is_active ? 'کلیک برای غیرفعال کردن' : 'کلیک برای فعال کردن'}
          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
            p.is_active
              ? 'bg-sea-500/10 text-sea-600 ring-1 ring-sea-500/20 hover:bg-sea-500/15'
              : 'bg-mist-100 text-ink-700/45 ring-1 ring-mist-200 hover:bg-mist-200'
          }`}
        >
          {p.is_active ? 'فعال' : 'غیرفعال'}
        </button>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1">
          <AdminEditButton onClick={() => onEdit(p)} />
          <AdminDeleteButton onClick={() => onDelete(p)} />
        </div>
      </td>
    </tr>
  )
}

function firstFormError(data) {
  if (!data) return 'خطا در ذخیره'
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.filter(Boolean).join(' — ') || 'خطا در ذخیره'
  if (typeof data !== 'object') return String(data)
  if (data.detail) return firstFormError(data.detail)
  const [key, val] = Object.entries(data)[0] || []
  if (!key) return 'خطا در ذخیره'
  const msg = firstFormError(val)
  return key === 'non_field_errors' ? msg : `${key}: ${msg}`
}

export default function AdminProductsPage() {
  const confirm = useConfirm()
  const formReqId = useRef(0)
  const [categories, setCategories] = useState([])
  const [counts, setCounts] = useState({})
  const [totalProducts, setTotalProducts] = useState(0)
  const [groupData, setGroupData] = useState({})
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
  const [gallery, setGallery] = useState(null)
  const [error, setError] = useState('')
  const [tableError, setTableError] = useState('')
  const [expanded, setExpanded] = useState({})
  const [listLoading, setListLoading] = useState(true)
  const [groupQuery, setGroupQuery] = useState('')

  const groups = useMemo(() => buildGroupMeta(categories, counts), [categories, counts])
  const uncategorizedCount = Number(counts[UNCATEGORIZED_KEY]) || 0

  const visibleGroups = useMemo(() => {
    const q = groupQuery.trim()
    if (!q) return groups
    return groups.filter((g) => g.fullLabel.includes(q) || g.title.includes(q))
  }, [groups, groupQuery])

  const loadMeta = ({ soft = false } = {}) => {
    if (!soft) setListLoading(true)
    setTableError('')
    Promise.all([
      fetchAllPages((params) => adminApi.categories.list(params), {}, { pageSize: 200 }),
      adminApi.products.categoryCounts(),
    ])
      .then(([categoryRows, countsRes]) => {
        setCategories(categoryRows)
        setCounts(countsRes.data?.counts || {})
        setTotalProducts(Number(countsRes.data?.total) || 0)
      })
      .catch((err) => {
        setTableError(err.response?.data?.detail || 'خطا در بارگذاری محصولات')
      })
      .finally(() => {
        if (!soft) setListLoading(false)
      })
  }

  const loadGroup = async (key, page = 1) => {
    setGroupData((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), page, loading: true },
    }))
    try {
      const { data } = await adminApi.products.list(groupListParams(key, page))
      const results = data.results || data || []
      const count = typeof data.count === 'number' ? data.count : results.length
      setGroupData((prev) => ({
        ...prev,
        [key]: { page, results, count, loading: false },
      }))
      setCounts((prev) => ({ ...prev, [key]: count }))
    } catch (err) {
      setGroupData((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), page, loading: false, results: prev[key]?.results || [] },
      }))
      setTableError(err.response?.data?.detail || 'خطا در بارگذاری محصولات دسته')
    }
  }

  const load = () => {
    setGroupData({})
    setExpanded({})
    loadMeta()
  }

  useEffect(() => {
    loadMeta()
  }, [])

  const toggleGroup = (key) => {
    const willOpen = !expanded[key]
    setExpanded((prev) => ({ ...prev, [key]: willOpen }))
    if (willOpen) loadGroup(key, groupData[key]?.page || 1)
  }

  const expandAll = () => {
    const next = {}
    for (const g of visibleGroups) {
      next[g.key] = true
      if (!groupData[g.key]?.results) loadGroup(g.key, 1)
    }
    setExpanded((prev) => ({ ...prev, ...next }))
  }

  const collapseAll = () => {
    setExpanded({})
  }

  const patchLocal = (slug, patch) => {
    setGroupData((prev) => {
      const next = { ...prev }
      for (const [key, bucket] of Object.entries(prev)) {
        if (!bucket?.results?.length) continue
        const idx = bucket.results.findIndex((p) => p.slug === slug)
        if (idx === -1) continue
        const results = [...bucket.results]
        results[idx] = { ...results[idx], ...patch }
        next[key] = { ...bucket, results }
      }
      return next
    })
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
    formReqId.current += 1
    setLoading(false)
    setEditing(null)
    setForm(emptyForm())
    resetExtras()
    setError('')
    setOpen(true)
  }

  const openEdit = async (p) => {
    const reqId = ++formReqId.current
    setError('')
    setLoading(true)
    try {
      const { data } = await adminApi.products.get(p.slug)
      if (reqId !== formReqId.current) return
      setEditing(data)
      const onRequest =
        Boolean(data.price_on_request) || Number(data.price_toman) === 0
      setForm({
        name: data.name || '',
        slug: data.slug || '',
        category: data.category || '',
        price_on_request: onRequest,
        price_toman: onRequest ? '' : (data.price_toman ?? ''),
        discount_percent: onRequest
          ? ''
          : discountPercentFromCompare(data.price_toman, data.compare_at_price_toman),
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
      if (reqId !== formReqId.current) return
      setError(err.response?.data?.detail || 'خطا در بارگذاری محصول')
    } finally {
      if (reqId === formReqId.current) setLoading(false)
    }
  }

  const close = () => {
    if (loading) return
    formReqId.current += 1
    setOpen(false)
    setError('')
  }

  const submitProductForm = () => {
    const el = document.getElementById('product-form')
    if (!el) return
    if (typeof el.checkValidity === 'function' && !el.checkValidity()) {
      el.reportValidity?.()
      el.querySelector?.(':invalid')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      return
    }
    if (typeof el.requestSubmit === 'function') {
      el.requestSubmit()
      return
    }
    el.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
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
    const compareAt = form.price_on_request
      ? null
      : compareAtFromDiscount(form.price_toman, discount_percent)
    if (!form.price_on_request && !(Number(form.price_toman) > 0)) {
      setError('قیمت باید بیشتر از صفر باشد')
      setLoading(false)
      return
    }
    const payload = {
      ...formFields,
      category: form.category ? Number(form.category) : null,
      price_on_request: Boolean(form.price_on_request),
      price_toman: form.price_on_request ? 0 : Number(form.price_toman),
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
        price_toman:
          form.price_on_request || v.price_toman === '' || v.price_toman == null
            ? null
            : Number(v.price_toman),
        stock: Number(v.stock) || 0,
        is_active: v.is_active !== false,
      })),
      attributes: attributes
        .filter((a) => a.name.trim() && a.value.trim())
        .map((a, i) => ({ name: a.name.trim(), value: a.value.trim(), sort_order: i })),
    }
    // Ensure boolean is never dropped / stringified oddly
    payload.price_on_request = form.price_on_request === true
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
      setError(firstFormError(err.response?.data) || err.message || 'خطا در ذخیره')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <AdminPageHeader
        title="محصولات"
        description="مدیریت کاتالوگ به‌تفکیک دسته — باز کنید، ویرایش کنید، صفحه‌بندی کنید"
        actions={
          <button
            type="button"
            className="btn-primary inline-flex cursor-pointer items-center gap-2"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            افزودن محصول
          </button>
        }
      />

      {!listLoading && groups.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminStatCard
            label="کل محصولات"
            value={faDigits(totalProducts)}
            hint="فعال و غیرفعال"
            accent="copper"
          />
          <AdminStatCard
            label="گروه‌های دارای محصول"
            value={faDigits(groups.length)}
            hint="دسته‌ها و زیردسته‌ها"
            accent="sea"
          />
          <AdminStatCard
            label="بدون دسته‌بندی"
            value={faDigits(uncategorizedCount)}
            hint={uncategorizedCount ? 'نیاز به تخصیص دسته' : 'همه دسته‌بندی شده‌اند'}
            accent={uncategorizedCount ? 'amber' : 'emerald'}
          />
        </div>
      )}

      {tableError && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{tableError}</p>
      )}

      {listLoading ? (
        <LoadingScreen variant="page" label="در حال بارگذاری دسته‌بندی‌ها..." />
      ) : !groups.length ? (
        <div className="relative overflow-hidden rounded-3xl border border-dashed border-mist-200 bg-gradient-to-bl from-mist-50 to-surface px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-950 text-copper-400">
            <Package className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <p className="mt-4 font-display text-lg font-bold text-ink-900">هنوز محصولی ثبت نشده</p>
          <p className="mt-2 text-sm text-ink-700/50">اولین محصول را اضافه کنید تا گروه‌ها اینجا ساخته شوند.</p>
          <button type="button" className="btn-primary mt-6 cursor-pointer" onClick={openCreate}>
            افزودن محصول
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-mist-200/80 bg-surface/90 p-3 shadow-soft backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">جستجوی دسته</span>
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-700/35" />
              <input
                className="input w-full !pr-10"
                placeholder="جستجو در نام دسته‌ها..."
                value={groupQuery}
                onChange={(e) => setGroupQuery(e.target.value)}
              />
            </label>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={expandAll}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-mist-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700/70 transition hover:border-copper-400/40 hover:text-copper-600"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={2} />
                باز کردن همه
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-mist-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700/70 transition hover:border-mist-300 hover:text-ink-900"
              >
                بستن همه
              </button>
            </div>
          </div>

          {!visibleGroups.length ? (
            <div className="rounded-2xl border border-dashed border-mist-200 bg-mist-50/50 px-4 py-10 text-center text-sm text-ink-700/50">
              دسته‌ای با این جستجو پیدا نشد.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleGroups.map((group, idx) => {
                const isOpen = Boolean(expanded[group.key])
                const bucket = groupData[group.key]
                const items = bucket?.results || []
                const total = bucket?.count ?? group.count
                const page = bucket?.page || 1
                const totalPages = Math.max(1, Math.ceil(total / GROUP_PAGE_SIZE) || 1)
                const groupLoading = Boolean(bucket?.loading)
                return (
                  <section
                    key={group.key}
                    className={`group/acc overflow-hidden rounded-2xl border shadow-soft transition duration-300 ${
                      group.uncategorized
                        ? 'border-amber-200/90 bg-gradient-to-l from-amber-50/80 to-surface'
                        : isOpen
                          ? 'border-copper-400/30 bg-surface ring-1 ring-copper-400/15'
                          : 'border-mist-200/80 bg-surface hover:border-mist-300'
                    }`}
                    style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-start transition hover:bg-mist-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-copper-400 sm:px-5"
                      aria-expanded={isOpen}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
                            group.uncategorized
                              ? 'bg-amber-100 text-amber-700'
                              : isOpen
                                ? 'bg-ink-950 text-copper-400 shadow-[0_8px_20px_rgba(15,23,42,0.2)]'
                                : 'bg-mist-100 text-ink-700/55 group-hover/acc:bg-ink-950 group-hover/acc:text-copper-400'
                          }`}
                        >
                          {group.uncategorized ? (
                            <FolderX className="h-5 w-5" strokeWidth={1.75} />
                          ) : (
                            <FolderOpen className="h-5 w-5" strokeWidth={1.75} />
                          )}
                          {group.depth > 0 && !group.uncategorized ? (
                            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-sea-500" />
                          ) : null}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2
                              className={`truncate font-display text-sm font-bold sm:text-base ${
                                group.uncategorized ? 'text-amber-950' : 'text-ink-900'
                              }`}
                              style={
                                group.depth
                                  ? { paddingInlineStart: `${Math.min(group.depth, 4) * 0.5}rem` }
                                  : undefined
                              }
                            >
                              {group.fullLabel}
                            </h2>
                            {group.depth > 0 ? (
                              <span className="rounded-md bg-sea-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sea-600">
                                زیردسته
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[11px] text-ink-700/45">
                            {group.uncategorized
                              ? 'برای نمایش بهتر در فروشگاه، دسته انتخاب کنید'
                              : isOpen
                                ? `صفحه ${faDigits(page)} از ${faDigits(totalPages)}`
                                : 'برای دیدن محصولات کلیک کنید'}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                            group.uncategorized
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-mist-100 text-ink-700/65'
                          }`}
                        >
                          <Layers className="h-3 w-3 opacity-60" strokeWidth={2} />
                          {faDigits(group.count)}
                        </span>
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                            isOpen ? 'bg-copper-500/10 text-copper-600' : 'bg-mist-50 text-ink-700/35'
                          }`}
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition duration-300 ${isOpen ? 'rotate-180' : ''}`}
                            strokeWidth={2}
                          />
                        </span>
                      </div>
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                        isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        {groupLoading && !items.length ? (
                          <div className="space-y-2 border-t border-mist-100 px-4 py-5 sm:px-5">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <div key={i} className="h-14 animate-pulse rounded-xl bg-mist-100/80" />
                            ))}
                          </div>
                        ) : (
                          <>
                            <AdminTable embedded columns={['نام', 'قیمت', 'تخفیف', 'موجودی', 'وضعیت', '']}>
                              {items.map((p) => (
                                <ProductRow
                                  key={p.id}
                                  p={p}
                                  busy={rowBusy === p.slug}
                                  onOpenGallery={setGallery}
                                  onToggleInStock={toggleInStock}
                                  onToggleActive={toggleActive}
                                  onEdit={openEdit}
                                  onDelete={async (product) => {
                                    const ok = await confirm({
                                      title: 'حذف محصول',
                                      description: `آیا از حذف «${product.name}» مطمئن هستید؟ در سفارش‌های قبلی نام محصول حفظ می‌شود.`,
                                      confirmLabel: 'حذف محصول',
                                    })
                                    if (!ok) return
                                    await adminApi.products.remove(product.slug)
                                    await loadGroup(group.key, page)
                                    loadMeta({ soft: true })
                                  }}
                                />
                              ))}
                            </AdminTable>
                            {totalPages > 1 && (
                              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist-100 bg-mist-50/40 px-4 py-3 sm:px-5">
                                <p className="text-[11px] text-ink-700/45">
                                  نمایش {faDigits(items.length)} از {faDigits(total)} محصول
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-mist-200 bg-white text-ink-700/60 transition hover:border-copper-400/40 hover:text-copper-600 disabled:cursor-not-allowed disabled:opacity-35"
                                    disabled={page <= 1 || groupLoading}
                                    onClick={() => loadGroup(group.key, page - 1)}
                                    aria-label="صفحه قبل"
                                  >
                                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                                  </button>
                                  <span className="min-w-[5.5rem] rounded-xl bg-white px-3 py-2 text-center text-xs font-bold tabular-nums text-ink-800 ring-1 ring-mist-200">
                                    {faDigits(page)} / {faDigits(totalPages)}
                                  </span>
                                  <button
                                    type="button"
                                    className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-mist-200 bg-white text-ink-700/60 transition hover:border-copper-400/40 hover:text-copper-600 disabled:cursor-not-allowed disabled:opacity-35"
                                    disabled={page >= totalPages || groupLoading}
                                    onClick={() => loadGroup(group.key, page + 1)}
                                    aria-label="صفحه بعد"
                                  >
                                    <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      )}

      <AdminModal
        open={open}
        onClose={close}
        title={editing ? 'ویرایش محصول' : 'افزودن محصول'}
        description="رنگ و سایز اختیاری‌اند؛ برای هر ترکیب می‌توانید قیمت جدا بگذارید یا خالی بگذارید تا قیمت پایه استفاده شود"
        size="xl"
        footer={
          <>
            {error ? (
              <p className="me-auto max-w-md text-start text-xs text-red-600 sm:text-sm">{error}</p>
            ) : null}
            <ModalCancelButton onClick={close} disabled={loading} />
            <ModalSubmitButton
              type="button"
              loading={loading}
              onClick={submitProductForm}
            >
              {editing ? 'ذخیره تغییرات' : 'افزودن'}
            </ModalSubmitButton>
          </>
        }
      >
        <form id="product-form" onSubmit={submit} className="space-y-6">
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
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
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">بدون دسته‌بندی</option>
                {categorySelectOptions(categories).map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer accent-copper-500"
                checked={Boolean(form.price_on_request)}
                onChange={(e) => {
                  const checked = e.target.checked
                  setForm((prev) => ({
                    ...prev,
                    price_on_request: checked,
                    discount_percent: checked ? '' : prev.discount_percent,
                    price_toman: checked ? '' : prev.price_toman,
                  }))
                }}
              />
              <span>
                قیمت ثابت ندارد — نمایش «به دلیل نوسان قیمت با ما تماس بگیرید»
              </span>
            </label>
            <label className="block">
              <span className="label">قیمت پایه (تومان)</span>
              <input
                className="input disabled:cursor-not-allowed disabled:bg-mist-50 disabled:text-ink-700/40"
                type="number"
                min="0"
                value={form.price_on_request ? '' : form.price_toman}
                onChange={(e) => setForm({ ...form, price_toman: e.target.value })}
                required={!form.price_on_request}
                disabled={Boolean(form.price_on_request)}
                placeholder={form.price_on_request ? 'قیمت پس از تماس اعلام می‌شود' : ''}
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
                disabled={form.price_on_request}
              />
              {(() => {
                if (form.price_on_request) return null
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
                  <img src={mediaSrc(img.image)} alt="" className="h-full w-full object-cover" />
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
        </form>
      </AdminModal>

      <ProductImageLightbox
        open={Boolean(gallery)}
        onClose={() => setGallery(null)}
        title={gallery?.title || ''}
        images={gallery?.images || []}
        startIndex={gallery?.startIndex || 0}
      />
    </div>
  )
}
