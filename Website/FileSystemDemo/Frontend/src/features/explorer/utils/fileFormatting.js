export function formatFileSize(size) {
  if (!Number.isFinite(size)) return '—'
  if (size === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  return (size / 1024 ** index).toLocaleString(undefined, { maximumFractionDigits: index ? 1 : 0 }) + ' ' + units[index]
}
export function formatFileType(node) {
  if (node.type === 'folder') return 'File folder'
  const extension = node.name.split('.').length > 1 ? node.name.split('.').at(-1).toLowerCase() : ''
  return ({ png: 'PNG image', jpg: 'JPEG image', jpeg: 'JPEG image', gif: 'GIF image', webp: 'WebP image',
    txt: 'Text document', md: 'Markdown document', json: 'JSON file', jsx: 'React source', js: 'JavaScript file', pdf: 'PDF document' })[extension] || (extension ? extension.toUpperCase() + ' file' : 'File')
}
export function formatDate(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
