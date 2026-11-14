import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router';
import '../../../../Shared/demo-theme.css';
import '../../../../Frontend/shared/demo-notices.css';
import useAuth from '../features/auth/hooks/useAuth.js';
import ExplorerPage from '../pages/ExplorerPage.jsx';
import DocumentLibraryPage from '../pages/DocumentLibraryPage.jsx';
import DocumentPage from '../pages/DocumentPage.jsx';
import DatabaseExplorerPage from '../pages/DatabaseExplorerPage.jsx';
import CatalogPage from '../pages/CatalogPage.jsx';
function Callback() {
  const auth = useAuth(),
    navigate = useNavigate(),
    once = useRef(false),
    [error, setError] = useState(null);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    auth
      .complete()
      .then(() => navigate('/explorer', { replace: true }))
      .catch((e) => setError(e.message));
  }, [auth, navigate]);
  return (
    <main className="document-detail">
      {error ? <p role="alert">{error}</p> : <p role="status">Verifying administrator access…</p>}
    </main>
  );
}
export default function AppRoutes() {
  const auth = useAuth(),
    admin = auth.user.role === 'administrator',
    shared = auth.contentMode === 'shared';
  const pageKey = auth.accessKey || auth.user.id;
  const databaseRoute = /^\/database\/?$/.test(useLocation().pathname);
  const embedded = window.self !== window.top;
  return (
    <div className="filesystem-demo" data-presentation={embedded ? 'embedded' : 'standalone'}>
      {!embedded && (
        <>
          <header className="demo-header">
            <div className="demo-identity">
              Brian Ho <span>File-System Simulator</span>
            </div>
            <nav className="demo-links" aria-label="Portfolio navigation">
              <a href="/projects/file-system-simulator">Back to Project</a>
              <a href="/#projects">Projects</a>
            </nav>
          </header>
          {!databaseRoute && (
            <section className="demo-intro">
              <h1>File-System Simulator</h1>
              <p>Organize folders, view documents, and search names and tags.</p>
            </section>
          )}
        </>
      )}
      {!databaseRoute && (
        <section className="demo-notice" aria-label="Workspace notice">
          <p>
            <strong>
              {admin
                ? 'Administrator signed in. Your existing content permissions apply.'
                : shared
                  ? 'Shared workspace: changes are visible to everyone, including unpublished drafts. Use sample content only.'
                  : auth.capabilityStatus === 'loading'
                    ? 'Checking shared workspace capabilities…'
                    : auth.capabilityStatus === 'error'
                      ? 'Browsing only. Shared workspace capabilities could not be verified.'
                      : 'Published browsing only. Shared visitor management is not enabled.'}
            </strong>
          </p>
          <details>
            <summary>How this workspace works</summary>
            <p>
              {shared || admin
                ? 'Shared content includes drafts. Ordinary content changes do not grant account, AWS, reset, or recovery administration.'
                : 'Content actions depend on verified server capabilities. Administrator access requires a separate sign-in.'}
            </p>
            <p>
              {import.meta.env.VITE_CATALOG_RESET_ACTIVE === 'true'
                ? 'The product catalog returns to the original five nightly at 12 AM America/New_York.'
                : 'Daily product reset is not active in this build.'}{' '}
              Documents and folders are not restored by that reset.
            </p>
          </details>
        </section>
      )}
      <nav className="aws-navigation" aria-label="Demo navigation">
        <NavLink to="/database">Database explorer</NavLink>
        <NavLink to="/explorer">File workspace</NavLink>
        <NavLink to="/documents">Documents</NavLink>
        <NavLink to="/catalog">Product catalog</NavLink>
        <span>
          {databaseRoute
            ? 'Read-only records'
            : admin
              ? 'Administrator signed in'
              : auth.capabilityStatus === 'loading'
                ? 'Checking workspace access…'
                : auth.capabilityStatus === 'error'
                  ? 'Published content · view only — configuration unverified'
                  : shared && auth.capabilityStatus === 'ready'
                    ? 'Shared workspace · editing enabled'
                    : 'Published content · view only'}
        </span>
        {admin ? (
          <button onClick={auth.logout}>Sign out</button>
        ) : (
          <button onClick={auth.login}>Administrator sign in</button>
        )}
      </nav>
      {auth.error && (
        <p role="alert" className="document-error">
          {databaseRoute ? 'Workspace configuration: ' : ''}
          {auth.error} <button onClick={auth.refresh}>Retry workspace configuration</button>
        </p>
      )}
      <Routes>
        <Route path="/database" element={<DatabaseExplorerPage />} />
        <Route path="/auth/callback" element={<Callback />} />
        {[
          { path: '/explorer', page: <ExplorerPage key={pageKey} /> },
          { path: '/documents', page: <DocumentLibraryPage key={pageKey} /> },
          { path: '/documents/:id', page: <DocumentPage key={pageKey} /> },
          { path: '/catalog', page: <CatalogPage key={pageKey} /> },
        ].map(({ path, page }) => (
          <Route
            key={path}
            path={path}
            element={
              auth.capabilityStatus === 'loading' ? (
                <main className="document-detail">
                  <p role="status">Loading workspace configuration before requesting content…</p>
                </main>
              ) : (
                page
              )
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/database" replace />} />
      </Routes>
    </div>
  );
}
