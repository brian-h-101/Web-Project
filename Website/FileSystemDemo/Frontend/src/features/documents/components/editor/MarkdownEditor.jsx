export default function MarkdownEditor({ content, onChange, disabled }) {
  return <label className="document-source">Markdown source<textarea spellCheck={false} disabled={disabled} value={content} onChange={event => onChange(event.target.value)} /></label>
}
