import useAuth from '../../auth/hooks/useAuth.js'
import usePermissions from '../../auth/hooks/usePermissions.js'
export default function useDocumentPermissions(document) {
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const owned = document?.author?.id != null && document.author.id === user?.id
  return {
    canRead: hasPermission('documents:read'), canCreate: hasPermission('documents:create'),
    canEdit: hasPermission('documents:update_any') || (owned && hasPermission('documents:update_own')),
    canTag: hasPermission('documents:tag_any') || (owned && hasPermission('documents:tag_own')),
    canDelete: hasPermission('documents:delete') && hasPermission('nodes:delete'),
    canCreateTag: hasPermission('tags:create'), canManageTags: hasPermission('tags:manage'),
  }
}
