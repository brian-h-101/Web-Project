import { useEffect, useState } from 'react'
import { downloadFile } from '../../../explorer/api/explorerApi.js'
export default function PdfViewer({ document }) {
  const [state, setState] = useState(null), key = document.id + ':' + document.revision
  const url = state?.key === key ? state.url : null, error = state?.key === key ? state.error : null
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl
    downloadFile(document.id, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })); setState({ key, url: objectUrl, error: null })
    }).catch(failure => { if (!controller.signal.aborted) setState({ key, url: null, error: failure.message }) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [document.id, document.revision, key])
  return <section aria-label="Read-only PDF preview"><p>Read-only PDF. If your browser cannot preview this file, use Download.</p>{error ? <p role="alert">{error}</p> : url ? <iframe className="document-pdf" title={'Read-only PDF: ' + document.name} src={url + '#view=FitH'} /> : <p role="status">Loading PDF…</p>}</section>
}
