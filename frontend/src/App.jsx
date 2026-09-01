import { Routes, Route, Navigate } from 'react-router-dom'
import ShopLayout from '@/components/layout/ShopLayout'
import AdminLayout from '@/components/layout/sidebar/AdminLayout'
import PublicPageGuard from '@/components/shop/PublicPageGuard'
import ThemeApplier from '@/components/shop/ThemeApplier'
import HomePage from '@/pages/shop/HomePage'
import ProductsPage from '@/pages/shop/ProductsPage'
import ProductDetailPage from '@/pages/shop/ProductDetailPage'
import CategoriesPage from '@/pages/shop/CategoriesPage'
import AboutPage from '@/pages/shop/AboutPage'
import CmsPageRoute from '@/pages/shop/CmsPageRoute'
import ContactPage from '@/pages/shop/ContactPage'
import CartPage from '@/pages/shop/CartPage'
import CheckoutPage from '@/pages/shop/CheckoutPage'
import PaymentResultPage from '@/pages/shop/PaymentResultPage'
import LoginPage from '@/pages/shop/LoginPage'
import RegisterPage from '@/pages/shop/RegisterPage'
import ForgotPasswordPage from '@/pages/shop/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/shop/ResetPasswordPage'
import AdminLoginPage from '@/pages/admin/AdminLoginPage'
import AdminDashboard from '@/pages/admin/DashboardPage'
import AdminProductsPage from '@/pages/admin/ProductsPage'
import AdminCategoriesPage from '@/pages/admin/CategoriesPage'
import AdminDiscountsPage from '@/pages/admin/DiscountsPage'
import AdminOrdersPage from '@/pages/admin/OrdersPage'
import AdminAccountingPage from '@/pages/admin/AccountingPage'
import AdminGatewaysPage from '@/pages/admin/GatewaysPage'
import AdminTransactionsPage from '@/pages/admin/TransactionsPage'
import AdminSettingsPage from '@/pages/admin/SettingsPage'
import AdminTicketsPage from '@/pages/admin/TicketsPage'
import AdminPersonnelPage from '@/pages/admin/PersonnelPage'
import AdminCustomersPage from '@/pages/admin/CustomersPage'
import AdminStorefrontPagesPage from '@/pages/admin/StorefrontPagesPage'
import AccountLayout from '@/components/layout/AccountLayout'
import AccountOrdersPage from '@/pages/account/AccountOrdersPage'
import AccountOrderDetailPage from '@/pages/account/AccountOrderDetailPage'
import AccountTransactionsPage from '@/pages/account/AccountTransactionsPage'
import AccountTicketsPage from '@/pages/account/AccountTicketsPage'
import AccountTicketDetailPage from '@/pages/account/AccountTicketDetailPage'
import AccountAddressesPage from '@/pages/account/AccountAddressesPage'
import AccountProfilePage from '@/pages/account/AccountProfilePage'

const PANEL = '/panel-dashboard'

export default function App() {
  return (
    <>
      <ThemeApplier />
      <Routes>
        {/* Customer auth — full-page, no shop chrome */}
        <Route path="login" element={<PublicPageGuard pageKey="login"><LoginPage /></PublicPageGuard>} />
        <Route path="register" element={<PublicPageGuard pageKey="register"><RegisterPage /></PublicPageGuard>} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password/:uid/:token" element={<ResetPasswordPage />} />

        <Route element={<ShopLayout />}>
          <Route index element={<PublicPageGuard pageKey="home"><HomePage /></PublicPageGuard>} />
          <Route path="products" element={<PublicPageGuard pageKey="products"><ProductsPage /></PublicPageGuard>} />
          <Route path="products/:slug" element={<PublicPageGuard pageKey="products"><ProductDetailPage /></PublicPageGuard>} />
          <Route path="categories" element={<PublicPageGuard pageKey="categories"><CategoriesPage /></PublicPageGuard>} />
          <Route path="about" element={<PublicPageGuard pageKey="about"><AboutPage /></PublicPageGuard>} />
          <Route path="contact" element={<PublicPageGuard pageKey="contact"><ContactPage /></PublicPageGuard>} />
          <Route path="pages/:slug" element={<CmsPageRoute />} />
          <Route path="cart" element={<PublicPageGuard pageKey="cart"><CartPage /></PublicPageGuard>} />
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
          <Route path="personnel" element={<AdminPersonnelPage />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="storefront" element={<AdminStorefrontPagesPage />} />
        </Route>

        {/* legacy redirects */}
        <Route path="/admin" element={<Navigate to={PANEL} replace />} />
        <Route path="/admin/login" element={<Navigate to={`${PANEL}/login`} replace />} />
        <Route path="/admin/*" element={<Navigate to={PANEL} replace />} />
        <Route path="/management" element={<Navigate to={`${PANEL}/login`} replace />} />
        <Route path="/management/login" element={<Navigate to={`${PANEL}/login`} replace />} />
      </Routes>
    </>
  )
}
