import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Home } from './sections/Home';
import { ProjectDetails } from './sections/ProjectDetails';
import { Engineering } from './sections/Engineering';
import { About, Contact, NotFound, Resume } from './sections/Profile';
import { SiteLayout } from './components/SiteLayout';
import { projects } from './data/projects';

declare const __SITE_URL__: string;

export default function App() {
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${__SITE_URL__}${location.pathname}`;
    const project = projects.find(item => location.pathname === `/projects/${item.slug}`);
    const titles: Record<string, string> = { '/engineering': 'How This Portfolio Runs on AWS', '/about': 'About', '/resume': 'Résumé', '/contact': 'Contact' };
    document.title = location.pathname === '/' ? 'Brian Ho — Software Developer' : `${project?.name || titles[location.pathname] || 'Page not found'} — Brian Ho`;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = project?.description || 'Brian Ho’s software development portfolio: web applications, cloud infrastructure, and reusable game systems.';
    const frame = requestAnimationFrame(() => {
      if (location.hash) {
        const section = document.getElementById(location.hash.slice(1));
        section?.scrollIntoView();
        section?.focus({ preventScroll: true });
      } else {
        window.scrollTo(0, 0);
        if (previousPath.current !== location.pathname) document.getElementById('main')?.focus({ preventScroll: true });
      }
      previousPath.current = location.pathname;
    });
    return () => cancelAnimationFrame(frame);
  }, [location]);
  return <SiteLayout><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/projects" element={<Navigate to="/#projects" replace />} />
    <Route path="/projects/:slug" element={<ProjectDetails />} />
    <Route path="/engineering" element={<Engineering />} />
    <Route path="/about" element={<About />} />
    <Route path="/resume" element={<Resume />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="*" element={<NotFound />} />
  </Routes></SiteLayout>;
}

