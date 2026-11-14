import useAuth from './useAuth.js'
export default function usePermissions() {
  const { permissions } = useAuth()
  return { hasPermission: permission => permissions.includes(permission), hasPermissions: (...required) => required.every(permission => permissions.includes(permission)) }
}
