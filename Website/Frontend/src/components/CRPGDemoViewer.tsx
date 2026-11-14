import { useEffect, useRef, useState } from 'react';

export function CRPGDemoViewer() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'slow'>('loading');
  useEffect(() => {
    const timer = setTimeout(() => setState(current => current === 'loading' ? 'slow' : current), 45000);
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.source !== 'crpg-game') return;
      if (event.data.state === 'ready' || event.data.state === 'error') { setState(event.data.state); clearTimeout(timer); }
    };
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); clearTimeout(timer); };
  }, []);
  return <div className="demo-viewer crpg-viewer" aria-label="CRPG demonstration">
    <p>This preview runs Original North Gate Adventure. The guided showcase opens Code-First Feature Demo in this tab. Click inside the preview to use the keyboard.</p>
    <p className="demo-availability" role="status">{state === 'ready' ? 'CRPG runtime ready' : state === 'error' ? 'The game could not start. Try the standalone demo in a WebGL 2 capable browser.' : state === 'slow' ? 'The game is still loading. The standalone demo may offer more space; check your browser supports WebGL 2.' : 'Loading the Godot runtime and game assets…'}</p>
    <div className="actions"><a className="text-link" href="/demos/crpg-game/" target="_top" rel="noopener noreferrer">Open Original North Gate Adventure →</a><button className="button button-secondary" type="button" onClick={() => frame.current?.requestFullscreen().catch(() => setState('error'))}>Expand preview to full screen</button></div>
    <iframe ref={frame} src="/demos/crpg-game/" title="CRPG Framework Godot demonstration" allow="fullscreen; autoplay" allowFullScreen referrerPolicy="same-origin" onError={() => setState('error')} />
  </div>;
}
