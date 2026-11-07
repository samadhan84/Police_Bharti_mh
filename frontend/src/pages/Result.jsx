import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, fmtTime, getUser } from '../api.js';
import { useLang } from '../i18n.jsx';

export default function Result() {
  const { id } = useParams();
  const { t, L, lang, dt, attemptLabel } = useLang();
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');
  useEffect(() => { api.attempt(id).then(setR).catch((e) => setErr(e.message)); }, [id]);

  if (err) return <div className="error">{err}</div>;
  if (!r) return <p>{t('loading')}</p>;
  const pct = Math.round((100 * r.correct) / r.total);
  const chart = r.bySubject.map((s) => ({ name: L(s.name), [t('correct')]: s.correct, [t('wrong')]: s.total - s.correct }));
  const items = r.review.filter((x) => filter === 'all' || (filter === 'wrong' ? !x.isCorrect && x.selected !== null : filter === 'skipped' ? x.selected === null : x.isCorrect));
  const letters = lang === 'mr' ? 'अबकड' : 'ABCD';

  return (
    <>
      <div className="printonly report-head">
        <h1>{t('reportTitle')}</h1>
        <p>{t('candidate')}: {getUser()?.name} · {dt(r.submittedAt)}</p>
      </div>
      <h2>{t('result')} — {attemptLabel(r)}</h2>
      <div className="grid stats">
        <div className="card stat"><div className="big">{r.correct}/{r.total}</div><div className="muted">{t('score')} ({pct}%)</div></div>
        <div className="card stat"><div className="big ok">{r.correct}</div><div className="muted">{t('correct')}</div></div>
        <div className="card stat"><div className="big bad">{r.wrong}</div><div className="muted">{t('wrong')}</div></div>
        <div className="card stat"><div className="big">{r.skipped}</div><div className="muted">{t('skipped')}</div></div>
        <div className="card stat"><div className="big">{fmtTime(r.timeTakenSec)}</div><div className="muted">{t('timeTaken')}</div></div>
      </div>

      <div className="card">
        <h3>{t('subjectWise')}</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer><BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
            <Bar isAnimationActive={false} dataKey={t('correct')} stackId="a" fill="#2e9e5b" /><Bar isAnimationActive={false} dataKey={t('wrong')} stackId="a" fill="#d9534f" />
          </BarChart></ResponsiveContainer>
        </div>
      </div>
      <p className="noprint">
        <Link className="btn primary" to="/analytics">{t('seeAnalytics')}</Link>{' '}
        <button className="btn" onClick={() => window.print()}>{t('print')}</button>
      </p>

      <h3>{t('reviewAns')}</h3>
      <div className="tabs noprint">
        {['all', 'wrong', 'skipped', 'correct'].map((f) => <button key={f} className={'tab' + (filter === f ? ' on' : '')} onClick={() => setFilter(f)}>{t('f_' + f)}</button>)}
      </div>
      {items.map((x) => (
        <div className={'card rev ' + (x.isCorrect ? 'good' : x.selected === null ? 'skip' : 'wrong')} key={x.questionId}>
          <div className="muted small">{L(x.subject)} · {L(x.topic)} · {x.timeSec}s</div>
          <p className="qtext">{L(x.text)}</p>
          {(x.options[lang] || x.options.en).map((o, i) => (
            <div key={i} className={'ro' + (i === x.correct ? ' right' : i === x.selected ? ' mine' : '')}>
              {letters[i]}. {o} {i === x.correct && '✔'} {i === x.selected && i !== x.correct && `✘ ${t('yourAns')}`}
            </div>
          ))}
          {x.selected === null && <div className="muted small">{t('notAttempted')}</div>}
          <div className="expl">💡 {L(x.explanation)}</div>
        </div>
      ))}
    </>
  );
}
