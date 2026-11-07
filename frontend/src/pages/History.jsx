import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtTime } from '../api.js';
import { useLang } from '../i18n.jsx';

export default function History() {
  const { t, dt, attemptLabel } = useLang();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.attempts().then(setRows).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="error">{err}</div>;
  if (!rows) return <p>{t('loading')}</p>;
  return (
    <>
      <h2>{t('myResults')}</h2>
      {rows.length === 0 ? <p className="muted">{t('noDone')}</p> : (
        <div className="card list">
          {rows.map((r) => (
            <Link key={r.id} to={'/result/' + r.id} className="row">
              <span><b>{attemptLabel(r)}</b><br /><span className="muted small">{dt(r.submittedAt)}</span></span>
              <span className="muted">{fmtTime(r.timeTakenSec)}</span>
              <b>{r.correct}/{r.total} <span className="muted">({Math.round(100 * r.correct / r.total)}%)</span></b>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
