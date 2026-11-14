import { useEffect, useRef, useState } from 'react';
const demoUrl = '/demos/commerce-ordering-platform/index.html';
export function CommerceDemoViewer() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    function message(event: MessageEvent) {
      const data = event.data;
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || !data || data.source !== 'commerce-demo' || data.type !== 'catalog-state' || !['loading', 'ready', 'unavailable'].includes(data.state)) return;
      setState(data.state);
    }
    window.addEventListener('message', message);
    return () => window.removeEventListener('message', message);
  }, []);
  return <div className="demo-viewer" aria-label="Commerce demonstration">
    <p className="demo-availability" role="status">{state === 'ready' ? 'Product catalog loaded in the workspace.' : state === 'unavailable' ? 'Product catalog unavailable. Use Reload catalog in the workspace.' : 'Waiting for the workspace to load its product catalog…'}</p>
    <a className="text-link" href={demoUrl} target="_top" rel="noopener noreferrer">Open the Commerce demonstration in this tab →</a>
    <iframe ref={frame} src={demoUrl} title="Commerce Ordering Platform AWS demonstration" loading="lazy" referrerPolicy="same-origin" onLoad={() => frame.current?.contentWindow?.postMessage({ source: 'portfolio-demo', type: 'commerce-status-request' }, window.location.origin)} />
  </div>;
}
