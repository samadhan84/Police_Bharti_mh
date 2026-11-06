import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LangToggle, useLang } from './i18n.jsx';
import { clearSession, getToken, getUser } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Exam from './pages/Exam.jsx';
import Result from './pages/Result.jsx';
import Analytics from './pages/Analytics.jsx';
import History from './pages/History.jsx';
import Admin from './pages/Admin.jsx';

function Guard({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const inExam = pathname.startsWith('/exam');
  const user = getUser();
  const { t } = useLang();
  return (
    <>
      {getToken() && !inExam && (
        <header className="topbar">
          <b className="brand">🚓 {t('app')}</b>
          <nav>
            <NavLink to="/">{t('home')}</NavLink>
            <NavLink to="/history">{t('results')}</NavLink>
            <NavLink to="/analytics">{t('analytics')}</NavLink>
            {user?.isAdmin && <NavLink to="/admin">{t('admin')}</NavLink>}
          </nav>
          <span className="who"><LangToggle />{user?.name}
            <button className="link" onClick={() => { clearSession(); nav('/login'); }}>{t('logout')}</button>
          </span>
        </header>
      )}
      <main className={inExam ? 'wide' : ''}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Guard><Dashboard /></Guard>} />
          <Route path="/exam/:id" element={<Guard><Exam /></Guard>} />
          <Route path="/result/:id" element={<Guard><Result /></Guard>} />
          <Route path="/history" element={<Guard><History /></Guard>} />
          <Route path="/analytics" element={<Guard><Analytics /></Guard>} />
          <Route path="/admin" element={<Guard><Admin /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
