function randomString(length) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let out = ''
  for (const byte of bytes) out += chars[byte % chars.length]
  return out
}

function base64Url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function beginGoogleRedirect(clientId, nextPath = '/') {
  const verifier = randomString(64)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const state = randomString(32)
  const redirectUri = `${window.location.origin}/login/google/callback`
  sessionStorage.setItem('google_oauth_verifier', verifier)
  sessionStorage.setItem('google_oauth_state', state)
  sessionStorage.setItem('google_oauth_redirect', redirectUri)
  sessionStorage.setItem('google_oauth_next', nextPath || '/')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: base64Url(digest),
    code_challenge_method: 'S256',
    state,
    include_granted_scopes: 'true',
    prompt: 'select_account',
  })
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
