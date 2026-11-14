import { useEffect, useRef, useState } from 'react'
import { downloadFile } from '../../api/explorerApi.js'
import { useExplorerContext } from '../../context/ExplorerContext.jsx'
import { formatFileSize, formatFileType } from '../../utils/fileFormatting.js'

export default function FilePreview({ node, onClose, onDownload }) {
  const dialog = useRef(null)
  const { revision, connection, feedback } = useExplorerContext()
  const { failConnection } = connection
  const nodeId = node?.id
  const updatedAt = node?.updatedAt
  const isImage = node?.mimeType?.startsWith('image/')
  const isText = node?.mimeType?.startsWith('text/') || /\.(txt|md|json|jsx?|css|html|csv)$/i.test(node?.name || '')
  const [attempt, setAttempt] = useState(0)
  const [downloadFailed, setDownloadFailed] = useState(false)
  const [content, setContent] = useState({ loading: true, text: null, url: null, error: null })
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close() }, [])
  useEffect(() => {
    const controller = new AbortController()
    let url
    Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      setContent({ loading: !!nodeId && (isImage || isText), text: null, url: null, error: null })
      if (nodeId && (isImage || isText)) {
        const blob = await downloadFile(nodeId, controller.signal)
        if (controller.signal.aborted) return
        const text = isText && !isImage ? await blob.text() : null
        if (controller.signal.aborted) return
        url = isImage ? URL.createObjectURL(blob) : null
        setContent({ loading: false, text, url, error: null })
      }
    }).catch(error => {
        if (!controller.signal.aborted) {
          failConnection(error)
          setContent({ loading: false, text: null, url: null, error: error.message })
        }
    })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [nodeId, updatedAt, isImage, isText, revision, attempt, failConnection])
  return <dialog ref={dialog} className="explorer-dialog preview-dialog" aria-labelledby="preview-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="preview-heading"><h2 id="preview-title">{node?.name || 'File unavailable'}</h2><button autoFocus aria-label="Close preview" onClick={onClose}>×</button></div>
    {node && <p className="preview-meta">{formatFileType(node)} · {formatFileSize(node.size)}</p>}
    {!node ? <p role="alert">The selected file no longer exists.</p> : content.loading ? <p role="status">Reading file contents…</p> :
      content.error ? <div role="alert"><p>{content.error}</p><button onClick={() => setAttempt(value => value + 1)}>Retry preview</button></div> :
      content.url ? <img src={content.url} className="image-preview" alt={node.name} onError={() => setContent(previous => ({ ...previous, error: 'This image format cannot be previewed by the browser.' }))} /> :
      content.text !== null ? <pre className="text-preview">{content.text || '(Empty text file)'}</pre> :
      <div className="preview-unavailable"><p>Preview unavailable for this file type. Download to read its stored contents.</p></div>}
    {downloadFailed && !content.error && feedback?.type === 'error' && <p role="alert">{feedback.message}</p>}
    <div className="dialog-actions"><button type="button" onClick={onClose}>Close</button><button className="primary" disabled={!node} onClick={async () => { setDownloadFailed(false); if (!await onDownload(node.id)) setDownloadFailed(true) }}>Download</button></div>
  </dialog>
}
