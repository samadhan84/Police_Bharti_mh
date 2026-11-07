import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useLang } from '../i18n.jsx';

export default function Custom() {
  const { t, L } = useLang();
  const nav = useNavigate();
  const [banks, setBanks] = useState(null);
  const [status, setStatus] = useState({ aiEnabled: true });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => api.customBanks().then(setBanks).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); api.customStatus().then(setStatus).catch(() => {}); }, [load]);

  async function start(bank, subject, count) {
    setBusy(true); setErr('');
    try {
      const a = await api.start({ mode: 'custom', bankId: bank.id, subject: subject || null, count });
      sessionStorage.setItem('exam:' + a.attemptId, JSON.stringify(a));
      nav('/exam/' + a.attemptId);
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  async function remove(b) {
    if (!window.confirm(t('cuConfirmDel'))) return;
    try { await api.customDelete(b.id); load(); } catch (e) { setErr(e.message); }
  }

  return (
    <>
      <h2>{t('customTitle')}</h2>
      <p className="muted">{t('customIntro')} {t('cuPrivate')}</p>
      {err && <div className="error">{err}</div>}
      {msg && <div className="card good">{msg}</div>}

      <UploadCard status={status} onSaved={(m) => { setMsg(m); load(); }} />

      <h3>{t('cuMyBanks')}</h3>
      {banks === null ? <p>{t('loading')}</p> : banks.length === 0 ? <p className="muted">{t('cuNone')}</p> : (
        <div className="grid">
          {banks.map((b) => <BankCard key={b.id} b={b} busy={busy} L={L} t={t} onStart={start} onDelete={remove} />)}
        </div>
      )}
    </>
  );
}

function BankCard({ b, busy, L, t, onStart, onDelete }) {
  const [subject, setSubject] = useState('');
  const max = Math.min(100, subject ? b.subjects.find((s) => s.subject === subject)?.count ?? b.questions : b.questions);
  const [count, setCount] = useState(Math.min(25, b.questions));
  const n = Math.max(1, Math.min(Number(count) || 1, max));
  return (
    <div className="card">
      <b>{b.name}</b>
      <p className="muted">{b.questions} {t('inBank')}</p>
      <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
        <option value="">{t('cuAllSubjects')}</option>
        {b.subjects.map((s) => <option key={s.subject} value={s.subject}>{L(s.name)} ({s.count})</option>)}
      </select>
      <label className="muted small">{t('cuCount')} (1–{max}){' '}
        <input type="number" min={1} max={max} value={count} onChange={(e) => setCount(e.target.value)} style={{ width: 70 }} />
      </label>
      <div className="actions">
        <button className="btn primary" disabled={busy} onClick={() => onStart(b, subject, n)}>{t('cuTest')}</button>
        <Link className="btn" to={'/analytics?bank=' + b.id}>{t('cuAnalytics')}</Link>
        <button className="btn danger" onClick={() => onDelete(b)}>{t('del')}</button>
      </div>
    </div>
  );
}

function UploadCard({ status, onSaved }) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [files, setFiles] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [prev, setPrev] = useState(null); // { questions, note, method, needsAnswerCheck }

  async function read() {
    setBusy(true); setErr(''); setPrev(null);
    try {
      const f = new FormData();
      files.forEach((x) => f.append('files', x));
      if (text.trim()) f.append('text', text);
      setPrev(await api.customParse(f));
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function save() {
    if (prev.questions.some((q) => q.correct < 0)) { setErr(t('cuNeedAns')); return; }
    setBusy(true); setErr('');
    try {
      const r = await api.customSave({ name, questions: prev.questions });
      onSaved(`${t('cuSaved')}: ${r.name} — ${r.added} ${t('cuAdded')}${r.duplicates ? ` (${r.duplicates} ${t('duplicates')})` : ''}`);
      setPrev(null); setFiles([]); setText(''); setName('');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  const setQ = (i, patch) => setPrev({ ...prev, questions: prev.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const dropQ = (i) => setPrev({ ...prev, questions: prev.questions.filter((_, j) => j !== i) });

  return (
    <div className="card">
      <h3>{t('cuUpload')}</h3>
      {!status.aiEnabled && <p className="muted small">⚠ {t('cuNoAi')}</p>}
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('cuName')} maxLength={120} style={{ width: '100%', marginBottom: 8 }} />
      <label className="btn filebtn">{t('cuFiles')}
        <input type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.md,application/pdf,image/*,text/plain"
          onChange={(e) => { setFiles([...e.target.files]); setPrev(null); }} />
      </label>
      {files.length > 0 && <p className="muted small">{files.map((f) => f.name).join(', ')}</p>}
      <p className="muted small">{t('cuPaste')}:</p>
      <textarea rows={5} value={text} onChange={(e) => { setText(e.target.value); setPrev(null); }} placeholder={'1. 15% of 200 = ?\nA) 20  B) 30  C) 25  D) 35\nAnswer: B'} />
      <p className="muted small">{t('cuLayout')}</p>
      <div className="actions">
        <button className="btn primary" disabled={busy || (!files.length && !text.trim())} onClick={read}>{busy && !prev ? t('cuReading') : t('cuExtract')}</button>
      </div>
      {err && <div className="error">{err}</div>}

      {prev && (
        <>
          <h4>{prev.questions.length} {t('cuFound')}</h4>
          {prev.note && <p className="muted small">{prev.note}</p>}
          {prev.needsAnswerCheck > 0 && <div className="error">{t('cuCheck')}</div>}
          {prev.questions.map((q, i) => (
            <div className="card" key={i}>
              <div className="muted small">{q.subject} · {q.topic} · {t('d' + q.difficulty)}</div>
              <p className="qtext">{i + 1}. {q.text}</p>
              {q.options.map((o, k) => <div key={k} className={'ro' + (k === q.correct ? ' right' : '')}>{'ABCD'[k]}. {o}</div>)}
              <div className="actions">
                <label className="muted small">{t('answer')}:{' '}
                  <select value={q.correct} onChange={(e) => setQ(i, { correct: Number(e.target.value), answerFromSource: true })}>
                    <option value={-1}>{t('cuNoAns')}</option>
                    {'ABCD'.split('').map((l, k) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
                {!q.answerFromSource && q.correct >= 0 && <span className="pill" style={{ background: '#e0a800', color: '#000' }}>{t('cuAiAns')}</span>}
                <button className="btn" onClick={() => dropQ(i)}>{t('cuRemove')}</button>
              </div>
            </div>
          ))}
          <div className="actions">
            <button className="btn primary" disabled={busy || !name.trim() || prev.questions.length === 0} onClick={save}>{t('cuSave')}</button>
          </div>
          {!name.trim() && <p className="muted small">↑ {t('cuName')}</p>}
        </>
      )}
    </div>
  );
}
