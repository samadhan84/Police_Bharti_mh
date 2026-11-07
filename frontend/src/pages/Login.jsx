import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setSession } from '../api.js';
import { LangToggle, useLang } from '../i18n.jsx';

export default function Login() {
  const nav = useNavigate();
  const { t } = useLang();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      setSession(await (mode === 'login' ? api.login(f) : api.register(f)));
      nav('/');
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <div className="login-page">
      <header className="cbt-top"><b className="cbt-title">🚓 {t('app')}</b><LangToggle /></header>
      <form className="card auth" onSubmit={submit}>
        <div className="panel-title">{mode === 'login' ? t('login') : t('createAcc')}</div>
        <p className="muted">{t('tagline')}</p>
        {mode === 'register' && <input placeholder={t('fullName')} value={f.name} onChange={set('name')} required />}
        <input type="email" placeholder={t('email')} value={f.email} onChange={set('email')} required />
        <input type="password" placeholder={t('password')} value={f.password} onChange={set('password')} required minLength={6} />
        {err && <div className="error">{err}</div>}
        <button className="btn primary" disabled={busy}>{busy ? t('wait') : mode === 'login' ? t('login') : t('createAcc')}</button>
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? t('newHere') : t('haveAcc')}
        </button>
      </form>
    </div>
  );
}
