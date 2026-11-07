import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getUser } from '../api.js';
import { useLang } from '../i18n.jsx';

export default function Dashboard() {
  const nav = useNavigate();
  const { t, L, dt, subj, attemptLabel } = useLang();
  const [subjects, setSubjects] = useState([]);
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiCount, setAiCount] = useState(15);
  const [aiBusy, setAiBusy] = useState(false);

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

  async function startAi() {
    setAiBusy(true); setErr('');
    try {
      const a = await api.aiTest({ count: Number(aiCount) });
      sessionStorage.setItem('exam:' + a.attemptId, JSON.stringify(a));
      nav('/exam/' + a.attemptId);
    } catch (e) { setErr(e.message); setAiBusy(false); }
  }

  return (
    <>
      <h2>{t('welcome')}, {getUser()?.name} 👋</h2>
      {err && <div className="error">{err}</div>}
      <section className="card hero">
        <div>
          <h3>{t('aiTestTitle')}</h3>
          <p className="muted">{aiBusy ? t('aiWriting') : t('aiTestDesc')}</p>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <select value={aiCount} onChange={(e) => setAiCount(e.target.value)} disabled={aiBusy}>
            {[10, 15, 25].map((n) => <option key={n} value={n}>{n} {t('aiQs')}</option>)}
          </select>
          <button className="btn primary" disabled={aiBusy || busy} onClick={startAi}>{aiBusy ? t('wait') : t('aiStart')}</button>
        </div>
      </section>

      <section className="card hero">
        <div>
          <h3>{t('fullMock')}</h3>
          <p className="muted">{t('fullDesc')}</p>
        </div>
        <button className="btn primary" disabled={busy} onClick={() => start({ mode: 'full' })}>{t('startFull')}</button>
      </section>

      <section className="card hero">
        <div>
          <h3>{t('customTitle')}</h3>
          <p className="muted">{t('cuCustomCard')}</p>
        </div>
        <Link className="btn primary" to="/custom">{t('cuOpen')}</Link>
      </section>

      <h3>{t('subjPractice')}</h3>
      <div className="grid">
        {subjects.map((s) => (
          <div className="card" key={s.subject}>
            <b>{L(s.name)}</b>
            <p className="muted">{s.questions} {t('inBank')}</p>
            <button className="btn" disabled={busy} onClick={() => start({ mode: 'subject', subject: s.subject, count: 15 })}>{t('practice15')}</button>
          </div>
        ))}
      </div>

      <h3>{t('recent')}</h3>
      {recent.length === 0 ? <p className="muted">{t('noTests')}</p> : (
        <div className="card list">
          {recent.map((r) => (
            <Link key={r.id} to={'/result/' + r.id} className="row">
              <span>{attemptLabel(r)}</span>
              <span className="muted">{dt(r.submittedAt)}</span>
              <b>{r.correct}/{r.total}</b>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
