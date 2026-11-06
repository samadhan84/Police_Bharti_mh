import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { clearSession, getToken, getUser } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Exam from './pages/Exam.jsx';
import Result from './pages/Result.jsx';
import Analytics from './pages/Analytics.jsx';
import History from './pages/History.jsx';

function Guard({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const inExam = pathname.startsWith('/exam');
  const user = getUser();
  return (
    <>
      {getToken() && !inExam && (
        <header className="topbar">
          <b className="brand">🚓 पोलीस भरती Mock</b>
          <nav>
            <NavLink to="/">Home</NavLink>
            <NavLink to="/history">Results</NavLink>
            <NavLink to="/analytics">Analytics</NavLink>
          </nav>
          <span className="who">{user?.name}
            <button className="link" onClick={() => { clearSession(); nav('/login'); }}>Logout</button>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
