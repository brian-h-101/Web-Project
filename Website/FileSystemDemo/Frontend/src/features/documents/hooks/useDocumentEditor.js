import { useEffect, useState } from 'react'
export default function useDocumentEditor(initial = null) {
  const [draft, setDraft] = useState(initial), [original, setOriginal] = useState(initial)
  const dirty = draft != null && JSON.stringify(draft) !== JSON.stringify(original)
  const begin = (document, content = '') => {
    const next = { name: document.name, content, tagIds: document.tags.map(tag => tag.id), linkedSku: document.linked_sku || '', expectedRevision: document.revision }
    setDraft(next); setOriginal(next)
  }
  const close = () => { setDraft(null); setOriginal(null) }
  const cancel = () => { if (!dirty || window.confirm('Discard your unsaved document changes?')) close() }
  useEffect(() => {
    const unload = event => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', unload)
    return () => window.removeEventListener('beforeunload', unload)
  }, [dirty])
  return { draft, setDraft, original, dirty, begin, close, cancel }
}
