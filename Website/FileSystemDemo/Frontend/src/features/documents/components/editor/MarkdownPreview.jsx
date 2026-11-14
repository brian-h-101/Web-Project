import MarkdownRenderer from '../viewer/MarkdownRenderer.jsx'
export default function MarkdownPreview({ content }) { return <section className="document-live-preview" aria-label="Live Markdown preview"><h3>Live preview</h3><MarkdownRenderer content={content} /></section> }
