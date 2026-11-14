import contract from '../../../../Lambda/content_routes.json';
import { createRequestCoordinator, aborted, retryAfter } from './requestCoordinator.js';
let accessToken = null,
  contentMode = 'published',
  permissions = [],
  accessGeneration = 0;
// Module-owned admission and invalidation; provider remounts do not replace it.
const coordinator = createRequestCoordinator();
function changed() {
  accessGeneration++;
  coordinator.invalidate();
}
export const contentPermissions = contract.permissions;
export function setAccessToken(token) {
  if (accessToken !== token) {
    accessToken = token;
    changed();
  }
  if (!token && contentMode === 'administrator') configureContentAccess('published');
}
export function hasAccessToken() {
  return Boolean(accessToken);
}
/** Clear the token through normal access-generation invalidation and mode fallback. */
export function clearAccessToken() {
  setAccessToken(null);
}
/** Legacy name retained for compatibility; this operation clears access, not a CSRF token. */
export function resetCsrf() {
  clearAccessToken();
}
export function configureContentAccess(mode, granted = []) {
  if (
    !['published', 'shared', 'administrator'].includes(mode) ||
    (mode === 'administrator' && !accessToken) ||
    !Array.isArray(granted) ||
    granted.some((p) => !contentPermissions.includes(p))
  )
    throw new Error('Unverified content configuration.');
  const next = mode === 'published' ? [] : [...granted].sort();
  if (contentMode !== mode || JSON.stringify(permissions) !== JSON.stringify(next)) {
    contentMode = mode;
    permissions = next;
    changed();
  }
}
const matches = (route, path) =>
  new RegExp(
    '^' +
      route
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replaceAll('\\{id\\}', '[^/]+')
        .replaceAll('\\{sku\\}', '[^/]+') +
      '$',
  ).test(path);
export function contentClient(path, options = {}) {
  return httpClient(path, { ...options, mode: 'content' });
}
export async function httpClient(
  path,
  {
    method = 'GET',
    body,
    headers = {},
    responseType = 'json',
    signal,
    publicOnly = false,
    mode = 'published',
    priority,
  } = {},
) {
  if (!/^\/api\/(catalog|filesystem)\//.test(path)) throw new Error('Unsupported API namespace.');
  method = method.toUpperCase();
  let selected = publicOnly ? 'published' : mode;
  if (selected === 'content') {
    const route = contract.routes.find(
      (r) => r.method === method && matches(r.path, path.split('?')[0]),
    );
    if (!route) throw new Error('Unsupported shared content route.');
    selected = contentMode;
    if (method !== 'GET' && (selected === 'published' || !permissions.includes(route.permission)))
      throw Object.assign(
        new Error('Shared content management is unavailable. Refresh its configuration.'),
        { status: 403, code: 'management_disabled' },
      );
    if (selected !== 'published')
      path = path.replace(
        /^\/api\/(catalog|filesystem)\//,
        '/api/$1/' + (selected === 'shared' ? 'manage' : 'admin') + '/',
      );
  } else if (selected === 'published' && (method !== 'GET' || /\/(admin|manage)\//.test(path)))
    throw new Error('Use the explicit content or administrator adapter.');
  if (selected === 'administrator') {
    if (!accessToken || !/\/admin\//.test(path))
      throw new Error('A verified administrator session is required.');
    headers = { ...headers, Authorization: 'Bearer ' + accessToken };
  } else if (!['published', 'shared'].includes(selected))
    throw new Error('Unsupported request mode.');
  if (!['json', 'text', 'blob'].includes(responseType))
    throw new Error('Unsupported response representation.');
  headers = { ...headers };
  const encodedBody = body == null ? null : JSON.stringify(body);
  const generation = accessGeneration,
    valid = () => generation === accessGeneration;
  const key = JSON.stringify([
    path,
    responseType,
    selected,
    generation,
    Object.entries(headers).sort(),
  ]);
  try {
    const result = await coordinator.request({
      key,
      read: method === 'GET',
      signal,
      valid,
      priority,
      run: async (requestSignal, observe) => {
        if (!valid() || requestSignal.aborted) throw aborted();
        let response;
        try {
          response = await fetch(path, {
            method,
            cache: 'no-store',
            credentials: 'omit',
            signal: requestSignal,
            headers: {
              ...headers,
              ...(encodedBody != null ? { 'Content-Type': 'application/json' } : {}),
            },
            ...(encodedBody != null ? { body: encodedBody } : {}),
          });
        } catch (error) {
          if (requestSignal.aborted || error.name === 'AbortError') throw aborted();
          if (error instanceof TypeError || error.name === 'NetworkError')
            throw Object.assign(new Error('The network connection was interrupted.'), {
              code: 'transport_unavailable',
            });
          throw error;
        }
        if (requestSignal.aborted || !valid()) throw aborted();
        const requestId = response.headers?.get('x-request-id') || undefined;
        observe({
          requestId,
          responseStatus: response.status,
          ...(!response.ok ? { status: response.status } : {}),
        });
        if (!response.ok) {
          let detail;
          try {
            detail = await response.json();
          } catch {
            /* Gateway failures can be plain text. */
          }
          if (requestSignal.aborted || !valid()) throw aborted();
          const error = Object.assign(
            new Error(
              detail?.error?.message ||
                'The service is unavailable (HTTP ' + response.status + ').',
            ),
            {
              status: response.status,
              code: detail?.error?.code || 'http_failure',
              requestId,
              retryAfter: retryAfter(response.headers?.get('retry-after')),
            },
          );
          throw error;
        }
        let value;
        try {
          value = response.status === 204 ? null : await response[responseType]();
        } catch (error) {
          if (requestSignal.aborted) throw aborted();
          // Invalid JSON/contracts are permanent. A body-stream disconnect is transient.
          if (error instanceof TypeError || error.name === 'NetworkError')
            throw Object.assign(new Error('The response connection was interrupted.'), {
              code: 'transport_unavailable',
              requestId,
            });
          throw Object.assign(error, { requestId });
        }
        if (requestSignal.aborted || !valid()) throw aborted();
        return value;
      },
    });
    return responseType === 'json' && result != null ? structuredClone(result) : result;
  } catch (error) {
    if ([401, 403].includes(error.status) && valid()) {
      if (selected === 'administrator') window.dispatchEvent(new Event('auth:unauthorized'));
      if (selected === 'shared') {
        configureContentAccess('published');
        window.dispatchEvent(new Event('content:policy-changed'));
      }
    }
    if (
      method !== 'GET' &&
      (error.uncertainWrite ||
        error.code === 'transport_unavailable' ||
        [502, 503, 504].includes(error.status))
    ) {
      error.uncertainWrite = true;
      error.message +=
        ' This change may have been saved. Refresh its current revision before trying again.';
    }
    throw error;
  }
}
