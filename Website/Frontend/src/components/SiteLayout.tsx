import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { projects } from '../data/projects';

export function SiteLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const inProjects = (location.pathname === '/' && location.hash === '#projects') || projects.some(project => location.pathname === `/projects/${project.slug}`);
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <NavLink className={({ isActive }) => `brand${isActive ? ' active' : ''}`} to="/" end aria-label="Brian Ho home">Brian Ho<span className="brand-caption">Software engineering</span></NavLink>
      <nav aria-label="Main navigation">
        <Link className={inProjects ? 'active' : undefined} aria-current={inProjects ? 'page' : undefined} to="/#projects">Projects</Link>
        {['Engineering', 'About', 'Résumé', 'Contact'].map(label =>
          <NavLink key={label} to={label === 'Résumé' ? '/resume' : `/${label.toLowerCase()}`}>{label}</NavLink>
        )}
      </nav>
    </header>
    <main id="main" tabIndex={-1}>{children}</main>
    <footer className="site-footer">
      <Link to="/">Brian Ho</Link>
      <nav aria-label="Footer navigation"><Link to="/resume">Résumé</Link><a href="https://github.com/brian-h-101" target="_blank" rel="noopener noreferrer">GitHub<span className="sr-only"> (opens in a new tab)</span></a><a href="mailto:brianho101@gmail.com">Email</a></nav>
    </footer>
  </>;
}

