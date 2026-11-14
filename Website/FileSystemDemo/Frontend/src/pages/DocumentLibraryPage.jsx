import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import useDocuments from '../features/documents/hooks/useDocuments.js';
import useDocumentEditor from '../features/documents/hooks/useDocumentEditor.js';
import useDocumentPermissions from '../features/documents/hooks/useDocumentPermissions.js';
import useTagCatalog from '../features/documents/hooks/useTagCatalog.js';
import useSaveDocument from '../features/documents/hooks/useSaveDocument.js';
import DocumentList from '../features/documents/components/library/DocumentList.jsx';
import DocumentSearch from '../features/documents/components/library/DocumentSearch.jsx';
import DocumentSort from '../features/documents/components/library/DocumentSort.jsx';
import TagFilter from '../features/documents/components/library/TagFilter.jsx';
import TagGroupView from '../features/documents/components/library/TagGroupView.jsx';
import DocumentEditor from '../features/documents/components/editor/DocumentEditor.jsx';
import CreateTagDialog from '../features/documents/components/tags/CreateTagDialog.jsx';
import { validateDocument } from '../features/documents/utils/documentValidation.js';
import useAuth from '../features/auth/hooks/useAuth.js';
import useDestinationFolder from '../features/documents/hooks/useDestinationFolder.js';

