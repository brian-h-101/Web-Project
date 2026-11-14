import { useCallback, useEffect, useRef, useState } from 'react'
import { getDocument, getContent } from '../api/documentApi.js'
import useRefreshEvents from '../../../shared/hooks/useRefreshEvents.js'
import { isEditableFormat } from '../model/documentModel.js'
export default function useDocument(id) {
  const [state, setState] = useState({ document: null, content: '', contentError: null, loading: true, error: null })
  const [generation, setGeneration] = useState(0), sequence = useRef(0), busy = useRef(false)
  const refresh = useCallback(() => setGeneration(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController(), version = ++sequence.current; busy.current = true
    ;(async () => {
      const document = await getDocument(id, controller.signal)
      let content = '', contentError = null
      if (isEditableFormat(document.format)) {
        try {
          const result = await getContent(id, controller.signal)
          if (result.revision !== document.revision) throw new Error('The document changed while loading. Refresh to load a consistent revision.')
          content = result.content
        } catch (error) { if (error.status === 400) contentError = error.message; else throw error }
      }
      if (version === sequence.current && !controller.signal.aborted) setState({ document, content, contentError, id, generation, loading: false, error: null })
    })().catch(error => { if (!controller.signal.aborted && version === sequence.current) setState({ document: null, content: '', contentError: null, id, generation, loading: false, error: error.message }) }).finally(() => { if (version === sequence.current) busy.current = false })
    return () => controller.abort()
  }, [id, generation])
  useRefreshEvents(refresh, busy)
  return { ...state, loading: state.id !== id || state.generation !== generation, refresh }
}
