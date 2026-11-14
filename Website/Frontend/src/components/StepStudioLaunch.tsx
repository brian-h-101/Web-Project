import { useRef, useState } from 'react';

const studioUrl = 'https://step.brianho101-personal-project-demonstrations.com/demos/step-studio/';

// Portfolio-owned launch control; STEP retains its own authenticated player.
function createStudioLauncher() {
  let studio: Window | null = null;
  return () => {
    try {
      if (studio && !studio.closed) {
        studio.focus();
        return true;
      }
    } catch {
      // Browser isolation can sever a cross-origin window reference.
      studio = null;
    }
    studio = window.open('about:blank', '_blank', 'popup,width=1280,height=900');
    if (!studio) return false;
    try {
      studio.opener = null;
      studio.location.replace(studioUrl);
      return true;
    } catch {
      studio.close();
      studio = null;
      return false;
    }
  };
}

export function StepStudioLaunch() {
  const launch = useRef<ReturnType<typeof createStudioLauncher> | null>(null);
  const [blocked, setBlocked] = useState(false);
  if (!launch.current) launch.current = createStudioLauncher();

  function openStudio() {
    // Open synchronously in the user action, before scheduling a React update.
    setBlocked(!launch.current!());
  }

  return <div>
    <div className="actions">
      <button type="button" className="button button-secondary" onClick={openStudio}>Launch STEP Studio</button>
      <a className="text-link" href={studioUrl} target="_blank" rel="noopener noreferrer">Open STEP Studio using a normal link (new window or tab)</a>
    </div>
    {blocked && <p role="status">The Studio window could not open. Use the ordinary link, or allow this site's popups.</p>}
  </div>;
}
