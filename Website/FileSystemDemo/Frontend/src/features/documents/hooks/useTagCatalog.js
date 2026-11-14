import { useCallback, useEffect, useRef, useState } from 'react'
import { getTags } from '../api/tagApi.js'
import useRefreshEvents from '../../../shared/hooks/useRefreshEvents.js'
export default function useTagCatalog() {
  const [state, setState] = useState({ tags: [], loading: true, error: null })
  const [generation, setGeneration] = useState(0), busy = useRef(false)
  const refresh = useCallback(() => setGeneration(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController(); busy.current = true
    getTags(controller.signal).then(tags => { if (!controller.signal.aborted) setState({ tags, generation, loading: false, error: null }) })
      .catch(error => { if (!controller.signal.aborted) setState({ tags: [], generation, loading: false, error: error.message }) }).finally(() => { if (!controller.signal.aborted) busy.current = false })
    return () => controller.abort()
  }, [generation])
  useRefreshEvents(refresh, busy)
  return { ...state, loading: state.generation !== generation, refresh }
}
