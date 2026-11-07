// Dev server proxies /api -> localhost:5080 (so Codespaces/remote dev work with one forwarded port).
const BASE = (localStorage.getItem('apiUrl') || import.meta.env.VITE_API_URL || (location.protocol.startsWith('http') ? '/api' : 'http://localhost:5080/api')).replace(/\/$/, '');

export const getToken = () => localStorage.getItem('token');
export const getUser = () => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } };
export const setSession = (r) => { localStorage.setItem('token', r.token); localStorage.setItem('user', JSON.stringify({ name: r.name, email: r.email, isAdmin: !!r.isAdmin })); };
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
    throw new Error(localStorage.getItem('lang') === 'en' ? 'Cannot reach the server. Check your connection / API address.' : 'सर्व्हरशी संपर्क होऊ शकला नाही. इंटरनेट / API पत्ता तपासा.');
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
  analytics: (bank) => call('GET', '/analytics' + (bank ? '?bank=' + bank : '')),
  customStatus: () => call('GET', '/custom/status'),
  aiTest: (b) => call('POST', '/ai-test', b),
  analyticsAi: (bank) => call('GET', '/analytics/ai' + (bank ? '?bank=' + bank : '')),
  customBanks: () => call('GET', '/custom/banks'),
  customSave: (b) => call('POST', '/custom/banks', b),
  customDelete: (id) => call('DELETE', '/custom/banks/' + id),
  customParse: (form) => upload('/custom/parse', form),
  adminStats: () => call('GET', '/admin/stats'),
  adminQuestions: (p) => call('GET', '/admin/questions?' + new URLSearchParams(p)),
  adminDelete: (id) => call('DELETE', '/admin/questions/' + id),
  adminImport: (b) => call('POST', '/admin/questions/import', b),
};

export async function downloadTemplate() {
  const res = await fetch(BASE + '/admin/template.csv', { headers: { Authorization: 'Bearer ' + getToken() } });
  if (!res.ok) throw new Error('Download failed');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a'); a.href = url; a.download = 'questions-template.csv'; a.click();
  URL.revokeObjectURL(url);
}

export const fmtTime = (s) => {
  const m = Math.floor(s / 60), ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

// Multipart upload (the browser sets the Content-Type boundary itself).
async function upload(path, form) {
  let res;
  try {
    res = await fetch(BASE + path, { method: 'POST', headers: getToken() ? { Authorization: 'Bearer ' + getToken() } : {}, body: form });
  } catch {
    throw new Error(localStorage.getItem('lang') === 'en' ? 'Cannot reach the server. Check your connection / API address.' : 'सर्व्हरशी संपर्क होऊ शकला नाही. इंटरनेट / API पत्ता तपासा.');
  }
  if (res.status === 401 && getToken()) { clearSession(); location.hash = '#/login'; }
  if (res.status === 429) throw new Error(localStorage.getItem('lang') === 'en' ? 'Too many uploads. Please wait a few minutes.' : 'खूप जास्त अपलोड. कृपया काही मिनिटे थांबा.');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
