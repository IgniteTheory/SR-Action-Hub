import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { initials } from './utils/format';

function AppShell() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-brand">SR Action Hub</div>
        <div className="sidebar-tagline">Every client request. Logged. Tracked. Completed.</div>
        <ul className="sidebar-nav">
          <li><button className="active">Dashboard</button></li>
        </ul>
        <div className="sidebar-user">
          <span className="avatar" style={{ background: user.colour }}>{initials(user.name)}</span>
          <div>
            <div className="name">{user.name}</div>
            <div className="role">{user.role === 'ADMINISTRATOR' ? 'Administrator' : 'Staff'}</div>
          </div>
          <button onClick={logout}>Sign out</button>
        </div>
      </nav>
      <main className="main-area">
        <DashboardPage />
      </main>
    </div>
  );
}

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ProtectedRoute />} />
    </Routes>
  );
}
