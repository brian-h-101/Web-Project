export default function FileIcon({ node, large = false }) {
  const image = node.mimeType?.startsWith('image/')
  const source = /\.(jsx?|json)$/i.test(node.name || '')
  return <svg className={'file-icon ' + (large ? 'large' : '')} viewBox="0 0 32 32" aria-hidden="true">
    {node.type === 'folder' ? <>
      <path fill="#e9af32" d="M3 7a2 2 0 0 1 2-2h8l3 4h11a2 2 0 0 1 2 2v14H3z" />
      <path fill="#f7cc66" stroke="#dca944" strokeWidth=".7" d="M3 12h26v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </> : <>
      <path fill="#fff" stroke="#b7c4d5" d="M7 3h12l7 7v19H7z" />
      <path fill="#e2eaf4" stroke="#b7c4d5" d="M19 3v7h7" />
      {image ? <><circle cx="13" cy="15" r="2" fill="#5ca1d4" /><path fill="#78aa83" d="m10 25 5-7 4 4 3-5 2 8z" /></> :
        source ? <path fill="none" stroke="#5f83b4" strokeWidth="1.7" d="m13 15-3 4 3 4m7-8 3 4-3 4m-3-9-2 10" /> :
        <path stroke="#8fabc8" strokeWidth="1.6" d="M11 15h11m-11 5h11m-11 5h7" />}
    </>}
  </svg>
}
