import { Link } from 'react-router-dom';
import { useId } from 'react';
import type { Project } from '../types/project';

export function DemoLaunch({ project }: { project: Project }) {
  const guidanceId = useId();
  const isCrpgFramework = project.slug === 'crpg-framework';

  const actionUrl = isCrpgFramework
    ? 'https://github.com/brian-h-101/Framework-project'
    : project.recommendedDemoUrl || project.demoUrl;

  const label = {
    commerce: 'Open Ordering demo',
    filesystem: 'Open Database Explorer',
    crpg: 'View on GitHub',
  }[project.demoKind];

  return (
    <div className="demo-launch">
      <a
        className="button"
        href={actionUrl}
        target={isCrpgFramework ? '_blank' : '_top'}
        rel="noopener noreferrer"
        aria-describedby={guidanceId}
      >
        {label} <span aria-hidden="true">→</span>
        <span className="sr-only"> — {project.name}</span>
      </a>

      <span id={guidanceId} className="launch-guidance">
        {isCrpgFramework
          ? 'Opens the GitHub repository in a new tab.'
          : 'Opens in this tab. Use Back to return.'}
      </span>
    </div>
  );
}

export function safeSourceUrl(url?: string): boolean {
  try {
    const parsed = new URL(url || '');
    return parsed.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) && !parsed.username && !parsed.password;
  } catch { return false; }
}
export function ProjectLinks({ project }: { project: Project }) {
  return <div className="actions">
    <DemoLaunch project={project}/>
    <Link className="button button-secondary" to="#implementation">Explore engineering details <span aria-hidden="true">↓</span></Link>
    {safeSourceUrl(project.sourceUrl) && <a className="text-link" href={project.sourceUrl} target="_blank" rel="noopener noreferrer">View project code<span className="sr-only"> (opens in a new tab)</span> ↗</a>}
  </div>;
}

