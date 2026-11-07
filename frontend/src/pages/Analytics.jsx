import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, getUser } from '../api.js';
import { useLang } from '../i18n.jsx';

const color = (a) => (a >= 75 ? '#2e9e5b' : a >= 60 ? '#e0a800' : '#d9534f');

export default function Analytics() {
  const { t, L, attemptLabel } = useLang();
  const [sp, setSp] = useSearchParams();
  const bank = sp.get('bank') || '';
  const [banks, setBanks] = useState([]);
  useEffect(() => { api.customBanks().then(setBanks).catch(() => {}); }, []);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { setD(null); setErr(''); api.analytics(bank).then(setD).catch((e) => setErr(e.message)); }, [bank]);
  const picker = banks.length > 0 && (
    <div className="tabs noprint">
      <button className={'tab' + (!bank ? ' on' : '')} onClick={() => setSp({})}>{t('cuOfficial')}</button>
      {banks.map((b) => <button key={b.id} className={'tab' + (String(b.id) === bank ? ' on' : '')} onClick={() => setSp({ bank: b.id })}>{b.name}</button>)}
    </div>
  );
  if (err) return <>{picker}<div className="error">{err}</div></>;
  if (!d) return <>{picker}<p>{t('loading')}</p></>;
  if (!d.hasData) return <>{picker}<div className="card"><p>{t('noData')}</p><Link className="btn primary" to={bank ? '/custom' : '/'}>{t('startTest')}</Link></div></>;

  const s = d.summary;
  const trend = d.trend.map((x, i) => ({ n: i + 1, percent: x.percent, label: attemptLabel(x) }));
  const subjects = d.subjects.map((x) => ({ ...x, label: L(x.name) }));

  return (
    <>
      <div className="printonly report-head">
        <h1>{t('reportTitle')}</h1>
        <p>{t('candidate')}: {getUser()?.name} · {new Date().toLocaleDateString()}</p>
      </div>
      {picker}
      <div className="titlebar"><h2>{t('perfAnalytics')}</h2><button className="btn noprint" onClick={() => window.print()}>{t('print')}</button></div>
      <div className="grid stats">
        <div className="card stat"><div className="big">{s.attempts}</div><div className="muted">{t('testsTaken')}</div></div>
        <div className="card stat"><div className="big">{s.overallAccuracy}%</div><div className="muted">{t('overallAcc')}</div></div>
        <div className="card stat"><div className="big">{s.lastFullPercent ?? '–'}{s.lastFullPercent != null && '%'}</div><div className="muted">{t('lastFull')}</div></div>
        <div className="card stat"><div className="big">{s.bestFullPercent ?? '–'}{s.bestFullPercent != null && '%'}</div><div className="muted">{t('bestFull')}</div></div>
        <div className="card stat"><div className="big">{s.questionsAnswered}</div><div className="muted">{t('qsAttempted')}</div></div>
      </div>

      <div className="card reco">
        <h3>{t('improve')}</h3>
        <ul>{d.recommendations.map((x, i) => <li key={i}>{L(x)}</li>)}</ul>
        {!d.isCustom && <p className="muted small">{t('target')} {s.targetPercent}% — {t('targetNote')}</p>}
      </div>

      <div className="card">
        <h3>{t('trend')}</h3>
        <div style={{ height: 240 }}>
          <ResponsiveContainer><LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="n" label={{ value: t('testNo'), position: 'insideBottom', offset: -2 }} /><YAxis domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v, _n, p) => [v + '%', p.payload.label]} />
            <ReferenceLine y={s.targetPercent} stroke="#2e9e5b" strokeDasharray="4 4" />
            <Line isAnimationActive={false} type="monotone" dataKey="percent" stroke="#1d3a8a" strokeWidth={2} dot />
          </LineChart></ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3>{t('subjAcc')}</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer><BarChart data={subjects}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" fontSize={12} /><YAxis domain={[0, 100]} unit="%" /><Tooltip />
            <Bar dataKey="accuracy" isAnimationActive={false}>{subjects.map((x) => <Cell key={x.subject} fill={color(x.accuracy)} />)}</Bar>
          </BarChart></ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3>{t('topicWise')}</h3>
        <div className="tablewrap"><table>
          <thead><tr><th>{t('subject')}</th><th>{t('topic')}</th><th>{t('correct')}</th><th>{t('accuracy')}</th></tr></thead>
          <tbody>{d.topics.map((x, i) => (
            <tr key={i}><td>{L(x.subject)}</td><td>{L(x.topic)}</td><td>{x.correct}/{x.total}</td>
              <td><span className="pill" style={{ background: color(x.accuracy) }}>{x.accuracy}%</span></td></tr>
          ))}</tbody>
        </table></div>
      </div>

      <div className="grid">
        <div className="card"><h3>{t('strong')}</h3>{d.strong.length ? <ul>{d.strong.map((x, i) => <li key={i}>{L(x.topic)} — {x.accuracy}%</li>)}</ul> : <p className="muted">{t('keepPractising')}</p>}</div>
        <div className="card"><h3>{t('byDiff')}</h3><ul>{d.difficulty.map((x) => <li key={x.level}>{t('d' + x.level)}: {x.accuracy}% ({x.total} {t('qs')})</li>)}</ul></div>
      </div>
    </>
  );
}
