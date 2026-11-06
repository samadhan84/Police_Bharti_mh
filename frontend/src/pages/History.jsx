import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtTime } from '../api.js';

export default function History() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.attempts().then(setRows).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="error">{err}</div>;
  if (!rows) return <p>Loading…</p>;
  return (
    <>
      <h2>My results</h2>
      {rows.length === 0 ? <p className="muted">No completed tests yet.</p> : (
        <div className="card list">
          {rows.map((r) => (
            <Link key={r.id} to={'/result/' + r.id} className="row">
              <span><b>{r.mode === 'full' ? 'Full Mock' : r.subject}</b><br /><span className="muted small">{new Date(r.submittedAt + 'Z').toLocaleString()}</span></span>
              <span className="muted">{fmtTime(r.timeTakenSec)}</span>
              <b>{r.correct}/{r.total} <span className="muted">({Math.round(100 * r.correct / r.total)}%)</span></b>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
