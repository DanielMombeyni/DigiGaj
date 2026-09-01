import { useParams } from 'react-router-dom'
import PublicPageGuard from '@/components/shop/PublicPageGuard'
import AboutPage from '@/pages/shop/AboutPage'

export default function CmsPageRoute() {
  const { slug } = useParams()
  return (
    <PublicPageGuard pageKey={slug ? `cms:${slug}` : null}>
      <AboutPage />
    </PublicPageGuard>
  )
}
