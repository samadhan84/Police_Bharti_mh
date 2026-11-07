import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fmtTime, getUser } from '../api.js';
import { LangToggle, useLang } from '../i18n.jsx';

export default function Exam() {
  const { id } = useParams();
  const { t, L, lang } = useLang();
  const nav = useNavigate();
  const exam = useMemo(() => { try { return JSON.parse(sessionStorage.getItem('exam:' + id)); } catch { return null; } }, [id]);
  const saveKey = 'exam-state:' + id;

  // Persisted so a refresh / app restart does not lose progress.
  const initial = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(saveKey)); } catch { return null; }
  }, [saveKey]);
  const [answers, setAnswers] = useState(initial?.answers || {});
  const [marked, setMarked] = useState(initial?.marked || {});
  const [visited, setVisited] = useState(() => ({ ...(initial?.visited || {}), ...(exam ? { [exam.questions[0].id]: true } : {}) }));
  const [spent, setSpent] = useState(initial?.spent || {});
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(() => {
    if (!exam) return 0;
    const started = initial?.startedAtMs || Date.now();
    return Math.max(0, exam.durationSec - Math.floor((Date.now() - started) / 1000));
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const startedAtMs = useRef(initial?.startedAtMs || Date.now());
  const qStart = useRef(Date.now());
  const submitted = useRef(false);

  useEffect(() => {
    localStorage.setItem(saveKey, JSON.stringify({ answers, marked, spent, visited, startedAtMs: startedAtMs.current }));
  }, [answers, marked, spent, visited, saveKey]);

  const flushTime = useCallback((qid) => {
    const s = Math.round((Date.now() - qStart.current) / 1000);
    qStart.current = Date.now();
    setSpent((p) => ({ ...p, [qid]: (p[qid] || 0) + s }));
  }, []);

  const finish = useCallback(async () => {
    if (submitted.current || !exam) return;
    submitted.current = true; setBusy(true); setErr('');
    const cur = exam.questions[idx];
    const extra = Math.round((Date.now() - qStart.current) / 1000);
    const payload = {
      timeTakenSec: Math.min(exam.durationSec, Math.floor((Date.now() - startedAtMs.current) / 1000)),
      answers: exam.questions.map((q) => ({
        questionId: q.id,
        selected: answers[q.id] ?? null,
        timeSec: (spent[q.id] || 0) + (q.id === cur.id ? extra : 0),
      })),
    };
    try {
      await api.submit(id, payload);
      localStorage.removeItem(saveKey); sessionStorage.removeItem('exam:' + id);
      nav('/result/' + id, { replace: true });
    } catch (e) { submitted.current = false; setBusy(false); setErr(e.message); }
  }, [exam, answers, spent, idx, id, nav, saveKey]);

  useEffect(() => {
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (exam && left <= 0) finish(); }, [left]); // eslint-disable-line

  if (!exam) return <div className="card"><p>{t('examGone')}</p><button className="btn" onClick={() => nav('/')}>{t('back')}</button></div>;

  const total = exam.questions.length;
  const q = exam.questions[idx];
  const goto = (i) => {
    if (i < 0 || i >= total) return;
    flushTime(q.id);
    setIdx(i);
    setVisited((v) => ({ ...v, [exam.questions[i].id]: true }));
  };
  const sections = [...new Set(exam.questions.map((x) => x.subject))];
  const secName = (s) => L(exam.questions.find((x) => x.subject === s).subjectName);
  const opts = q.options[lang] || q.options.en;

  // palette state of one question: notvisited | notanswered | answered | marked | ansmarked
  const state = (x) => {
    const a = answers[x.id] !== undefined, m = !!marked[x.id];
    if (a && m) return 'ansmarked';
    if (m) return 'marked';
    if (a) return 'answered';
    return visited[x.id] || x.id === q.id ? 'notanswered' : 'notvisited';
  };
  const count = (st) => exam.questions.filter((x) => state(x) === st).length;
  const answeredCount = Object.keys(answers).length;
  const clearAns = () => { const a = { ...answers }; delete a[q.id]; setAnswers(a); };

  return (
    <div className="cbt">
      <header className="cbt-top">
        <b className="cbt-title">{t('app')}</b>
        <LangToggle />
        <div className="cbt-user"><span className="cbt-avatar">👤</span><span>{t('candidate')}: <b>{getUser()?.name}</b></span></div>
        <div className={'cbt-timer' + (left < 300 ? ' danger' : '')}>{t('timeLeft')}: <b>{fmtTime(Math.max(0, left))}</b></div>
      </header>

      <div className="cbt-sections">
        <span className="muted small">{t('sections')}</span>
        {sections.map((s) => (
          <button key={s} className={'cbt-sec' + (s === q.subject ? ' on' : '')} onClick={() => goto(exam.questions.findIndex((x) => x.subject === s))}>{secName(s)}</button>
        ))}
      </div>

      <div className="cbt-body">
        <section className="cbt-main">
          <div className="cbt-qhead">{t('qNo')} {idx + 1} <span className="muted small">/ {total} · {L(q.topic)}</span></div>
          <div className="cbt-qarea">
            <p className="qtext">{L(q.text)}</p>
            {opts.map((o, i) => (
              <label key={i} className={'cbt-opt' + (answers[q.id] === i ? ' sel' : '')}>
                <input type="radio" name={'q' + q.id} checked={answers[q.id] === i} onChange={() => setAnswers({ ...answers, [q.id]: i })} />
                <span className="cbt-radio" /> <span className="cbt-letter">{(lang === 'mr' ? 'अबकड' : 'ABCD')[i]}.</span> {o}
              </label>
            ))}
          </div>
          <div className="cbt-actions">
            <button className="btn" onClick={() => { setMarked({ ...marked, [q.id]: true }); goto(idx + 1); }}>{t('markNext')}</button>
            <button className="btn" onClick={clearAns}>{t('clearResp')}</button>
            <span className="grow" />
            <button className="btn" disabled={idx === 0} onClick={() => goto(idx - 1)}>{t('prev')}</button>
            <button className="btn cbt-save" onClick={() => { if (marked[q.id]) setMarked({ ...marked, [q.id]: false }); goto(idx + 1); }}>{t('saveNext')}</button>
          </div>
        </section>

        <aside className="cbt-side">
          <div className="cbt-legend">
            <div><span className="pb answered">{count('answered')}</span> {t('answered')}</div>
            <div><span className="pb notanswered">{count('notanswered')}</span> {t('notAnswered')}</div>
            <div><span className="pb notvisited">{count('notvisited')}</span> {t('notVisited')}</div>
            <div><span className="pb marked">{count('marked')}</span> {t('markedLbl')}</div>
            <div className="wide"><span className="pb ansmarked">{count('ansmarked')}</span> {t('ansMarked')}</div>
          </div>
          <div className="cbt-pal-head">{secName(q.subject)} — {t('paletteOf')}</div>
          <div className="pal">
            {exam.questions.map((x, i) => x.subject === q.subject && (
              <button key={x.id} onClick={() => goto(i)} className={'pb ' + state(x) + (i === idx ? ' cur' : '')}>{i + 1}</button>
            ))}
          </div>
          {err && <div className="error">{err}</div>}
          <button className="btn cbt-submit" disabled={busy} onClick={() => setConfirm(true)}>{t('submitTest')}</button>
        </aside>
      </div>

      {confirm && (
        <div className="modal"><div className="card">
          <h3>{t('submitQ')}</h3>
          <p>{t('answered')} {answeredCount} · {t('unanswered')} {total - answeredCount} · {t('marked')} {Object.values(marked).filter(Boolean).length}</p>
          <div className="actions">
            <button className="btn" onClick={() => setConfirm(false)}>{t('contTest')}</button>
            <button className="btn danger" disabled={busy} onClick={finish}>{busy ? t('submitting') : t('yesSubmit')}</button>
          </div>
        </div></div>
      )}
    </div>
  );
}
