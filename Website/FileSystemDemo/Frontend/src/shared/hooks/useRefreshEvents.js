import { useEffect } from 'react'
import { DOCUMENT_CHANGED } from '../../features/documents/api/documentApi.js'

// Collapse a focus/invalidation burst; a mutation event still invalidates an older
// pending read. Focus alone need not cancel a request already fetching fresh data.
export default function useRefreshEvents(refresh, busy) {
  useEffect(() => {
    let timer
    const changed = () => { clearTimeout(timer); timer = setTimeout(refresh, 200) }
    const focused = () => { if (!busy?.current) changed() }
    window.addEventListener(DOCUMENT_CHANGED, changed); window.addEventListener('focus', focused)
    return () => { clearTimeout(timer); window.removeEventListener(DOCUMENT_CHANGED, changed); window.removeEventListener('focus', focused) }
  }, [refresh, busy])
}
