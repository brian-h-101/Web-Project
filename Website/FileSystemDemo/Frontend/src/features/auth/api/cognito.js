import { httpClient, setAccessToken } from '../../../shared/api/httpClient.js'
const pendingKey = 'filesystem.pkce'
const encoded = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
export async function config() {
  const value = await httpClient('/api/catalog/config', { publicOnly: true })
  if (!/^https:\/\/[a-z0-9-]+\.auth\.us-east-2\.amazoncognito\.com$/.test(value.loginDomain) || value.callbackUrl !== location.origin + '/demos/file-system-simulator/auth/callback' || value.logoutUrl !== location.origin + '/demos/file-system-simulator/index.html' || !value.clientId) throw new Error('Administrator sign-in has not been configured for this origin.')
  return value
}
export async function signIn() {
  const settings = await config(), verifier = encoded(crypto.getRandomValues(new Uint8Array(48))), state = encoded(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = encoded(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  sessionStorage.setItem(pendingKey, JSON.stringify({ verifier, state, created: Date.now() }))
  const query = new URLSearchParams({ response_type: 'code', client_id: settings.clientId, redirect_uri: settings.callbackUrl, scope: settings.scope, state, code_challenge_method: 'S256', code_challenge: challenge })
  location.assign(settings.loginDomain + '/oauth2/authorize?' + query)
}
export async function finishSignIn() {
  const pending = JSON.parse(sessionStorage.getItem(pendingKey) || 'null'), query = new URLSearchParams(location.search)
  sessionStorage.removeItem(pendingKey)
  history.replaceState(null, '', location.pathname)
  if (!pending || Date.now() - pending.created > 600000 || pending.created > Date.now() || !query.get('code') || query.get('state') !== pending.state || query.has('error')) throw new Error('Sign-in expired or state validation failed. Start sign-in again.')
  const settings = await config()
  const result = await fetch(settings.loginDomain + '/oauth2/token', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: settings.clientId, code: query.get('code'), redirect_uri: settings.callbackUrl, code_verifier: pending.verifier }) })
  const tokens = await result.json()
  if (!result.ok || tokens.token_type !== 'Bearer' || typeof tokens.access_token !== 'string') throw new Error('Cognito did not return an access token.')
  setAccessToken(tokens.access_token)
  try { return (await httpClient('/api/catalog/admin/session', { mode: 'administrator' })).user }
  catch (error) { setAccessToken(null); throw error }
}
export async function signOut() {
  setAccessToken(null)
  const settings = await config()
  location.assign(settings.loginDomain + '/logout?' + new URLSearchParams({ client_id: settings.clientId, logout_uri: settings.logoutUrl }))
}
