import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setSession } from '../api.js';

export default function Login() {
  const nav = useNavigate();
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
    <form className="card auth" onSubmit={submit}>
      <h1>🚓 पोलीस भरती Mock Test</h1>
      <p className="muted">Maharashtra Police Bharti – 100 marks · 90 minutes</p>
      {mode === 'register' && <input placeholder="Full name" value={f.name} onChange={set('name')} required />}
      <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
      <input type="password" placeholder="Password (min 6 characters)" value={f.password} onChange={set('password')} required minLength={6} />
      {err && <div className="error">{err}</div>}
      <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}</button>
      <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Already registered? Login'}
      </button>
    </form>
  );
}
