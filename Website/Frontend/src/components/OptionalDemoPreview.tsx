import { useState, type ReactNode } from 'react';

// First activation owns the child lifecycle. Hiding never replaces its browsing context.
export function OptionalDemoPreview({ kind, label, children }: { kind: string; label: string; children: ReactNode | ((visible: boolean) => ReactNode) }) {
  const [opened, setOpened] = useState(false), [mounted, setMounted] = useState(false);
  return <div className={`optional-preview preview-${kind}`}>
    <button className="button button-secondary" type="button" id="preview-toggle" aria-expanded={opened} aria-controls="preview-panel" onClick={() => { setMounted(true); setOpened(value => !value); }}>{opened ? 'Hide preview' : label}</button>
    <div id="preview-panel" role="region" aria-labelledby="preview-toggle" hidden={!opened}>{mounted && (typeof children === 'function' ? children(opened) : children)}</div>
  </div>;
}
