import { useCallback, useEffect, useRef, useState } from 'react'
import { getDocuments } from '../api/documentApi.js'
import useRefreshEvents from '../../../shared/hooks/useRefreshEvents.js'
export default function useDocuments(parameters) {
  const key = JSON.stringify(parameters)
  const [state, setState] = useState({ documents: [], total: 0, nextCursor: null, loading: true, error: null })
  const [generation, setGeneration] = useState(0)
  const request = useRef(null), sequence = useRef(0), busy = useRef(false)
  const refresh = useCallback(() => setGeneration(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController(), version = ++sequence.current
    request.current?.abort(); request.current = controller; busy.current = true
    const timer = setTimeout(() => getDocuments(JSON.parse(key), controller.signal).then(result => { if (!controller.signal.aborted && version === sequence.current) setState({ ...result, key, generation, loading: false, error: null }) })
      .catch(error => { if (!controller.signal.aborted && version === sequence.current) setState({ documents: [], total: 0, nextCursor: null, key, generation, loading: false, error: error.message }) })
      .finally(() => { if (version === sequence.current) busy.current = false }), JSON.parse(key).search ? 250 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [key, generation])
  useRefreshEvents(refresh, busy)
  const loadMore = async () => {
    if (state.loading || !state.nextCursor) return
    const version = sequence.current, controller = new AbortController()
    request.current?.abort(); request.current = controller
    busy.current = true
    setState(previous => ({ ...previous, loading: true, error: null }))
    try {
      const result = await getDocuments({ ...JSON.parse(key), cursor: state.nextCursor }, controller.signal)
      if (version === sequence.current) setState(previous => ({ ...result, key, generation,
        documents: [...previous.documents, ...result.documents.filter(document => !previous.documents.some(existing => existing.id === document.id))], loading: false, error: null }))
    } catch (error) { if (!controller.signal.aborted && version === sequence.current) setState(previous => ({ ...previous, loading: false, error: error.message })) }
    finally { if (version === sequence.current) busy.current = false }
  }
  useEffect(() => () => { sequence.current++; request.current?.abort() }, [])
  const current = state.key === key && state.generation === generation
  return { ...(current ? state : { documents: [], total: 0, nextCursor: null, loading: true, error: null }), refresh, loadMore }
}
