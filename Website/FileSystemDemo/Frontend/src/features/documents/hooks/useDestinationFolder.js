import { useCallback, useEffect, useRef, useState } from 'react'
import { getNode, getRoot } from '../../explorer/api/explorerApi.js'

export default function useDestinationFolder(parent, needed, accessKey) {
  const key = JSON.stringify([parent, accessKey]), sequence = useRef(0)
  const [generation, setGeneration] = useState(0), [state, setState] = useState(null)
  const retry = useCallback(() => setGeneration(n => n + 1), [])
  useEffect(() => {
    const controller = new AbortController(), version = ++sequence.current
    if (!needed) return () => controller.abort()
    setState({ key, generation, folder: null, loading: true, error: null })
    ;(async () => {
      const id = parent || (await getRoot(controller.signal)).rootId
      const folder = await getNode(id, controller.signal)
      if (folder.type !== 'folder') throw new Error('Choose an existing virtual folder in Explorer.')
      if (!controller.signal.aborted && sequence.current === version) setState({ key, generation, folder, loading: false, error: null })
    })().catch(error => {
      if (!controller.signal.aborted && sequence.current === version) setState({ key, generation, folder: null, loading: false, error: error.message })
    })
    return () => { controller.abort(); sequence.current++ }
  }, [parent, needed, key, generation])
  const current = needed && state?.key === key && state.generation === generation
  return { ...(current ? state : { folder: null, loading: needed, error: null }), retry }
}
