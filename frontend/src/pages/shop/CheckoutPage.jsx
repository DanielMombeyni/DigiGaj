import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MapPin,
  Package,
  Plus,
  User,
  UserRound,
  CreditCard,
  ChevronLeft,
} from 'lucide-react'
import { shopApi, paymentApi, accountApi } from '@/services/api'
import { useCartStore } from '@/store/cart'
import { useAuthStore } from '@/store/auth'
import { toman, faDigits } from '@/utils/format'
import { mediaSrc } from '@/utils/media'
import Seo from '@/components/common/Seo'

const emptyAddressForm = {
  label: '',
  full_name: '',
  phone: '',
  address: '',
  province: '',
  city: '',
  postal_code: '',
}

function fullName(first, last) {
  return `${first || ''} ${last || ''}`.trim()
}

function profileIsComplete(profile) {
  if (!profile) return false
  return Boolean(
    profile.first_name?.trim() &&
      profile.last_name?.trim() &&
      profile.phone?.trim(),
  )
}

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-mist-200/80 bg-white p-5 shadow-soft md:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mist-100 text-ink-700/70">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-semibold text-ink-900">{title}</h2>
          {subtitle && <p className="mt-1 text-xs leading-6 text-ink-700/55">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function ChoiceCard({ checked, onChange, label, name, value, children }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition ${
        checked
          ? 'border-copper-500 bg-copper-500/5 shadow-[0_0_0_1px_rgba(217,119,87,0.25)]'
          : 'border-mist-200 bg-mist-50/30 hover:border-copper-400/40 hover:bg-white'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-copper-500"
      />
      <span className="text-sm font-medium text-ink-900">{label}</span>
      {children}
    </label>
  )
}

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.total)
  const clear = useCartStore((s) => s.clear)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [maxAddresses, setMaxAddresses] = useState(5)
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [recipient, setRecipient] = useState('self')
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', phone: '' })
  const [otherForm, setOtherForm] = useState({ first_name: '', last_name: '', phone: '' })
  const [addressForm, setAddressForm] = useState(emptyAddressForm)
  const [showAddAddress, setShowAddAddress] = useState(false)
  const [notes, setNotes] = useState('')
  const [discountInput, setDiscountInput] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState(null)
  const [discountError, setDiscountError] = useState('')
  const [discountLoading, setDiscountLoading] = useState(false)
  const [gateways, setGateways] = useState([])
  const [gateway, setGateway] = useState('')
  const [loadingData, setLoadingData] = useState(true)
  const [activatingId, setActivatingId] = useState(null)
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [thumbnails, setThumbnails] = useState({})

  const cartTotal = total()
  const discountAmount = appliedDiscount?.discount_toman || 0
  const payableTotal = Math.max(cartTotal - discountAmount, 0)
  const needsProfileFields = recipient === 'self' && profile && !profileIsComplete(profile)
  const atAddressLimit = addresses.length >= maxAddresses
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId)
  const paymentAvailable = !loadingData && gateways.length > 0

  useEffect(() => {
    if (!user) {
      setLoadingData(false)
      return
    }
    setLoadingData(true)
    Promise.all([
      accountApi.profile.get(),
      accountApi.addresses.list(),
      paymentApi.gateways('web').catch(() => ({ data: { gateways: [] } })),
    ])
      .then(([profileRes, addrRes, gwRes]) => {
        const p = profileRes.data
        setProfile(p)
        setProfileForm({
          first_name: p.first_name || '',
          last_name: p.last_name || '',
          phone: p.phone || '',
        })
        setMaxAddresses(p.max_addresses || 5)
        const list = addrRes.data.results || addrRes.data || []
        setAddresses(list)
        const active = list.find((a) => a.is_active) || list[0]
        if (active) setSelectedAddressId(active.id)

        const gws = gwRes.data.gateways || []
        setGateways(gws)
        if (gws[0]) setGateway(gws[0].provider_type)
      })
      .finally(() => setLoadingData(false))
  }, [user])

  useEffect(() => {
    if (recipient !== 'self' || !profile) return
    setAddressForm((f) => ({
      ...f,
      full_name: fullName(profileForm.first_name, profileForm.last_name) || f.full_name,
      phone: profileForm.phone || f.phone,
    }))
  }, [recipient, profile, profileForm.first_name, profileForm.last_name, profileForm.phone])

  useEffect(() => {
    setAppliedDiscount(null)
    setDiscountError('')
  }, [cartTotal])

  useEffect(() => {
    items.forEach((item) => {
      if (item.primary_image) {
        setThumbnails((prev) =>
          prev[item.product_id] === item.primary_image
            ? prev
            : { ...prev, [item.product_id]: item.primary_image },
        )
        return
      }
      if (!item.slug) return
      shopApi
        .product(item.slug)
        .then((r) => {
          const img = r.data.primary_image || r.data.images?.[0]?.image
          if (img) {
            setThumbnails((prev) => ({ ...prev, [item.product_id]: img }))
          }
        })
        .catch(() => {})
    })
  }, [items])

  const applyDiscount = async () => {
    const code = discountInput.trim()
    if (!code) {
      setDiscountError('کد تخفیف را وارد کنید.')
      setAppliedDiscount(null)
      return
    }
    setDiscountLoading(true)
    setDiscountError('')
    try {
      const { data } = await shopApi.validateDiscount({
        code,
        amount_toman: cartTotal,
      })
      setAppliedDiscount({ code: data.code, discount_toman: data.discount_toman })
    } catch (err) {
      setAppliedDiscount(null)
      setDiscountError(err.response?.data?.detail || 'کد تخفیف نامعتبر است.')
    } finally {
      setDiscountLoading(false)
    }
  }

  const selectAddress = async (id) => {
    setSelectedAddressId(id)
    setAddressError('')
    const addr = addresses.find((a) => a.id === id)
    if (!addr || addr.is_active) return
    setActivatingId(id)
    try {
      await accountApi.addresses.activate(id)
      setAddresses((list) => list.map((a) => ({ ...a, is_active: a.id === id })))
    } catch {
      setError('خطا در انتخاب آدرس')
    } finally {
      setActivatingId(null)
    }
  }

  const addAddress = async (e) => {
    e.preventDefault()
    const trimmed = {
      ...addressForm,
      address: addressForm.address.trim(),
      province: addressForm.province.trim(),
      city: addressForm.city.trim(),
      postal_code: addressForm.postal_code.trim(),
    }
    if (!trimmed.address || !trimmed.province || !trimmed.city || !trimmed.postal_code) {
      setAddressError('آدرس کامل، استان، شهر و کد پستی الزامی هستند.')
      return
    }
    if (!/^\d{10}$/.test(trimmed.postal_code)) {
      setAddressError('کد پستی باید ۱۰ رقم باشد.')
      return
    }
    setSavingAddress(true)
    setError('')
    setAddressError('')
    try {
      const { data } = await accountApi.addresses.create(trimmed)
      setAddresses((list) => [data, ...list.map((a) => ({ ...a, is_active: false }))])
      setSelectedAddressId(data.id)
      setAddressForm(emptyAddressForm)
      setShowAddAddress(false)
      setAddressError('')
    } catch (err) {
      const detail = err.response?.data
      setError(detail?.detail || detail?.address || 'خطا در ذخیره آدرس')
    } finally {
      setSavingAddress(false)
    }
  }

  const resolveRecipient = useMemo(() => {
    if (recipient === 'other') {
      return {
        full_name: fullName(otherForm.first_name, otherForm.last_name),
        phone: otherForm.phone.trim(),
      }
    }
    return {
      full_name: fullName(profileForm.first_name, profileForm.last_name),
      phone: profileForm.phone.trim(),
    }
  }, [recipient, otherForm, profileForm])

  const submit = async (e) => {
    e.preventDefault()
    if (!user) {
      navigate('/login', { state: { from: '/checkout' } })
      return
    }
    if (!items.length) return
    if (!paymentAvailable) {
      setError('درگاه پرداخت غیرفعال است.')
      return
    }

    if (!selectedAddress) {
      setAddressError('انتخاب آدرس تحویل الزامی است. یک آدرس انتخاب کنید یا با دکمه «افزودن آدرس جدید» ثبت کنید.')
      return
    }
    if (
      !selectedAddress.address?.trim() ||
      !selectedAddress.province?.trim() ||
      !selectedAddress.city?.trim() ||
      !selectedAddress.postal_code?.trim()
    ) {
      setAddressError('آدرس انتخاب‌شده ناقص است. استان، شهر، کد پستی و آدرس کامل الزامی هستند.')
      return
    }
    setAddressError('')

    if (recipient === 'other') {
      if (!otherForm.first_name.trim() || !otherForm.last_name.trim() || !otherForm.phone.trim()) {
        setError('نام، نام خانوادگی و موبایل تحویل‌گیرنده الزامی است.')
        return
      }
    } else if (needsProfileFields) {
      if (!profileForm.first_name.trim() || !profileForm.last_name.trim() || !profileForm.phone.trim()) {
        setError('لطفاً اطلاعات پروفایل خود را تکمیل کنید.')
        return
      }
    }

    setLoading(true)
    setError('')
    try {
      if (needsProfileFields) {
        const { data } = await accountApi.profile.update({
          first_name: profileForm.first_name.trim(),
          last_name: profileForm.last_name.trim(),
          phone: profileForm.phone.trim(),
          email: profile?.email || '',
        })
        setProfile(data)
      }

      const payload = {
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          variant_id: i.variant_id || undefined,
        })),
        full_name: resolveRecipient.full_name,
        phone: resolveRecipient.phone,
        email: profile?.email || '',
        address: selectedAddress.address,
        province: selectedAddress.province || '',
        city: selectedAddress.city || '',
        postal_code: selectedAddress.postal_code || '',
        notes: notes.trim(),
        discount_code: appliedDiscount?.code || undefined,
        gateway: gateway || undefined,
        platform: 'web',
      }

      const { data } = await shopApi.checkout(payload)
      if (data.payment?.payment_url) {
        clear()
        window.location.href = data.payment.payment_url
        return
      }
      if (data.payment?.extra?.card_number) {
        clear()
        navigate(`/payment/result?status=pending&tracking=${data.payment.tracking_number}`, {
          state: { extra: data.payment.extra },
        })
        return
      }
      clear()
      navigate(`/payment/result?status=success&order=${data.order?.order_number}`)
    } catch (err) {
      const detail = err.response?.data
      setError(
        detail?.detail ||
          detail?.payment_error ||
          (typeof detail === 'object' ? Object.values(detail).flat().join(' ') : null) ||
          'خطا در ثبت سفارش',
      )
    } finally {
      setLoading(false)
    }
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <Seo title="تسویه حساب" path="/checkout" noindex />
        <Package className="mx-auto h-12 w-12 text-mist-300" strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-2xl font-bold">سبد خرید خالی است</h1>
        <Link to="/products" className="btn-dark mt-6 inline-flex cursor-pointer">
          مشاهده محصولات
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <Seo title="تسویه حساب" path="/checkout" noindex />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/cart"
            className="mb-3 inline-flex items-center gap-1 text-sm text-sea-600 transition hover:text-copper-600"
          >
            <ChevronLeft className="h-4 w-4" />
            بازگشت به سبد
          </Link>
          <p className="text-xs font-semibold tracking-widest text-copper-600">CHECKOUT</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">تسویه حساب</h1>
        </div>
      </div>

      {!user && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          برای تکمیل خرید ابتدا{' '}
          <Link to="/login" state={{ from: '/checkout' }} className="font-semibold underline">
            وارد حساب
          </Link>{' '}
          شوید.
        </div>
      )}

      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-5 lg:items-start">
        <div className="space-y-5 lg:col-span-3">
          <Section
            icon={UserRound}
            title="تحویل‌گیرنده"
            subtitle="سفارش به نام چه کسی ثبت شود؟"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                name="recipient"
                value="self"
                label="خودم"
                checked={recipient === 'self'}
                onChange={() => setRecipient('self')}
              />
              <ChoiceCard
                name="recipient"
                value="other"
                label="فرد دیگر"
                checked={recipient === 'other'}
                onChange={() => setRecipient('other')}
              />
            </div>

            {recipient === 'other' && (
              <div className="mt-4 grid gap-3 rounded-xl border border-mist-100 bg-mist-50/50 p-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label">نام</span>
                  <input
                    className="input"
                    value={otherForm.first_name}
                    onChange={(e) => setOtherForm({ ...otherForm, first_name: e.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="label">نام خانوادگی</span>
                  <input
                    className="input"
                    value={otherForm.last_name}
                    onChange={(e) => setOtherForm({ ...otherForm, last_name: e.target.value })}
                    required
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="label">موبایل تحویل‌گیرنده</span>
                  <input
                    className="input"
                    dir="ltr"
                    value={otherForm.phone}
                    onChange={(e) => setOtherForm({ ...otherForm, phone: e.target.value })}
                    required
                  />
                </label>
              </div>
            )}

            {recipient === 'self' && needsProfileFields && (
              <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/60 p-4">
                <p className="mb-3 text-sm text-amber-900">
                  پروفایل شما ناقص است. لطفاً اطلاعات زیر را تکمیل کنید.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="label">نام</span>
                    <input
                      className="input"
                      value={profileForm.first_name}
                      onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="label">نام خانوادگی</span>
                    <input
                      className="input"
                      value={profileForm.last_name}
                      onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                      required
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="label">موبایل</span>
                    <input
                      className="input"
                      dir="ltr"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      required
                    />
                  </label>
                </div>
              </div>
            )}

            {recipient === 'self' && profile && profileIsComplete(profile) && (
              <p className="mt-4 rounded-xl bg-mist-50 px-4 py-3 text-sm text-ink-700/70">
                <User className="mb-0.5 inline h-4 w-4 align-middle" strokeWidth={1.75} />{' '}
                {fullName(profile.first_name, profile.last_name)} · {profile.phone}
              </p>
            )}
          </Section>

          <Section
            icon={MapPin}
            title="آدرس تحویل"
            subtitle="آدرس انتخاب‌شده به‌عنوان آدرس فعال ذخیره می‌شود."
          >
            {loadingData ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-mist-100" />
                ))}
              </div>
            ) : addresses.length > 0 ? (
              <div className="space-y-3">
                {addresses.map((a) => {
                  const selected = selectedAddressId === a.id
                  return (
                    <label
                      key={a.id}
                      className={`block cursor-pointer rounded-xl border p-4 transition ${
                        selected
                          ? 'border-copper-500 bg-copper-500/5'
                          : 'border-mist-200 hover:border-copper-400/40'
                      } ${activatingId === a.id ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="address"
                          className="mt-1 h-4 w-4 accent-copper-500"
                          checked={selected}
                          onChange={() => selectAddress(a.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-ink-900">
                              {a.label || 'آدرس'}
                            </span>
                            {a.is_active && (
                              <span className="rounded-md bg-copper-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                فعال
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm leading-7 text-ink-700/65">
                            {[a.province, a.city].filter(Boolean).join('، ')}
                            {a.province || a.city ? ' — ' : ''}
                            {a.address}
                            {a.postal_code && (
                              <span className="text-ink-700/45"> · کد پستی: {a.postal_code}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-mist-200 px-4 py-6 text-center text-sm text-ink-700/50">
                آدرسی ثبت نشده است. با دکمه زیر آدرس جدید اضافه کنید.
              </p>
            )}

            {addressError && (
              <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{addressError}</p>
            )}

            {!showAddAddress && !atAddressLimit && (
              <button
                type="button"
                className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-mist-300 px-4 py-3 text-sm font-medium text-sea-600 transition hover:border-copper-400/50 hover:bg-mist-50"
                onClick={() => {
                  setShowAddAddress(true)
                  setAddressError('')
                }}
              >
                <Plus className="h-4 w-4" />
                افزودن آدرس جدید
              </button>
            )}

            {atAddressLimit && !showAddAddress && (
              <p className="mt-3 text-xs text-ink-700/45">
                حداکثر {maxAddresses} آدرس — برای افزودن جدید از{' '}
                <Link to="/account/addresses" className="text-sea-600 hover:text-copper-600">
                  پروفایل
                </Link>{' '}
                یکی را حذف کنید.
              </p>
            )}

            {showAddAddress && (
              <div className="mt-4 rounded-xl border border-mist-200 bg-mist-50/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-900">آدرس جدید</span>
                  <button
                    type="button"
                    className="cursor-pointer text-xs text-ink-700/50 hover:text-ink-900"
                    onClick={() => setShowAddAddress(false)}
                  >
                    انصراف
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="label">عنوان (اختیاری)</span>
                    <input
                      className="input"
                      placeholder="مثلاً خانه"
                      value={addressForm.label}
                      onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="label">نام گیرنده</span>
                    <input
                      className="input"
                      value={addressForm.full_name}
                      onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="label">موبایل</span>
                    <input
                      className="input"
                      dir="ltr"
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                      required
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="label">آدرس کامل *</span>
                    <textarea
                      className="input min-h-24 resize-y"
                      value={addressForm.address}
                      onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="label">استان *</span>
                    <input
                      className="input"
                      value={addressForm.province}
                      onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="label">شهر *</span>
                    <input
                      className="input"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      required
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="label">کد پستی *</span>
                    <input
                      className="input"
                      dir="ltr"
                      inputMode="numeric"
                      pattern="\d{10}"
                      maxLength={10}
                      value={addressForm.postal_code}
                      onChange={(e) =>
                        setAddressForm({
                          ...addressForm,
                          postal_code: e.target.value.replace(/\D/g, '').slice(0, 10),
                        })
                      }
                      required
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="btn-dark mt-4 cursor-pointer text-xs"
                  disabled={savingAddress}
                  onClick={addAddress}
                >
                  {savingAddress ? 'در حال ذخیره...' : 'ذخیره و انتخاب این آدرس'}
                </button>
              </div>
            )}
          </Section>

          <Section icon={CreditCard} title="پرداخت و تکمیل">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="label">یادداشت (اختیاری)</span>
                <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <div className="block sm:col-span-2">
                <span className="label">کد تخفیف (اختیاری)</span>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="input min-w-0 flex-1"
                    value={discountInput}
                    onChange={(e) => {
                      setDiscountInput(e.target.value)
                      setAppliedDiscount(null)
                      setDiscountError('')
                    }}
                    placeholder="کد را وارد کنید"
                  />
                  <button
                    type="button"
                    className="btn-dark shrink-0 cursor-pointer px-5 text-xs disabled:opacity-50"
                    disabled={discountLoading || !discountInput.trim()}
                    onClick={applyDiscount}
                  >
                    {discountLoading ? '...' : 'اعمال'}
                  </button>
                </div>
                {discountError && (
                  <p className="mt-2 text-sm text-red-600">{discountError}</p>
                )}
                {appliedDiscount && (
                  <p className="mt-2 text-sm text-emerald-700">
                    کد «{appliedDiscount.code}» اعمال شد — {toman(appliedDiscount.discount_toman)} تخفیف
                  </p>
                )}
              </div>
            </div>

            {gateways.length > 0 ? (
              <div className="mt-5">
                <div className="label">درگاه پرداخت</div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {gateways.map((g) => {
                    const logo = g.logo_url || g.logo
                    const active = gateway === g.provider_type
                    return (
                      <label
                        key={g.provider_type}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition ${
                          active
                            ? 'border-copper-500 bg-copper-500/5'
                            : 'border-mist-200 hover:border-copper-400/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="gateway"
                          className="sr-only"
                          checked={active}
                          onChange={() => setGateway(g.provider_type)}
                        />
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-mist-200 bg-white">
                          {logo ? (
                            <img src={mediaSrc(logo)} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-[9px] text-ink-700/35">PG</span>
                          )}
                        </div>
                        <div className="min-w-0 text-sm font-medium text-ink-900">{g.display_name}</div>
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : (
              !loadingData && (
                <p className="mt-5 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  درگاه پرداخت غیرفعال است. در حال حاضر امکان ثبت و پرداخت سفارش وجود ندارد.
                </p>
              )
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              className="btn-primary mt-5 w-full cursor-pointer py-3.5 disabled:opacity-50 sm:w-auto sm:min-w-56"
              disabled={loading || !user || loadingData || !paymentAvailable}
              title={!paymentAvailable && !loadingData ? 'درگاه پرداخت غیرفعال است' : undefined}
            >
              {!paymentAvailable && !loadingData
                ? 'درگاه پرداخت غیرفعال است'
                : loading
                  ? 'در حال ثبت...'
                  : `پرداخت ${toman(payableTotal)}`}
            </button>
          </Section>
        </div>

        <aside className="lg:col-span-2">
          <div className="sticky top-24 rounded-2xl border border-mist-200/80 bg-ink-950 p-5 text-white shadow-[0_24px_48px_rgba(15,23,42,0.2)]">
            <h2 className="font-display text-lg font-bold">خلاصه سفارش</h2>
            <p className="mt-1 text-xs text-white/45">{faDigits(items.length)} قلم در سبد</p>
            <ul className="checkout-summary-scroll mt-5 space-y-3">
              {items.map((item) => {
                const thumb = item.primary_image || thumbnails[item.product_id]
                return (
                  <li
                    key={`${item.product_id}:${item.variant_id || 0}`}
                    className="flex items-center gap-3 border-b border-white/10 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                      {thumb ? (
                        <img
                          src={mediaSrc(thumb)}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center text-[10px] text-white/30">
                          {item.name?.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium leading-6">{item.name}</div>
                      {item.variant_label && (
                        <div className="text-[11px] text-white/40">{item.variant_label}</div>
                      )}
                      <div className="text-xs text-white/45">× {faDigits(item.quantity)}</div>
                    </div>
                    <div className="shrink-0 text-sm font-medium text-copper-300">
                      {toman(item.price_toman * item.quantity)}
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
              <div className="flex items-center justify-between text-white/60">
                <span>جمع اقلام</span>
                <span>{toman(cartTotal)}</span>
              </div>
              {appliedDiscount && (
                <div className="flex items-center justify-between text-emerald-300/90">
                  <span>تخفیف ({appliedDiscount.code})</span>
                  <span>− {toman(discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-white/60">مبلغ قابل پرداخت</span>
                <span className="font-display text-xl font-bold text-copper-400">{toman(payableTotal)}</span>
              </div>
            </div>
          </div>
        </aside>
      </form>
    </div>
  )
}
