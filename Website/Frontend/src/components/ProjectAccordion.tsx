import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

export interface ProjectAccordionSection {
  id: string;
  title: string;
  subtitle: string;
  content: ReactNode;
}

export function ProjectAccordion({ sections }: { sections: ProjectAccordionSection[] }) {
  const location = useLocation();
  const targetId = sections.find(section => `#${section.id}` === location.hash)?.id;
  const [expandedIds, setExpandedIds] = useState<string[]>(() => targetId ? [targetId] : []);
  const [visitedIds, setVisitedIds] = useState<string[]>(() => targetId ? [targetId] : []);

  useEffect(() => {
    if (!targetId) return;
    setExpandedIds(current => current.includes(targetId) ? current : [...current, targetId]);
    setVisitedIds(current => current.includes(targetId) ? current : [...current, targetId]);
  }, [targetId, location.key]);

  function toggle(id: string) {
    setExpandedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
    setVisitedIds(current => current.includes(id) ? current : [...current, id]);
  }

  return <div className="project-accordion">
    {sections.map((section, index) => {
      const expanded = expandedIds.includes(section.id);
      return <section className="project-accordion-item" key={section.id}>
        <h2>
          <button
            type="button"
            id={section.id}
            className="project-accordion-toggle"
            aria-expanded={expanded}
            aria-controls={`${section.id}-panel`}
            aria-labelledby={`${section.id}-title`}
            aria-describedby={`${section.id}-subtitle`}
            onClick={() => toggle(section.id)}
          >
            <span className="accordion-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span className="accordion-label"><span id={`${section.id}-title`} className="accordion-title">{section.title}</span><span id={`${section.id}-subtitle`} className="accordion-subtitle">{section.subtitle}</span></span>
            <svg className="accordion-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </h2>
        <div id={`${section.id}-panel`} className="project-accordion-panel" role="region" aria-labelledby={`${section.id}-title`} hidden={!expanded}>
          {visitedIds.includes(section.id) && section.content}
        </div>
      </section>;
    })}
  </div>;
}

