import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getUser } from '../api.js';

export default function Dashboard() {
  const nav = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.subjects().then(setSubjects).catch((e) => setErr(e.message));
    api.attempts().then((a) => setRecent(a.slice(0, 5))).catch(() => {});
  }, []);

  async function start(body) {
    setBusy(true); setErr('');
    try {
      const a = await api.start(body);
      sessionStorage.setItem('exam:' + a.attemptId, JSON.stringify(a));
      nav('/exam/' + a.attemptId);
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <>
      <h2>Welcome, {getUser()?.name} 👋</h2>
      {err && <div className="error">{err}</div>}
      <section className="card hero">
        <div>
          <h3>Full Mock Test</h3>
          <p className="muted">100 questions · 100 marks · 90 minutes · 25 each: Arithmetic, Reasoning, GK &amp; Current Affairs, Marathi Grammar. No negative marking.</p>
        </div>
        <button className="btn primary" disabled={busy} onClick={() => start({ mode: 'full' })}>Start Full Mock</button>
      </section>

      <h3>Subject practice</h3>
      <div className="grid">
        {subjects.map((s) => (
          <div className="card" key={s.subject}>
            <b>{s.subject}</b>
            <p className="muted">{s.questions} questions in bank</p>
            <button className="btn" disabled={busy} onClick={() => start({ mode: 'subject', subject: s.subject, count: 15 })}>Practice 15 Qs</button>
          </div>
        ))}
      </div>

      <h3>Recent results</h3>
      {recent.length === 0 ? <p className="muted">No tests yet — take your first mock!</p> : (
        <div className="card list">
          {recent.map((r) => (
            <Link key={r.id} to={'/result/' + r.id} className="row">
              <span>{r.mode === 'full' ? 'Full Mock' : r.subject}</span>
              <span className="muted">{new Date(r.submittedAt + 'Z').toLocaleString()}</span>
              <b>{r.correct}/{r.total}</b>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
