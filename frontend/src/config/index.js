import { brand } from './brand'

export const config = {
  // Relative URL goes through Vite proxy in Docker/dev (avoids CORS).
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  appName: brand.name,
  platform: 'web',
}

export { brand }
