import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api.js';

const color = (a) => (a >= 75 ? '#2e9e5b' : a >= 60 ? '#e0a800' : '#d9534f');

export default function Analytics() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.analytics().then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="error">{err}</div>;
  if (!d) return <p>Loading…</p>;
  if (!d.hasData) return <div className="card"><p>Take at least one test to see your analytics.</p><Link className="btn primary" to="/">Start a test</Link></div>;

  const s = d.summary;
  const trend = d.trend.map((t, i) => ({ n: i + 1, percent: t.percent, label: t.mode === 'full' ? 'Full' : t.subject }));

  return (
    <>
      <h2>Performance analytics</h2>
      <div className="grid stats">
        <div className="card stat"><div className="big">{s.attempts}</div><div className="muted">Tests taken</div></div>
        <div className="card stat"><div className="big">{s.overallAccuracy}%</div><div className="muted">Overall accuracy</div></div>
        <div className="card stat"><div className="big">{s.lastFullPercent ?? '–'}{s.lastFullPercent != null && '%'}</div><div className="muted">Last full mock</div></div>
        <div className="card stat"><div className="big">{s.bestFullPercent ?? '–'}{s.bestFullPercent != null && '%'}</div><div className="muted">Best full mock</div></div>
        <div className="card stat"><div className="big">{s.questionsAnswered}</div><div className="muted">Questions attempted</div></div>
      </div>

      <div className="card reco">
        <h3>🎯 What to improve before the final exam</h3>
        <ul>{d.recommendations.map((t, i) => <li key={i}>{t}</li>)}</ul>
        <p className="muted small">Target {s.targetPercent}% is an approximate guide based on past cut-offs; actual cut-offs vary by district, category and paper difficulty.</p>
      </div>

      <div className="card">
        <h3>Score trend</h3>
        <div style={{ height: 240 }}>
          <ResponsiveContainer><LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="n" label={{ value: 'Test #', position: 'insideBottom', offset: -2 }} /><YAxis domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v, _n, p) => [v + '%', p.payload.label]} />
            <ReferenceLine y={s.targetPercent} stroke="#2e9e5b" strokeDasharray="4 4" />
            <Line isAnimationActive={false} type="monotone" dataKey="percent" stroke="#1d3a8a" strokeWidth={2} dot />
          </LineChart></ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3>Subject accuracy</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer><BarChart data={d.subjects}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="subject" fontSize={12} /><YAxis domain={[0, 100]} unit="%" /><Tooltip />
            <Bar dataKey="accuracy" isAnimationActive={false}>{d.subjects.map((x) => <Cell key={x.subject} fill={color(x.accuracy)} />)}</Bar>
          </BarChart></ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3>Topic-wise (weakest first)</h3>
        <div className="tablewrap"><table>
          <thead><tr><th>Subject</th><th>Topic</th><th>Correct</th><th>Accuracy</th></tr></thead>
          <tbody>{d.topics.map((t) => (
            <tr key={t.subject + t.topic}><td>{t.subject}</td><td>{t.topic}</td><td>{t.correct}/{t.total}</td>
              <td><span className="pill" style={{ background: color(t.accuracy) }}>{t.accuracy}%</span></td></tr>
          ))}</tbody>
        </table></div>
      </div>

      <div className="grid">
        <div className="card"><h3>💪 Strong topics</h3>{d.strong.length ? <ul>{d.strong.map((t) => <li key={t.topic}>{t.topic} — {t.accuracy}%</li>)}</ul> : <p className="muted">Keep practising to build strengths.</p>}</div>
        <div className="card"><h3>By difficulty</h3><ul>{d.difficulty.map((x) => <li key={x.level}>{x.level}: {x.accuracy}% ({x.total} Qs)</li>)}</ul></div>
      </div>
    </>
  );
}
