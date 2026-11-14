import MarkdownRenderer from './MarkdownRenderer.jsx'
import TextRenderer from './TextRenderer.jsx'
import PdfViewer from './PdfViewer.jsx'
export default function DocumentViewer({ document, content, contentError }) {
  if (contentError) return <p role="alert">{contentError} Use Download to retrieve the original file.</p>
  if (document.format === 'markdown') return <MarkdownRenderer content={content} />
  if (document.format === 'text') return <TextRenderer content={content} />
  if (document.format === 'pdf') return <PdfViewer document={document} />
  return <p>Preview is unavailable for this format. Use Download to open the original file.</p>
}
