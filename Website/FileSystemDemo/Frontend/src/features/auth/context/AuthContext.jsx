import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import {
  configureContentAccess,
  contentPermissions,
  httpClient,
  setAccessToken,
} from '../../../shared/api/httpClient.js';
import { finishSignIn, signIn, signOut } from '../api/cognito.js';
export const AuthContext = createContext(null);
const visitor = { id: 'public', username: 'Shared visitor', role: 'visitor' };
const reading = ['nodes:read', 'documents:read'];
const loading = { status: 'loading', enabled: false, permissions: [] };
const modeFor = (user, policy) =>
  user.role === 'administrator'
    ? 'administrator'
    : policy.status === 'ready' && policy.enabled
      ? 'shared'
      : 'published';
const grantsFor = (user, policy) =>
  user.role === 'administrator'
    ? user.permissions
    : policy.status === 'ready' && policy.enabled
      ? policy.permissions
      : reading;
export function AuthProvider({ children }) {
  const [user, setUser] = useState(visitor),
    [policy, setPolicy] = useState(loading),
    [error, setError] = useState(null);
  const userRef = useRef(visitor),
    policyRef = useRef(loading),
    started = useRef(false),
    request = useRef(null);
  const apply = (profile, config) =>
    configureContentAccess(
      modeFor(profile, config),
      modeFor(profile, config) === 'published' ? [] : grantsFor(profile, config),
    );
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    policyRef.current = loading;
    setPolicy(loading);
    apply(userRef.current, loading);
    try {
      const config = (await httpClient('/api/catalog/config', { signal: controller.signal }))
        .publicManagement;
      if (
        !config ||
        config.version !== 'shared-content-v1' ||
        config.workspace !== 'shared-demo-workspace' ||
        typeof config.enabled !== 'boolean' ||
        !Array.isArray(config.permissions) ||
        config.permissions.some((p) => !contentPermissions.includes(p)) ||
        (config.enabled &&
          (config.permissions.length !== contentPermissions.length ||
            new Set(config.permissions).size !== contentPermissions.length)) ||
        (!config.enabled && config.permissions.length)
      )
        throw new Error('Shared workspace capabilities could not be verified.');
      if (controller.signal.aborted) return;
      policyRef.current = { ...config, status: 'ready' };
      apply(userRef.current, policyRef.current);
      setPolicy(policyRef.current);
    } catch (failure) {
      if (controller.signal.aborted) return;
      policyRef.current = {
        status: 'error',
        enabled: false,
        permissions: [],
        error: failure.message,
      };
      apply(userRef.current, policyRef.current);
      setPolicy(policyRef.current);
    }
  }, []);
  const invalidate = useCallback(() => {
    setAccessToken(null);
    userRef.current = visitor;
    apply(visitor, policyRef.current);
    setUser(visitor);
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener('auth:unauthorized', invalidate);
    window.addEventListener('content:policy-changed', refresh);
    return () => {
      request.current?.abort();
      configureContentAccess('published');
      window.removeEventListener('auth:unauthorized', invalidate);
      window.removeEventListener('content:policy-changed', refresh);
    };
  }, [invalidate, refresh]);
  const login = async () => {
    if (window.top !== window.self) {
      window.open(
        '/demos/file-system-simulator/index.html?signin=1',
        '_blank',
        'noopener,noreferrer',
      );
      return;
    }
    try {
      await signIn();
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    if (!started.current && new URLSearchParams(location.search).get('signin') === '1') {
      started.current = true;
      history.replaceState(null, '', location.pathname);
      signIn().catch((e) => setError(e.message));
    }
  }, []);
  const complete = async () => {
    const profile = await finishSignIn();
    if (
      profile?.role !== 'administrator' ||
      !profile.id ||
      !Array.isArray(profile.permissions) ||
      profile.permissions.some((p) => !contentPermissions.includes(p))
    ) {
      invalidate();
      throw new Error('Administrator identity could not be verified.');
    }
    userRef.current = profile;
    apply(profile, policyRef.current);
    setUser(profile);
    return profile;
  };
  const logout = async () => {
    invalidate();
    try {
      await signOut();
    } catch (e) {
      setError(e.message);
    }
  };
  const mode = modeFor(user, policy),
    permissions = grantsFor(user, policy);
  return (
    <AuthContext.Provider
      value={{
        user,
        role: user.role,
        permissions,
        status: user.role === 'administrator' ? 'authenticated' : 'anonymous',
        contentMode: mode,
        capabilityStatus: user.role === 'administrator' ? 'ready' : policy.status,
        accessKey: user.id + ':' + mode + ':' + permissions.join(','),
        error: error || policy.error,
        login,
        logout,
        complete,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
