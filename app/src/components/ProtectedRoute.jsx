import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Loading } from './ui/index.js';

export function ProtectedRoute() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loading texto="Verificando sua sessão..." />
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;

  return <Outlet />;
}
