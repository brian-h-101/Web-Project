import { useEffect, useRef, useState } from 'react';

export default function RenameDialog({ node, onClose, onConfirm }) {
  const dialog = useRef(null);
  const input = useRef(null);
  const [name, setName] = useState(node?.name || '');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    input.current?.select();
    return () => element.close();
  }, []);
  const submitRename = async (event) => {
    event.preventDefault();
    if (!node || pending) return;
    setPending(true);
    try {
      const result = await onConfirm(node.id, name);
      if (result.ok) onClose();
      else setError(result.error);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="explorer-dialog"
      aria-labelledby="rename-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <form onSubmit={submitRename}>
        <h2 id="rename-title">Rename item</h2>
        <p>
          {node
            ? 'Choose a new name for ' + node.name + '.'
            : 'The selected item no longer exists.'}
        </p>
        <label>
          New name
          <input
            ref={input}
            autoFocus
            disabled={pending}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? 'rename-error' : undefined}
          />
        </label>
        {error && (
          <p id="rename-error" className="dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={!node || pending}>
            {pending ? 'Renaming…' : 'Rename'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
