import ReactMarkdown from 'react-markdown'
export default function MarkdownRenderer({ content }) {
  return <article className="document-markdown"><ReactMarkdown skipHtml>{content}</ReactMarkdown></article>
}
