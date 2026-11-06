import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, fmtTime } from '../api.js';

export default function Result() {
  const { id } = useParams();
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');
  useEffect(() => { api.attempt(id).then(setR).catch((e) => setErr(e.message)); }, [id]);

  if (err) return <div className="error">{err}</div>;
  if (!r) return <p>Loading…</p>;
  const pct = Math.round((100 * r.correct) / r.total);
  const chart = r.bySubject.map((s) => ({ name: s.subject, Correct: s.correct, Wrong: s.total - s.correct }));
  const items = r.review.filter((x) => filter === 'all' || (filter === 'wrong' ? !x.isCorrect && x.selected !== null : filter === 'skipped' ? x.selected === null : x.isCorrect));

  return (
    <>
      <h2>Result — {r.mode === 'full' ? 'Full Mock' : r.subject}</h2>
      <div className="grid stats">
        <div className="card stat"><div className="big">{r.correct}/{r.total}</div><div className="muted">Score ({pct}%)</div></div>
        <div className="card stat"><div className="big ok">{r.correct}</div><div className="muted">Correct</div></div>
        <div className="card stat"><div className="big bad">{r.wrong}</div><div className="muted">Wrong</div></div>
        <div className="card stat"><div className="big">{r.skipped}</div><div className="muted">Skipped</div></div>
        <div className="card stat"><div className="big">{fmtTime(r.timeTakenSec)}</div><div className="muted">Time taken</div></div>
      </div>

      <div className="card">
        <h3>Subject-wise</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer><BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
            <Bar isAnimationActive={false} dataKey="Correct" stackId="a" fill="#2e9e5b" /><Bar isAnimationActive={false} dataKey="Wrong" stackId="a" fill="#d9534f" />
          </BarChart></ResponsiveContainer>
        </div>
      </div>
      <p><Link className="btn primary" to="/analytics">See overall analytics &amp; what to improve →</Link></p>

      <h3>Review answers</h3>
      <div className="tabs">
        {['all', 'wrong', 'skipped', 'correct'].map((f) => <button key={f} className={'tab' + (filter === f ? ' on' : '')} onClick={() => setFilter(f)}>{f}</button>)}
      </div>
      {items.map((x) => (
        <div className={'card rev ' + (x.isCorrect ? 'good' : x.selected === null ? 'skip' : 'wrong')} key={x.questionId}>
          <div className="muted small">{x.subject} · {x.topic} · {x.timeSec}s</div>
          <p className="qtext">{x.text}</p>
          {x.options.map((o, i) => (
            <div key={i} className={'ro' + (i === x.correct ? ' right' : i === x.selected ? ' mine' : '')}>
              {'ABCD'[i]}. {o} {i === x.correct && '✔'} {i === x.selected && i !== x.correct && '✘ (your answer)'}
            </div>
          ))}
          {x.selected === null && <div className="muted small">Not attempted</div>}
          <div className="expl">💡 {x.explanation}</div>
        </div>
      ))}
    </>
  );
}
