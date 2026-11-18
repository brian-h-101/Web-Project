import { Link, useParams } from 'react-router-dom';
import { projects } from '../data/projects';
import { Architecture } from '../components/Architecture';
import { ProjectLinks, DemoLaunch, safeSourceUrl } from '../components/ProjectLinks';
import { ProjectAccordion, type ProjectAccordionSection } from '../components/ProjectAccordion';
import { OptionalDemoPreview } from '../components/OptionalDemoPreview';
import { CommerceDemoViewer } from '../components/CommerceDemoViewer';
import { FileSystemDemoViewer } from '../components/FileSystemDemoViewer';
import { NotFound } from './Profile';

export function ProjectDetails() {
  const { slug } = useParams();
  const project = projects.find((item) => item.slug === slug);
  if (!project) {
    return <NotFound />;
  }
  const other = projects[(projects.indexOf(project) + 1) % projects.length];
  const isCrpgFramework = project.slug === 'crpg-framework';
  const demonstration = (
    <div className={`project-demonstration demonstration-${project.demoKind}`}>
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
      {!isCrpgFramework && (
        <OptionalDemoPreview
          key={project.slug}
          kind={project.demoKind}
          label="Show preview on this page"
        >
          {(visible) =>
            project.demoKind === 'commerce'
              ? <CommerceDemoViewer />
              : <FileSystemDemoViewer previewVisible={visible} />
          }
        </OptionalDemoPreview>
      )}
    </div>
  );
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
            {isCrpgFramework ? 'Portfolio hosting and infrastructure →' : 'Shared hosting and infrastructure →'}
          </Link>
        </>
      ),
    },
    {
      id: 'demo',
      title: isCrpgFramework
        ? 'Current Framework State'
        : 'Try the Demonstration',
      subtitle: isCrpgFramework
        ? 'Implemented capabilities and architectural direction.'
        : 'Open the live demonstration and follow the steps below.',
      content: isCrpgFramework && project.frameworkState ? (
        <>
          <p className="panel-intro">
            {project.frameworkState.intro}
          </p>

          {project.frameworkState.authoring && (
            <section
              className="framework-authoring"
              aria-labelledby="framework-authoring-title"
            >
              <h3 id="framework-authoring-title">
                {project.frameworkState.authoring.title}
              </h3>

              <p>{project.frameworkState.authoring.detail}</p>
              <p>{project.frameworkState.authoring.rulesEngine}</p>

              <details className="framework-image-disclosure">
                <summary className="button button-secondary">
                  <span className="framework-image-show">Show Framework Resources image</span>
                  <span className="framework-image-hide">Hide Framework Resources image</span>
                </summary>

                <figure className="framework-authoring-figure">
                  <img
                    src={project.frameworkState.authoring.image.src}
                    alt={project.frameworkState.authoring.image.alt}
                    width={project.frameworkState.authoring.image.width}
                    height={project.frameworkState.authoring.image.height}
                    loading="lazy"
                    decoding="async"
                  />

                  <figcaption>
                    {project.frameworkState.authoring.image.caption}
                  </figcaption>
                </figure>
              </details>
            </section>
          )}

          <div className="implementation-grid">
            {project.frameworkState.sections.map((section) => (
              <section key={section.title}>
                <h3>{section.title}</h3>
                <p>{section.detail}</p>
              </section>
            ))}
          </div>

          <div className="actions">
            <DemoLaunch project={project} />
          </div>
        </>
      ) : demonstration,
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
