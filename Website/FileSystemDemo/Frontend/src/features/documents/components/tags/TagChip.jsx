export default function TagChip({ tag, onRemove, disabled }) {
  return <span className="document-tag">{tag.name}{onRemove && <button type="button" disabled={disabled} aria-label={'Remove ' + tag.name + ' assignment'} onClick={onRemove}>×</button>}</span>
}
