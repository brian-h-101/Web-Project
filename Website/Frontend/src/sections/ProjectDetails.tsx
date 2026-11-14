import { Link, useParams } from 'react-router-dom';
import { projects } from '../data/projects';
import { Architecture } from '../components/Architecture';
import { ProjectLinks, DemoLaunch, safeSourceUrl } from '../components/ProjectLinks';
import { ProjectAccordion, type ProjectAccordionSection } from '../components/ProjectAccordion';
import { OptionalDemoPreview } from '../components/OptionalDemoPreview';
import { CommerceDemoViewer } from '../components/CommerceDemoViewer';
import { FileSystemDemoViewer } from '../components/FileSystemDemoViewer';
import { CRPGDemoViewer } from '../components/CRPGDemoViewer';
import { NotFound } from './Profile';

export function ProjectDetails() {
  const { slug } = useParams();
  const project = projects.find((item) => item.slug === slug);
  if (!project) {
    return <NotFound />;
  }
  const other = projects[(projects.indexOf(project) + 1) % projects.length];
  const sections: ProjectAccordionSection[] = [
    {
      id: 'implementation',
      title: 'Design Decisions',
      subtitle: 'The choices behind validation, state, and persistence.',
      content: (
        <div className="implementation-grid">
          {project.implementation.map((item, index) => (
            <section key={item.title}>
              <span className="item-number">0{index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </section>
          ))}
        </div>
      ),
    },
    {
      id: 'architecture',
      title: 'Architecture',
      subtitle: 'Components, boundaries, and information flow.',
      content: (
        <>
          <Architecture
            steps={project.architecture}
            stores={project.stores}
            label={
              project.demoKind === 'crpg'
                ? 'CRPG framework architecture'
                : project.name + ' request flow'
            }
            caption={project.architectureCaption}
            vertical={project.architectureVertical}
            groups={project.architectureGroups}
            {...(project.demoKind === 'crpg'
              ? { groupsLabel: 'Framework components', flowLabel: 'Action execution' }
              : {})}
          />
          <p className="diagram-note">{project.architectureNote}</p>
          <Link className="text-link" to="/engineering">
            Shared hosting and infrastructure →
          </Link>
        </>
      ),
    },
    {
      id: 'testing',
      title: 'Testing and Limitations',
      subtitle: 'Evidence, verification scope, and known limits.',
      content: (
        <>
          <div className="testing-grid">
            {project.testing.map((item) => (
              <section key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </section>
            ))}
          </div>
          {project.historicalVerification && (
            <details className="historical-records">
              <summary>Earlier verification records</summary>
              {project.historicalVerification.map((record) => (
                <section key={record.date}>
                  <h3>{record.title}</h3>
                  <time dateTime={record.date}>{record.date}</time>
                  <p>{record.detail}</p>
                </section>
              ))}
            </details>
          )}
          <aside className="note">
            <h3>Scope and Limitations</h3>
            <p>{project.limitations}</p>
            <p>{project.improvement}</p>
          </aside>
        </>
      ),
    },
  ];
  return (
    <article className="project-detail">
      <header className="project-detail-header">
        <nav className="project-breadcrumb" aria-label="Breadcrumb">
          <Link to="/#projects">Projects</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{project.name}</span>
        </nav>
        <h1>{project.name}</h1>
        <p>{project.description}</p>
        <div className="contribution">
          <h2>My contribution</h2>
          <p>{project.contribution}</p>
        </div>
        <ul className="tags" aria-label="Technology stack">
          {project.technologies.map((tech) => (
            <li key={tech}>{tech}</li>
          ))}
        </ul>
        <ProjectLinks project={project} />
      </header>
      <section
        className="case-study-section"
        id="overview"
        tabIndex={-1}
        aria-labelledby="overview-title"
      >
        <h2 id="overview-title">Overview</h2>
        <p>{project.overview}</p>
        <span className="status">{project.status}</span>
      </section>
      <section className="case-study-section" id="demo" tabIndex={-1} aria-labelledby="demo-title">
        <h2 id="demo-title">Try the demonstration</h2>
        <ol className="demo-instructions">
          {project.demoSteps.map((step) => {
            const demoUrl = step.linkedProjectSlug
              ? projects.find((item) => item.slug === step.linkedProjectSlug)?.demoUrl
              : undefined;
            return (
              <li key={step.text}>
                {demoUrl ? (
                  <a href={demoUrl} target="_top" rel="noopener noreferrer">
                    {step.text} <span aria-hidden="true">→</span>
                  </a>
                ) : (
                  step.text
                )}
              </li>
            );
          })}
        </ol>
        <DemoLaunch project={project} />
        {project.demoKind === 'crpg' && (
          <>
            <details className="other-demonstrations">
              <summary>Other demonstrations</summary>
              <nav aria-label="Other CRPG demonstrations">
                <a href="/demos/crpg-game/" target="_top" rel="noopener noreferrer">
                  Original North Gate Adventure →
                </a>
                <span>Open Capability Examples from the original adventure’s game header.</span>
                <a
                  href="/demos/crpg-game/?game=north-gate-code-first"
                  target="_top"
                  rel="noopener noreferrer"
                >
                  NorthGateCodeFirst →
                </a>
                <a
                  href="/demos/crpg-game/?game=code-first-capabilities"
                  target="_top"
                  rel="noopener noreferrer"
                >
                  CodeFirstCapabilityShowcase →
                </a>
              </nav>
            </details>
            <aside className="note saving-guidance">
              <h3>Controls and saving</h3>
              <p>
                Desktop keyboard and mouse are recommended. Finish or leave active dialogue or
                combat before switching games.
              </p>
              <p>
                Saves are stored in this browser for the current website address. After reloading,
                reopen the same game and select Load. Save and Load require confirmation. Browser
                storage can be cleared, and saves do not synchronize between browsers or website
                addresses.
              </p>
            </aside>
          </>
        )}
        <OptionalDemoPreview
          key={project.slug}
          kind={project.demoKind}
          label={
            project.demoKind === 'crpg'
              ? 'Show original adventure preview on this page'
              : 'Show preview on this page'
          }
        >
          {(visible) =>
            ({
              commerce: <CommerceDemoViewer />,
              filesystem: <FileSystemDemoViewer previewVisible={visible} />,
              crpg: <CRPGDemoViewer />,
            })[project.demoKind]
          }
        </OptionalDemoPreview>
      </section>
      <ProjectAccordion key={project.slug} sections={sections} />
      <nav className="end-navigation project-detail-footer" aria-label="Continue exploring">
        <Link className="text-link" to="/#projects">
          ← Return to projects
        </Link>
        <Link className="text-link next-project" to={'/projects/' + other.slug}>
          Next Project <span aria-hidden="true">→</span>
          <span className="sr-only">: {other.name}</span>
        </Link>
        <div className="project-footer-links">
          <Link className="text-link" to="/resume">
            View résumé →
          </Link>
          {safeSourceUrl(project.sourceUrl) && (
            <a
              className="text-link"
              href={project.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View project code ↗
            </a>
          )}
        </div>
      </nav>
    </article>
  );
}
