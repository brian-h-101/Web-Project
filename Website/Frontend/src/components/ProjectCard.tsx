import { Link } from 'react-router-dom';
import type { Project } from '../types/project';

export function ProjectCard({ project, index }: { project: Project; index: number }) {
  const isCrpgFramework = project.slug === 'crpg-framework';

  const actionUrl = isCrpgFramework
    ? 'https://github.com/brian-h-101/Framework-project'
    : project.recommendedDemoUrl || project.demoUrl;

  return <article className="project-card" aria-labelledby={`project-${project.slug}`}>
    <div className="card-meta"><span className="eyebrow">PROJECT {String(index + 1).padStart(2, '0')}</span><span className="status">{project.status}</span></div>
    <h3 id={`project-${project.slug}`}><Link to={`/projects/${project.slug}`}>{project.name}</Link></h3>
    <p>{project.description}</p>
    <p className="engineering-focus"><strong>Engineering focus:</strong> {project.engineeringFocus}</p>
    <div className="card-actions">
      <Link className="text-link" to={`/projects/${project.slug}`}>
        View project <span aria-hidden="true">→</span>
        <span className="sr-only"> — {project.name}</span>
      </Link>

      <a
        className="text-link"
        href={actionUrl}
        target={isCrpgFramework ? '_blank' : '_top'}
        rel="noopener noreferrer"
      >
        {isCrpgFramework ? 'View on GitHub' : 'Try demo'}{' '}
        <span aria-hidden="true">→</span>
        <span className="sr-only"> — {project.name}</span>
      </a>
    </div>
  </article>;
}

