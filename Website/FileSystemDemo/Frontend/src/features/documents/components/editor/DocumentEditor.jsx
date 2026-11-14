import MarkdownEditor from './MarkdownEditor.jsx'
import MarkdownPreview from './MarkdownPreview.jsx'
import TagSelector from '../tags/TagSelector.jsx'
import DocumentToolbar from './DocumentToolbar.jsx'
export default function DocumentEditor({ draft, setDraft, format, canEdit = true, canTag = true, canSave = true, catalog, pending, dirty, error, onSave, onCancel, onDownload, onCreateTag }) {
  const change = (key, value) => setDraft(previous => ({ ...previous, [key]: value }))
  return <form className="document-editor" onSubmit={event => { event.preventDefault(); onSave() }}>
    <DocumentToolbar editing pending={pending} canSave={canSave} dirty={dirty} onCancel={onCancel} onDownload={onDownload} />
    {error && <p role="alert" className="document-error">{error}</p>}
    {canEdit && <><label>Filename<input autoFocus required disabled={pending} maxLength={255} value={draft.name} onChange={event => change('name', event.target.value)} /></label>
      {format === 'markdown' ? <div className="document-editor-columns"><MarkdownEditor disabled={pending} content={draft.content} onChange={value => change('content', value)} /><MarkdownPreview content={draft.content} /></div> : <label>Plain text<textarea className="document-plain-editor" disabled={pending} value={draft.content} onChange={event => change('content', event.target.value)} /></label>}</>}
    {canTag && <><label>Linked product SKU (optional)<input maxLength={40} disabled={pending} value={draft.linkedSku || ''} placeholder="PRODUCT-001" onChange={event => change('linkedSku', event.target.value.toUpperCase())} /></label><TagSelector {...catalog} selected={draft.tagIds} disabled={pending} onChange={value => change('tagIds', value)} />{onCreateTag && <button type="button" disabled={pending} onClick={onCreateTag}>Create reusable tag</button>}</>}
  </form>
}
