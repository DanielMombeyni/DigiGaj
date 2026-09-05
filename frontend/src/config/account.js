export const ORDER_STATUS = {
  awaiting_price: { label: 'در انتظار اعلام قیمت', cls: 'border-violet-200 bg-violet-50 text-violet-700' },
  pending: { label: 'در انتظار پرداخت', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  paid: { label: 'پرداخت‌شده', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  processing: { label: 'در حال آماده‌سازی', cls: 'border-sea-500/30 bg-sea-500/10 text-sea-600' },
  shipped: { label: 'ارسال‌شده', cls: 'border-sea-500/30 bg-sea-500/10 text-sea-600' },
  delivered: { label: 'تحویل‌شده', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'لغو‌شده', cls: 'border-mist-200 bg-mist-100 text-ink-700/50' },
  refunded: { label: 'مسترد', cls: 'border-red-200 bg-red-50 text-red-600' },
}

export const ORDER_STATUS_FLOW = ['pending', 'paid', 'processing', 'shipped', 'delivered']

export const TX_STATUS = {
  pending: { label: 'در انتظار', cls: 'text-amber-700' },
  success: { label: 'موفق', cls: 'text-emerald-700' },
  failed: { label: 'ناموفق', cls: 'text-red-600' },
  refunded: { label: 'مسترد', cls: 'text-ink-700/50' },
}

export const TICKET_STATUS = {
  open: { label: 'باز', cls: 'text-sea-600' },
  in_progress: { label: 'در حال بررسی', cls: 'text-amber-700' },
  answered: { label: 'پاسخ‌داده‌شده', cls: 'text-emerald-700' },
  closed: { label: 'بسته‌شده', cls: 'text-ink-700/45' },
}
