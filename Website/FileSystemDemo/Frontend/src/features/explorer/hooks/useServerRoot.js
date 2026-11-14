import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/explorerApi.js'

export default function useServerRoot() {
  const [attempt, setAttempt] = useState(0)
  const [connection, setConnection] = useState({ status: 'loading', root: null, error: null })
  const retry = useCallback(() => { setConnection(previous => ({ ...previous, status: 'loading', error: null })); setAttempt(value => value + 1) }, [])
  const failConnection = useCallback(error => {
    if (error.name !== 'AbortError' && (error.status === 0 || error.status >= 500)) {
      setConnection(previous => ({ ...previous, status: 'error', error: error.message }))
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    const connect = async () => {
      try {
        const health = await api.getHealth(controller.signal)
        if (health.status !== 'ok' || health.service !== 'filesystem-catalog') throw new Error('The filesystem service is unavailable.')
        const { rootId } = await api.getRoot(controller.signal)
        if (typeof rootId !== 'string') throw new Error('The backend returned an invalid root identifier.')
        const root = await api.getNode(rootId, controller.signal)
        if (root.type !== 'folder' || root.parentId !== null) throw new Error('The backend root is invalid.')
        if (!controller.signal.aborted) setConnection({ status: 'connected', root, error: null })
      } catch (error) {
        if (!controller.signal.aborted) setConnection(previous => ({ ...previous, status: 'error', error: error.message }))
      }
    }
    connect()
    return () => controller.abort()
  }, [attempt])
  return { ...connection, retry, failConnection }
}
