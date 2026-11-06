const BASE = (localStorage.getItem('apiUrl') || import.meta.env.VITE_API_URL || 'http://localhost:5080/api').replace(/\/$/, '');

export const getToken = () => localStorage.getItem('token');
export const getUser = () => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } };
export const setSession = (r) => { localStorage.setItem('token', r.token); localStorage.setItem('user', JSON.stringify({ name: r.name, email: r.email })); };
export const clearSession = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); };

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check your connection / API address.');
  }
  if (res.status === 401 && getToken()) { clearSession(); location.hash = '#/login'; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (b) => call('POST', '/auth/register', b),
  login: (b) => call('POST', '/auth/login', b),
  subjects: () => call('GET', '/subjects'),
  start: (b) => call('POST', '/attempts', b),
  submit: (id, b) => call('POST', `/attempts/${id}/submit`, b),
  attempts: () => call('GET', '/attempts'),
  attempt: (id) => call('GET', `/attempts/${id}`),
  analytics: () => call('GET', '/analytics'),
};

export const fmtTime = (s) => {
  const m = Math.floor(s / 60), ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};
