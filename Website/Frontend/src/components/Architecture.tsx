import type { ArchitectureStep } from '../types/project';

export function Architecture({ steps, stores = [], label, caption, vertical = false, groups = [], groupsLabel, flowLabel }: { steps: ArchitectureStep[]; stores?: ArchitectureStep[]; label: string; caption?: string; vertical?: boolean; groups?: ArchitectureStep[]; groupsLabel?: string; flowLabel?: string }) {
  return <figure className={`architecture${vertical ? ' architecture-vertical' : ''}`} aria-label={label}>
    <figcaption>{label}<span>{caption || 'Request flow · responses return along the same path'}</span></figcaption>
    {groups.length > 0 && <>{groupsLabel && <h3 className="architecture-section-heading">{groupsLabel}</h3>}<ul className="architecture-groups">{groups.map(group => <li key={group.name}><strong>{group.name}</strong><p>{group.description}</p></li>)}</ul></>}
    {flowLabel && steps.length > 0 && <h3 className="architecture-section-heading">{flowLabel}</h3>}
    <ol className="architecture-flow">{steps.map((step, index) => <li key={step.name}>
      <span className="node-index">{String(index + 1).padStart(2, '0')}</span><strong>{step.name}</strong><p>{step.description}</p>
      {index < steps.length - 1 && <span className="flow-arrow" aria-hidden="true">{vertical ? '↓' : '→'}</span>}
    </li>)}</ol>
    {stores.length > 0 && <><div className="branch-label"><span aria-hidden="true">↓</span> Lambda reads / writes through scoped IAM roles</div><ul className="architecture-stores">{stores.map(store => <li key={store.name}><strong>{store.name}</strong><p>{store.description}</p></li>)}</ul></>}
  </figure>;
}

