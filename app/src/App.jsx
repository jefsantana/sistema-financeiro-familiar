import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { AppLayout } from './layouts/AppLayout/AppLayout.jsx';
import Login from './pages/Login/Login.jsx';
import RedefinirSenha from './pages/RedefinirSenha/RedefinirSenha.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import Entradas from './pages/Entradas/Entradas.jsx';
import Gastos from './pages/Gastos/Gastos.jsx';
import Categorias from './pages/Categorias/Categorias.jsx';
import ContasFixas from './pages/ContasFixas/ContasFixas.jsx';
import Parcelamentos from './pages/Parcelamentos/Parcelamentos.jsx';
import Cartoes from './pages/Cartoes/Cartoes.jsx';
import Metas from './pages/Metas/Metas.jsx';
import Orcamentos from './pages/Orcamentos/Orcamentos.jsx';
import Relatorios from './pages/Relatorios/Relatorios.jsx';
import Historico from './pages/Historico/Historico.jsx';
import Lixeira from './pages/Lixeira/Lixeira.jsx';
import Configuracoes from './pages/Configuracoes/Configuracoes.jsx';
import NaoEncontrado from './pages/NaoEncontrado/NaoEncontrado.jsx';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/entradas" element={<Entradas />} />
                <Route path="/gastos" element={<Gastos />} />
                <Route path="/categorias" element={<Categorias />} />
                <Route path="/contas" element={<ContasFixas />} />
                <Route path="/parcelamentos" element={<Parcelamentos />} />
                <Route path="/cartoes" element={<Cartoes />} />
                <Route path="/metas" element={<Metas />} />
                <Route path="/orcamentos" element={<Orcamentos />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/historico" element={<Historico />} />
                <Route path="/lixeira" element={<Lixeira />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              </Route>
            </Route>

            <Route path="*" element={<NaoEncontrado />} />
          </Routes>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
