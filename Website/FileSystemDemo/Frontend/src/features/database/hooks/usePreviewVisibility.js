import { useEffect, useState } from 'react'
export const visibilityMessage = value => value && Object.keys(value).length === 3 && value.kind === 'filesystem-preview-visibility' && value.version === 1 && typeof value.visible === 'boolean'
export default function usePreviewVisibility() {
  const embedded = window.self !== window.top
  const [state,setState] = useState({active:!embedded && document.visibilityState === 'visible',revision:0})
  useEffect(() => {
    let allowed = !embedded
    const update = () => setState(old => ({active:allowed && document.visibilityState === 'visible',revision:old.revision+1}))
    const message = event => { if (embedded && event.origin === location.origin && event.source === window.parent && visibilityMessage(event.data)) { const changed=allowed!==event.data.visible;allowed=event.data.visible;if(changed)update() } }
    const focus = () => { if(document.visibilityState==='visible')update() }
    window.addEventListener('message',message);document.addEventListener('visibilitychange',update);window.addEventListener('focus',focus);window.addEventListener('pageshow',focus)
    if(embedded)window.parent.postMessage({kind:'filesystem-preview-ready',version:1},location.origin)
    return () => {window.removeEventListener('message',message);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',focus);window.removeEventListener('pageshow',focus)}
  },[embedded])
  return state
}
