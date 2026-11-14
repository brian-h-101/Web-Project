import { BrowserRouter } from 'react-router'
import { AuthProvider } from '../features/auth/context/AuthContext.jsx'
export default function AppProviders({ children }) {
  return <BrowserRouter basename="/demos/file-system-simulator"><AuthProvider>{children}</AuthProvider></BrowserRouter>
}
