import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fmtTime } from '../api.js';

export default function Exam() {
  const { id } = useParams();
  const nav = useNavigate();
  const exam = useMemo(() => { try { return JSON.parse(sessionStorage.getItem('exam:' + id)); } catch { return null; } }, [id]);
  const saveKey = 'exam-state:' + id;

  // Persisted so a refresh / app restart does not lose progress.
  const initial = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(saveKey)); } catch { return null; }
  }, [saveKey]);
  const [answers, setAnswers] = useState(initial?.answers || {});
  const [marked, setMarked] = useState(initial?.marked || {});
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
    localStorage.setItem(saveKey, JSON.stringify({ answers, marked, spent, startedAtMs: startedAtMs.current }));
  }, [answers, marked, spent, saveKey]);

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

  if (!exam) return <div className="card"><p>This exam session is no longer available on this device.</p><button className="btn" onClick={() => nav('/')}>Back to home</button></div>;

  const q = exam.questions[idx];
  const goto = (i) => { flushTime(q.id); setIdx(i); };
  const answeredCount = Object.keys(answers).length;
  const sections = [...new Set(exam.questions.map((x) => x.subject))];

  return (
    <div className="exam">
      <div className="examhead">
        <div><b>{q.subject}</b> <span className="muted">· {q.topic}</span></div>
        <div className={'timer' + (left < 300 ? ' danger' : '')}>⏱ {fmtTime(Math.max(0, left))}</div>
      </div>

      <div className="exambody">
        <section className="card qcard">
          <div className="muted">Question {idx + 1} of {exam.questions.length}</div>
          <p className="qtext">{q.text}</p>
          {q.options.map((o, i) => (
            <label key={i} className={'opt' + (answers[q.id] === i ? ' sel' : '')}>
              <input type="radio" name={'q' + q.id} checked={answers[q.id] === i} onChange={() => setAnswers({ ...answers, [q.id]: i })} />
              <span className="letter">{'ABCD'[i]}</span> {o}
            </label>
          ))}
          <div className="actions">
            <button className="btn" disabled={idx === 0} onClick={() => goto(idx - 1)}>← Prev</button>
            <button className="btn" onClick={() => { const a = { ...answers }; delete a[q.id]; setAnswers(a); }}>Clear</button>
            <button className={'btn' + (marked[q.id] ? ' warn' : '')} onClick={() => setMarked({ ...marked, [q.id]: !marked[q.id] })}>⚑ Review</button>
            <button className="btn primary" disabled={idx === exam.questions.length - 1} onClick={() => goto(idx + 1)}>Next →</button>
          </div>
        </section>

        <aside className="card palette">
          {sections.map((s) => (
            <div key={s}>
              <div className="muted small">{s}</div>
              <div className="pal">
                {exam.questions.map((x, i) => x.subject === s && (
                  <button key={x.id} onClick={() => goto(i)}
                    className={'pb' + (i === idx ? ' cur' : '') + (answers[x.id] !== undefined ? ' ans' : '') + (marked[x.id] ? ' mk' : '')}>{i + 1}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="muted small">Answered {answeredCount}/{exam.questions.length}</div>
          {err && <div className="error">{err}</div>}
          <button className="btn danger" disabled={busy} onClick={() => setConfirm(true)}>Submit test</button>
        </aside>
      </div>

      {confirm && (
        <div className="modal"><div className="card">
          <h3>Submit test?</h3>
          <p>Answered {answeredCount} · Unanswered {exam.questions.length - answeredCount} · Marked {Object.values(marked).filter(Boolean).length}</p>
          <div className="actions">
            <button className="btn" onClick={() => setConfirm(false)}>Continue test</button>
            <button className="btn danger" disabled={busy} onClick={finish}>{busy ? 'Submitting…' : 'Yes, submit'}</button>
          </div>
        </div></div>
      )}
    </div>
  );
}
