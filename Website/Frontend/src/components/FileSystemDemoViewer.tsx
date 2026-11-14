import { useEffect, useRef, useState } from 'react';
export function FileSystemDemoViewer({ previewVisible = true }: { previewVisible?: boolean }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const url = '/demos/file-system-simulator/database';
  const sendVisibility = () => iframe.current?.contentWindow?.postMessage({ kind:'filesystem-preview-visibility',version:1,visible:previewVisible && document.visibilityState === 'visible' },location.origin);
  useEffect(() => {
    const ready = (event: MessageEvent) => { if(event.origin===location.origin && event.source===iframe.current?.contentWindow && event.data?.kind==='filesystem-preview-ready' && event.data.version===1 && Object.keys(event.data).length===2)sendVisibility(); };
    window.addEventListener('message',ready);document.addEventListener('visibilitychange',sendVisibility);sendVisibility();
    return () => {window.removeEventListener('message',ready);document.removeEventListener('visibilitychange',sendVisibility);};
  },[previewVisible]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { setAvailable(false); controller.abort(); }, 5000);
    fetch('/api/filesystem/health', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!controller.signal.aborted) setAvailable(response.ok && body.status === 'ok' && body.service === 'filesystem-catalog');
    }).catch(() => { if (!controller.signal.aborted) setAvailable(false); }).finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, []);
  return <div className="demo-viewer" aria-label="File-System demonstration">{available !== true && <p className="demo-availability" role="status">{available === null ? 'Checking File-System connection…' : 'File-System connection check failed. Each collection reports its own read results below.'}</p>}<a className="text-link" href={url} target="_top" rel="noopener noreferrer">Open Database Explorer →</a><iframe ref={iframe} src={url} onLoad={sendVisibility} title="File-System Simulator AWS demonstration" loading="lazy" referrerPolicy="same-origin" /></div>;
}
