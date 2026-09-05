import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ShopLayout from '@/components/layout/ShopLayout'
import AdminLayout from '@/components/layout/sidebar/AdminLayout'
import PublicPageGuard from '@/components/shop/PublicPageGuard'
import ThemeApplier from '@/components/shop/ThemeApplier'
import LoadingScreen from '@/components/common/LoadingScreen'

const HomePage = lazy(() => import('@/pages/shop/HomePage'))
const ProductsPage = lazy(() => import('@/pages/shop/ProductsPage'))
const ProductDetailPage = lazy(() => import('@/pages/shop/ProductDetailPage'))
const CategoriesPage = lazy(() => import('@/pages/shop/CategoriesPage'))
const AboutPage = lazy(() => import('@/pages/shop/AboutPage'))
const CmsPageRoute = lazy(() => import('@/pages/shop/CmsPageRoute'))
const ContactPage = lazy(() => import('@/pages/shop/ContactPage'))
const CartPage = lazy(() => import('@/pages/shop/CartPage'))
const CheckoutPage = lazy(() => import('@/pages/shop/CheckoutPage'))
const PaymentResultPage = lazy(() => import('@/pages/shop/PaymentResultPage'))
const LoginPage = lazy(() => import('@/pages/shop/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/shop/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/shop/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/shop/ResetPasswordPage'))

const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage'))
const AdminDashboard = lazy(() => import('@/pages/admin/DashboardPage'))
const AdminProductsPage = lazy(() => import('@/pages/admin/ProductsPage'))
const AdminCategoriesPage = lazy(() => import('@/pages/admin/CategoriesPage'))
const AdminDiscountsPage = lazy(() => import('@/pages/admin/DiscountsPage'))
const AdminOrdersPage = lazy(() => import('@/pages/admin/OrdersPage'))
const AdminAccountingPage = lazy(() => import('@/pages/admin/AccountingPage'))
const AdminGatewaysPage = lazy(() => import('@/pages/admin/GatewaysPage'))
const AdminTransactionsPage = lazy(() => import('@/pages/admin/TransactionsPage'))
const AdminSettingsPage = lazy(() => import('@/pages/admin/SettingsPage'))
const AdminEmailsPage = lazy(() => import('@/pages/admin/EmailsPage'))
const AdminTicketsPage = lazy(() => import('@/pages/admin/TicketsPage'))
const AdminPersonnelPage = lazy(() => import('@/pages/admin/PersonnelPage'))
const AdminCustomersPage = lazy(() => import('@/pages/admin/CustomersPage'))
const AdminStorefrontPagesPage = lazy(() => import('@/pages/admin/StorefrontPagesPage'))

const AccountLayout = lazy(() => import('@/components/layout/AccountLayout'))
const AccountOrdersPage = lazy(() => import('@/pages/account/AccountOrdersPage'))
const AccountOrderDetailPage = lazy(() => import('@/pages/account/AccountOrderDetailPage'))
const AccountTransactionsPage = lazy(() => import('@/pages/account/AccountTransactionsPage'))
const AccountTicketsPage = lazy(() => import('@/pages/account/AccountTicketsPage'))
const AccountTicketDetailPage = lazy(() => import('@/pages/account/AccountTicketDetailPage'))
const AccountAddressesPage = lazy(() => import('@/pages/account/AccountAddressesPage'))
const AccountProfilePage = lazy(() => import('@/pages/account/AccountProfilePage'))

const PANEL = '/panel-dashboard'

function RouteFallback() {
  return <LoadingScreen variant="page" label="در حال بارگذاری صفحه..." />
}

function guard(pageKey, el) {
  return <PublicPageGuard pageKey={pageKey}>{el}</PublicPageGuard>
}

export default function App() {
  return (
    <>
      <ThemeApplier />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="login" element={guard('login', <LoginPage />)} />
          <Route path="register" element={guard('register', <RegisterPage />)} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password/:uid/:token" element={<ResetPasswordPage />} />

          <Route element={<ShopLayout />}>
            <Route index element={guard('home', <HomePage />)} />
            <Route path="products" element={guard('products', <ProductsPage />)} />
            <Route path="products/:slug" element={guard('products', <ProductDetailPage />)} />
            <Route path="categories" element={guard('categories', <CategoriesPage />)} />
            <Route path="about" element={guard('about', <AboutPage />)} />
            <Route path="contact" element={guard('contact', <ContactPage />)} />
            <Route path="pages/:slug" element={<CmsPageRoute />} />
            <Route path="cart" element={guard('cart', <CartPage />)} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="payment/result" element={<PaymentResultPage />} />

            <Route path="account" element={<AccountLayout />}>
              <Route index element={<Navigate to="orders" replace />} />
              <Route path="orders" element={<AccountOrdersPage />} />
              <Route path="orders/:id" element={<AccountOrderDetailPage />} />
              <Route path="transactions" element={<AccountTransactionsPage />} />
              <Route path="tickets" element={<AccountTicketsPage />} />
              <Route path="tickets/:number" element={<AccountTicketDetailPage />} />
              <Route path="addresses" element={<AccountAddressesPage />} />
              <Route path="profile" element={<AccountProfilePage />} />
            </Route>
          </Route>

          <Route path={`${PANEL}/login`} element={<AdminLoginPage />} />
          <Route path={PANEL} element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="discounts" element={<AdminDiscountsPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="accounting" element={<AdminAccountingPage />} />
            <Route path="gateways" element={<AdminGatewaysPage />} />
            <Route path="transactions" element={<AdminTransactionsPage />} />
            <Route path="tickets" element={<AdminTicketsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="emails" element={<AdminEmailsPage />} />
            <Route path="personnel" element={<AdminPersonnelPage />} />
            <Route path="customers" element={<AdminCustomersPage />} />
            <Route path="storefront" element={<AdminStorefrontPagesPage />} />
          </Route>

          <Route path="/admin" element={<Navigate to={PANEL} replace />} />
          <Route path="/admin/login" element={<Navigate to={`${PANEL}/login`} replace />} />
          <Route path="/admin/*" element={<Navigate to={PANEL} replace />} />
          <Route path="/management" element={<Navigate to={`${PANEL}/login`} replace />} />
          <Route path="/management/login" element={<Navigate to={`${PANEL}/login`} replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
