import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, downloadTemplate, getUser } from '../api.js';
import { useLang } from '../i18n.jsx';

export default function Admin() {
  const { t, L } = useLang();
  const [tab, setTab] = useState('import');
  const [stats, setStats] = useState(null);
  const loadStats = useCallback(() => api.adminStats().then(setStats).catch(() => {}), []);
  useEffect(() => { loadStats(); }, [loadStats]);
  if (!getUser()?.isAdmin) return <div className="error">{t('noAdmin')}</div>;

  return (
    <>
      <h2>{t('adminTitle')}</h2>
      {stats && (
        <div className="grid stats">
          <div className="card stat"><div className="big">{stats.total}</div><div className="muted">{t('totalQs')}</div></div>
          {stats.subjects.map((s) => <div className="card stat" key={s.subject}><div className="big">{s.count}</div><div className="muted">{L(s.name)}</div></div>)}
          <div className="card stat"><div className="big">{stats.users}</div><div className="muted">{t('students')}</div></div>
          <div className="card stat"><div className="big">{stats.attempts}</div><div className="muted">{t('testsDone')}</div></div>
        </div>
      )}
      <div className="tabs">
        <button className={'tab' + (tab === 'import' ? ' on' : '')} onClick={() => setTab('import')}>{t('tabImport')}</button>
        <button className={'tab' + (tab === 'list' ? ' on' : '')} onClick={() => setTab('list')}>{t('tabList')}</button>
      </div>
      {tab === 'import' ? <ImportTab onDone={loadStats} /> : <ListTab stats={stats} onChange={loadStats} />}
    </>
  );
}

function ImportTab({ onDone }) {
  const { t } = useLang();
  const [text, setText] = useState('');
  const [format, setFormat] = useState('csv');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    const f = e.target.files[0]; if (!f) return;
    setFormat(f.name.toLowerCase().endsWith('.json') ? 'json' : 'csv');
    setText(await f.text()); setRes(null); setErr('');
  }
  async function run(dryRun) {
    setBusy(true); setErr('');
    try { const r = await api.adminImport({ format, content: text, dryRun }); setRes(r); if (!dryRun) onDone(); }
    catch (e) { setErr(e.message); setRes(null); } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <ol className="steps"><li>{t('impStep1')}</li><li>{t('impStep2')}</li><li>{t('impStep3')}</li></ol>
      <p><button className="btn" onClick={() => downloadTemplate().catch((e) => setErr(e.message))}>{t('dlTemplate')}</button></p>
      <label className="btn filebtn">{t('chooseFile')}<input type="file" accept=".csv,.json,text/csv,application/json" onChange={pick} hidden /></label>
      <p className="muted small">{t('orPaste')} ({format.toUpperCase()}):</p>
      <textarea rows={6} value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} placeholder="subject,subject_mr,topic_en,topic_mr,difficulty,question_en,question_mr,en_a,…" />
      <div className="actions">
        <button className="btn" disabled={busy || !text.trim()} onClick={() => run(true)}>{t('validate')}</button>
        <button className="btn primary" disabled={busy || !res || !res.dryRun || res.valid === 0} onClick={() => run(false)}>{t('importNow')}{res?.dryRun && res.valid ? ` (${res.valid})` : ''}</button>
      </div>
      {err && <div className="error">{err}</div>}
      {res && (
        <>
          <div className={'banner ' + (res.dryRun ? '' : 'okbanner')}>
            {!res.dryRun && <b>✅ {t('impDone')}: {t('imported')} {res.imported}. </b>}
            {t('valid')}: <b>{res.valid}</b> · {t('invalid')}: <b>{res.invalid}</b> · {t('duplicates')}: <b>{res.duplicates}</b> / {res.total}
          </div>
          {res.rows.some((r) => r.status !== 'valid') && (
            <div className="tablewrap"><table>
              <thead><tr><th>{t('rowNo')}</th><th>{t('status')}</th><th>{t('question_')}</th><th>{t('issues')}</th></tr></thead>
              <tbody>{res.rows.filter((r) => r.status !== 'valid').map((r) => (
                <tr key={r.row}><td>{r.row}</td><td><span className="pill" style={{ background: r.status === 'invalid' ? '#d9534f' : '#e0a800' }}>{t('st_' + r.status)}</span></td>
                  <td>{r.preview}</td><td>{r.errors.join('; ')}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </>
      )}
    </div>
  );
}

function ListTab({ stats, onChange }) {
  const { t, L, lang } = useLang();
  const [subject, setSubject] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api.adminQuestions({ subject, q, page }).then(setData).catch((e) => setErr(e.message)), [subject, q, page]);
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h); }, [load]);

  async function del(id) {
    if (!confirm(t('confirmDel'))) return;
    try { await api.adminDelete(id); load(); onChange(); } catch (e) { setErr(e.message); }
  }

  return (
    <div className="card">
      <div className="filters">
        <select value={subject} onChange={(e) => { setSubject(e.target.value); setPage(1); }}>
          <option value="">{t('allSubjects')}</option>
          {stats?.subjects.map((s) => <option key={s.subject} value={s.subject}>{L(s.name)}</option>)}
        </select>
        <input placeholder={t('search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      {err && <div className="error">{err}</div>}
      {!data ? <p>{t('loading')}</p> : (
        <>
          <div className="tablewrap"><table>
            <thead><tr><th>#</th><th>{t('subject')} / {t('topic')}</th><th>{t('question_')}</th><th>{t('answer')}</th><th>{t('diff')}</th><th /></tr></thead>
            <tbody>{data.items.map((x) => (
              <tr key={x.id}>
                <td>{x.id}</td><td>{L(x.subject)}<br /><span className="muted small">{L(x.topic)}</span></td>
                <td>{L(x.text)}</td><td>{(x.options[lang] || x.options.en)[x.correct]}</td><td>{x.difficulty}</td>
                <td><button className="link" onClick={() => del(x.id)}>{t('del')}</button></td>
              </tr>
            ))}</tbody>
          </table></div>
          <div className="actions">
            <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
            <span style={{ alignSelf: 'center' }}>{t('pageOf')} {data.page} / {Math.max(data.pages, 1)} · {data.total}</span>
            <button className="btn" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>→</button>
          </div>
        </>
      )}
    </div>
  );
}
