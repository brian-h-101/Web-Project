import { contentClient as httpClient } from '../../../shared/api/httpClient.js'
import { mapNode } from './nodeMapper.js'
export async function uploadFile(file, parentId, signal) {
  if (!(file instanceof Blob) || !file.name) throw new Error('Choose a file using the browser file picker.')
  const extension = file.name.split('.').pop().toLowerCase(), format = { md: 'markdown', txt: 'text', pdf: 'pdf' }[extension]
  if (!format || file.size > (format === 'pdf' ? 2 * 1024 * 1024 : 256 * 1024)) throw new Error('Use Markdown/text up to 256 KiB or a curated PDF up to 2 MiB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  let content
  if (format === 'pdf') { let raw = ''; for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192)); content = btoa(raw) }
  else content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  return mapNode(await httpClient('/api/filesystem/documents', { method: 'POST', signal, body: { parentId, name: file.name, format, content } }))
}
