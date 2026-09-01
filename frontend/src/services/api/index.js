import api from './client'

export const shopApi = {
  home: () => api.get('/storefront/home/'),
  config: () => api.get('/storefront/config/'),
  products: (params) => api.get('/products/', { params }),
  productPriceStats: (params) => api.get('/products/price-stats/', { params }),
  product: (slug) => api.get(`/products/${slug}/`),
  categories: (params) => api.get('/categories/', { params }),
  page: (slug) => api.get(`/pages/${slug}/`),
  checkout: (payload) => api.post('/orders/checkout/', payload),
  validateDiscount: (payload) => api.post('/discounts/validate_code/', payload),
  createTicket: (payload) => api.post('/tickets/', payload),
  orders: (params) => api.get('/orders/', { params }),
  order: (id) => api.get(`/orders/${id}/`),
}

export const accountApi = {
  profile: {
    get: () => api.get('/me/profile/'),
    update: (data) => api.patch('/me/profile/', data),
  },
  addresses: {
    list: (params) => api.get('/me/addresses/', { params }),
    create: (data) => api.post('/me/addresses/', data),
    update: (id, data) => api.patch(`/me/addresses/${id}/`, data),
    remove: (id) => api.delete(`/me/addresses/${id}/`),
    activate: (id) => api.post(`/me/addresses/${id}/activate/`),
  },
  transactions: {
    list: () => api.get('/me/transactions/'),
    get: (id) => api.get(`/me/transactions/${id}/`),
  },
  tickets: {
    list: () => api.get('/me/tickets/'),
    get: (number) => api.get(`/me/tickets/${number}/`),
    create: (data) => api.post('/me/tickets/', data),
    reply: (number, data) => api.post(`/me/tickets/${number}/reply/`, data),
  },
}

export const paymentApi = {
  gateways: (platform = 'web') =>
    api.get('/payment/gateways/', { params: { platform } }),
  purchase: (payload) => api.post('/payment/purchase/', payload),
  confirm: (tracking_number) =>
    api.post('/payment/confirm/', { tracking_number }),
  status: (tracking) => api.get(`/payment/status/${tracking}/`),
}

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard/'),
  homeHero: {
    get: () => api.get('/admin/home-hero/'),
    update: (data) => api.patch('/admin/home-hero/', data),
  },
  storefrontPages: {
    get: () => api.get('/admin/storefront-pages/'),
    update: (data) => api.patch('/admin/storefront-pages/', data),
  },
  products: {
    list: (params) => api.get('/products/', { params }),
    get: (slug) => api.get(`/products/${slug}/`),
    create: (data) => api.post('/products/', data),
    update: (slug, data) => api.patch(`/products/${slug}/`, data),
    remove: (slug) => api.delete(`/products/${slug}/`),
    uploadImages: (slug, files) => {
      const fd = new FormData()
      ;[...files].forEach((f) => fd.append('images', f))
      return api.post(`/products/${slug}/images/`, fd)
    },
    deleteImage: (slug, imageId) => api.delete(`/products/${slug}/images/${imageId}/`),
  },
  categories: {
    list: () => api.get('/categories/'),
    create: (data) => api.post('/categories/', data),
    update: (slug, data) => api.patch(`/categories/${slug}/`, data),
    remove: (slug) => api.delete(`/categories/${slug}/`),
  },
  discounts: {
    list: () => api.get('/discounts/'),
    create: (data) => api.post('/discounts/', data),
    update: (id, data) => api.patch(`/discounts/${id}/`, data),
    remove: (id) => api.delete(`/discounts/${id}/`),
  },
  accounting: {
    list: (params) => api.get('/accounting/', { params }),
    create: (data) => api.post('/accounting/', data),
    summary: () => api.get('/accounting/summary/'),
  },
  orders: {
    list: (params) => api.get('/orders/', { params }),
    setStatus: (id, status) => api.patch(`/orders/${id}/status/`, { status }),
  },
  tickets: {
    list: (params) => api.get('/tickets/', { params }),
    get: (number) => api.get(`/tickets/${number}/`),
    update: (number, data) => api.patch(`/tickets/${number}/`, data),
    reply: (number, data) => api.post(`/tickets/${number}/reply/`, data),
    remove: (number) => api.delete(`/tickets/${number}/`),
  },
  gateways: {
    catalog: () => api.get('/payment/admin/catalog/'),
    list: () => api.get('/payment/admin/gateways/'),
    create: (data) => api.post('/payment/admin/gateways/', data),
    update: (id, data) => api.patch(`/payment/admin/gateways/${id}/`, data),
    remove: (id) => api.delete(`/payment/admin/gateways/${id}/`),
    cardConfirm: (tracking_number) =>
      api.post('/payment/admin/card-confirm/', { tracking_number }),
    transactions: () => api.get('/payment/admin/transactions/'),
  },
  storeConfig: {
    get: () => api.get('/admin/store-config/'),
    update: (data) => api.put('/admin/store-config/', data),
  },
  smsProviders: {
    catalog: () => api.get('/admin/sms-providers/catalog/'),
    list: () => api.get('/admin/sms-providers/'),
    create: (data) => api.post('/admin/sms-providers/', data),
    update: (id, data) => api.patch(`/admin/sms-providers/${id}/`, data),
    remove: (id) => api.delete(`/admin/sms-providers/${id}/`),
  },
  personnel: {
    list: (params) => api.get('/admin/personnel/', { params }),
    create: (data) => api.post('/admin/personnel/', data),
    update: (id, data) => api.patch(`/admin/personnel/${id}/`, data),
    remove: (id) => api.delete(`/admin/personnel/${id}/`),
  },
  customers: {
    list: (params) => api.get('/admin/customers/', { params }),
    create: (data) => api.post('/admin/customers/', data),
    update: (id, data) => api.patch(`/admin/customers/${id}/`, data),
    remove: (id) => api.delete(`/admin/customers/${id}/`),
  },
  roles: {
    list: (params) => api.get('/admin/roles/', { params }),
    create: (data) => api.post('/admin/roles/', data),
    update: (id, data) => api.patch(`/admin/roles/${id}/`, data),
    remove: (id) => api.delete(`/admin/roles/${id}/`),
  },
  pagesCatalog: () => api.get('/admin/pages-catalog/'),
}

export const authApi = {
  login: (username, password) =>
    api.post('/auth/token/', { username, password }),
  requestOtp: (phone) => api.post('/auth/otp/request/', { phone }),
  verifyOtp: (phone, code) => api.post('/auth/otp/verify/', { phone, code }),
  register: (payload) => api.post('/auth/registration/', payload),
  me: () => api.get('/auth/user/'),
  passwordReset: (email) => api.post('/auth/password/reset/', { email }),
  passwordResetConfirm: (payload) =>
    api.post('/auth/password/reset/confirm/', payload),
}
