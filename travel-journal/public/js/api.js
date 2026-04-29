const API = {
  base: '/api',

  async request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body !== null) opts.body = JSON.stringify(body);

    const res = await fetch(this.base + path, opts);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.success === false) throw new Error(data.error || 'Request failed');
    return data.data;
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file'));
      if (file.size > 5 * 1024 * 1024) return reject(new Error('Each image must be under 5 MB'));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },

  async filesToBase64(files) {
    return Promise.all([...files].map(file => this.fileToBase64(file)));
  },

  journals: {
    list() { return API.request('GET', '/journals'); },
    get(id) { return API.request('GET', `/journals/${id}`); },
    create(payload) { return API.request('POST', '/journals', payload); },
    update(id, payload) { return API.request('PUT', `/journals/${id}`, payload); },
    delete(id) { return API.request('DELETE', `/journals/${id}`); }
  },

  entries: {
    list(params = {}) {
      const q = new URLSearchParams(params).toString();
      return API.request('GET', `/entries${q ? `?${q}` : ''}`);
    },
    get(id) { return API.request('GET', `/entries/${id}`); },
    create(payload) { return API.request('POST', '/entries', payload); },
    update(id, payload) { return API.request('PUT', `/entries/${id}`, payload); },
    delete(id) { return API.request('DELETE', `/entries/${id}`); },
    stats(userId) { return API.request('GET', `/entries/stats/summary?user_id=${encodeURIComponent(userId)}`); }
  },

  profiles: {
    get(id) { return API.request('GET', `/profiles/${id}`); },
    register(payload) { return API.request('POST', '/profiles/register', payload); },
    login(payload) { return API.request('POST', '/profiles/session/login', payload); },
    resetPassword(payload) { return API.request('POST', '/profiles/password/reset', payload); },
    upsert(payload) { return API.request('POST', '/profiles/register', payload); },
    update(id, payload) { return API.request('PUT', `/profiles/${id}`, payload); },
    me() { return API.request('GET', '/profiles/session/me'); },
    logout() { return API.request('POST', '/profiles/session/logout'); }
  }
};

window.API = API;