export default function DocumentLibraryPage() {
  const permissions = useDocumentPermissions();
  const [url, setUrl] = useSearchParams();
  const requestedParent = url.get('parentId');
  const creating = url.get('create') === '1';
  const catalog = useTagCatalog();
  const editor = useDocumentEditor(
    creating ? { name: 'Untitled.md', content: '', tagIds: [], expectedRevision: '1' } : null,
  );
  const saver = useSaveDocument();
  const navigate = useNavigate();
  const auth = useAuth();
  const destination = useDestinationFolder(
    requestedParent,
    Boolean(requestedParent) || (creating && permissions.canCreate),
    auth.accessKey,
  );
  const { folder } = destination;
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [match, setMatch] = useState('any');
  const [sort, setSort] = useState('name');
  const [direction, setDirection] = useState('asc');
  const [group, setGroup] = useState(false);
  const [untagged, setUntagged] = useState(false);
  const [format, setFormat] = useState('markdown');
  const [error, setError] = useState(null);
  const [tagDialog, setTagDialog] = useState(null);
  const library = useDocuments({
    search,
    tagIds: selectedTags,
    match,
    sort,
    direction,
    group: group ? 'tag' : '',
    untagged: untagged ? 'true' : '',
    parentId: requestedParent || '',
    pageSize: 30,
  });
  const begin = () => {
    if (!permissions.canCreate) return;
    setError(null);
    saver.reset();
    setFormat('markdown');
    editor.begin({ name: 'Untitled.md', tags: [], revision: '1' }, '');
    setUrl({ ...(requestedParent ? { parentId: requestedParent } : {}), create: '1' });
  };
  const cancel = () => {
    if (!editor.dirty || window.confirm('Discard your unsaved document changes?')) {
      editor.close();
      saver.reset();
      setUrl(requestedParent ? { parentId: requestedParent } : {});
    }
  };
  const save = async () => {
    if (!permissions.canCreate) {
      setError('Content management is unavailable. Refresh workspace capabilities.');
      return;
    }
    const invalid = validateDocument(editor.draft, format);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!folder) {
      setError('Choose an available virtual folder first.');
      return;
    }
    setError(null);
    const saved = await saver.save(null, {
      parentId: folder.id,
      name: editor.draft.name,
      format,
      content: editor.draft.content,
      tagIds: editor.draft.tagIds,
      linked_sku: editor.draft.linkedSku || null,
    });
    if (saved) {
      editor.close();
      navigate('/documents/' + saved.id);
    }
  };
  const leave = (event) => {
    if (editor.dirty && !window.confirm('Discard your unsaved document changes?'))
      event.preventDefault();
  };
  const changeDocumentFormat = (event) => {
    const next = event.target.value;
    setFormat(next);
    editor.setDraft((previous) => ({
      ...previous,
      name: previous.name.replace(/\.(md|txt)$/i, next === 'markdown' ? '.md' : '.txt'),
    }));
  };
  return (
    <div className="documents-app">
      <div className="documents-layout">
        <aside className="documents-sidebar">
          <p className="document-eyebrow">Library views</p>
          <button
            className={!untagged ? 'active' : ''}
            onClick={() => {
              setUntagged(false);
              setSelectedTags([]);
            }}
          >
            All documents
          </button>
          <button
            className={untagged ? 'active' : ''}
            onClick={() => {
              setUntagged(true);
              setSelectedTags([]);
            }}
          >
            Untagged
          </button>
          <p className="document-eyebrow">Tags</p>
          {catalog.tags.map((tag) => (
            <div className="document-catalog-tag" key={tag.id}>
              <button
                onClick={() => {
                  setUntagged(false);
                  setSelectedTags([tag.id]);
                }}
              >
                {tag.name}
              </button>
              {permissions.canManageTags && (
                <button
                  aria-label={'Manage ' + tag.name + ' tag'}
                  onClick={() => setTagDialog(tag)}
                >
                  ⋯
                </button>
              )}
            </div>
          ))}
          {permissions.canCreateTag && (
            <button onClick={() => setTagDialog({})}>＋ Create tag</button>
          )}
          {catalog.error && (
            <p role="alert" className="document-error">
              {catalog.error}
              <button onClick={catalog.refresh}>Retry tags</button>
            </p>
          )}
        </aside>
        <main className="documents-main">
          <div className="document-library-heading">
            <div>
              <h2>Document Library</h2>
              <p className="document-muted">
                {requestedParent
                  ? 'Folder: ' + (folder?.name || requestedParent)
                  : permissions.canCreate
                    ? 'Documents in the workspace'
                    : 'Published documents'}
              </p>
            </div>
            {permissions.canCreate && !creating && (
              <button className="document-primary" onClick={begin}>
                ＋ New Document
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="document-error">
              {error}
            </p>
          )}
          {(creating || requestedParent) && (
            <section aria-label={creating ? 'Creation destination' : 'Selected folder'}>
              {destination.loading && (
                <p role="status">
                  Checking {creating ? 'creation destination' : 'selected folder'}…
                </p>
              )}
              {destination.error && (
                <div role="alert" className="document-error">
                  <p>
                    {creating ? 'Creation destination' : 'Selected folder'} could not be verified.
                  </p>
                  <p>{destination.error}</p>
                  <button onClick={destination.retry}>Retry folder</button>
                </div>
              )}
            </section>
          )}
          {creating && permissions.canCreate && editor.draft ? (
            <section className="document-new">
              <h2>New Document</h2>
              <p>
                Save in:{' '}
                {folder?.name ||
                  (destination.error ? 'Destination unavailable' : 'Checking virtual folder…')}{' '}
                <Link to="/explorer" onClick={leave}>
                  Choose a folder in Explorer
                </Link>
              </p>
              <label>
                Format
                <select disabled={saver.pending} value={format} onChange={changeDocumentFormat}>
                  <option value="markdown">Markdown (.md)</option>
                  <option value="text">Plain text (.txt)</option>
                </select>
              </label>
              <DocumentEditor
                draft={editor.draft}
                setDraft={editor.setDraft}
                format={format}
                catalog={catalog}
                pending={saver.pending}
                canSave={Boolean(folder) && !destination.loading && !destination.error}
                dirty={editor.dirty}
                error={saver.error}
                onSave={save}
                onCancel={cancel}
                onCreateTag={permissions.canCreateTag ? () => setTagDialog({}) : null}
              />
            </section>
          ) : (
            <>
              <div className="document-library-controls">
                <DocumentSearch value={search} onChange={setSearch} />
                <DocumentSort
                  sort={sort}
                  direction={direction}
                  onSort={setSort}
                  onDirection={setDirection}
                />
              </div>
              <TagFilter
                tags={catalog.tags}
                selected={selectedTags}
                match={match}
                onSelected={(ids) => {
                  setSelectedTags(ids);
                  setUntagged(false);
                }}
                onMatch={setMatch}
              />
              <div className="document-results-heading">
                <span>
                  {library.loading
                    ? 'Loading document results…'
                    : library.error
                      ? 'Document results unavailable'
                      : `${library.documents.length} of ${library.total} documents`}
                </span>
                <label>
                  <input
                    type="checkbox"
                    checked={group}
                    onChange={(event) => setGroup(event.target.checked)}
                  />
                  Group by tag
                </label>
                <button onClick={library.refresh}>Refresh</button>
                {requestedParent && <button onClick={() => setUrl({})}>All folders</button>}
              </div>
              {library.error && (
                <div role="alert" className="document-error">
                  <p>Documents could not be loaded. Try again.</p>
                  <p>{library.error}</p>
                  <button onClick={library.refresh}>Retry</button>
                </div>
              )}
              {!library.loading && !library.error && library.incomplete && (
                <p role="status">
                  Search reached its candidate bound. Narrow the query; these results are
                  incomplete.
                </p>
              )}
              {library.loading && <p role="status">Loading documents…</p>}
              {!library.loading &&
                !library.error &&
                (group && library.documents.length > 0 ? (
                  <TagGroupView documents={library.documents} />
                ) : (
                  <DocumentList
                    documents={library.documents}
                    canCreate={permissions.canCreate}
                    filtered={Boolean(search || selectedTags.length || untagged)}
                    onClear={() => {
                      setSearch('');
                      setSelectedTags([]);
                      setUntagged(false);
                    }}
                  />
                ))}
              {!library.error && library.nextCursor && (
                <button
                  className="document-load-more"
                  disabled={library.loading}
                  onClick={library.loadMore}
                >
                  Load more documents
                </button>
              )}
            </>
          )}
        </main>
      </div>
      {tagDialog && (permissions.canCreateTag || permissions.canManageTags) && (
        <CreateTagDialog
          tag={tagDialog.id ? tagDialog : null}
          canDelete={permissions.canManageTags}
          onClose={() => setTagDialog(null)}
        />
      )}
    </div>
  );
}
