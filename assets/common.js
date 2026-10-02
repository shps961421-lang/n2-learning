// 共用：設定、GitHub API、工具函式
const EXAM_DATE = new Date('2026-12-06T09:00:00+09:00');
const DEFAULT_OWNER = 'shps961421-lang';
const DEFAULT_REPO = 'n2-learning';

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  },
};

function getConfig() {
  const cfg = store.get('n2.cfg', {});
  return {
    owner: cfg.owner || DEFAULT_OWNER,
    repo: cfg.repo || DEFAULT_REPO,
    token: cfg.token || '',
  };
}

function saveConfig(cfg) {
  store.set('n2.cfg', cfg);
}

function b64encodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function b64decodeUtf8(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const GH = {
  headers() {
    const { token } = getConfig();
    const h = { Accept: 'application/vnd.github+json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  },
  url(path) {
    const { owner, repo } = getConfig();
    return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  },
  hasToken() {
    return !!getConfig().token;
  },
  // 回傳 { text, sha }；檔案不存在時回傳 null
  async getFile(path) {
    const res = await fetch(this.url(path) + `?t=${Date.now()}`, { headers: this.headers(), cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub 讀取失敗（${res.status}）`);
    const data = await res.json();
    return { text: b64decodeUtf8(data.content), sha: data.sha };
  },
  async putFile(path, text, message, sha) {
    const body = { message, content: b64encodeUtf8(text) };
    if (sha) body.sha = sha;
    const res = await fetch(this.url(path), {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = new Error(explainStatus(res.status, '寫入'));
      err.status = res.status;
      throw err;
    }
    return res.json();
  },
  async listDir(path) {
    const res = await fetch(this.url(path) + `?t=${Date.now()}`, { headers: this.headers(), cache: 'no-store' });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`GitHub 讀取失敗（${res.status}）`);
    return res.json();
  },
  async testConnection() {
    const { owner, repo } = getConfig();
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: this.headers() });
    if (!res.ok) throw new Error(explainStatus(res.status, '連線'));
    const data = await res.json();
    if (!data.permissions || !data.permissions.push) {
      throw new Error('token 沒有寫入權限：請到 GitHub 的 token 設定，確認有勾選 n2-learning，而且 Contents 設為 Read and write');
    }
    return data;
  },
};

function explainStatus(status, action) {
  const reasons = {
    401: 'token 錯誤或已過期，請重新複製貼上',
    403: 'token 沒有寫入權限：Contents 要設為 Read and write',
    404: 'token 沒有選到 n2-learning 這個 repo（Repository access 要勾選 n2-learning）',
    409: '檔案衝突，請再試一次',
    422: '檔案已經存在',
  };
  return `${action}失敗（${status}）：${reasons[status] || 'GitHub 回應錯誤，請稍後再試'}`;
}

// 待上傳的作答結果（上傳失敗時保留在手機上）
const Pending = {
  list() { return store.get('n2.pending', []); },
  add(item) {
    const list = this.list().filter(p => p.path !== item.path);
    list.push(item);
    store.set('n2.pending', list);
  },
  remove(path) {
    store.set('n2.pending', this.list().filter(p => p.path !== path));
  },
  // 回傳成功上傳的份數；失敗原因記在 lastError
  async flush() {
    let ok = 0;
    this.setError(null);
    if (!this.list().length) return 0;
    if (!GH.hasToken()) {
      this.setError('這台裝置還沒設定 GitHub token（手機和電腦要各設定一次）');
      return 0;
    }
    for (const p of this.list()) {
      try {
        await GH.putFile(p.path, p.text, p.message);
        this.remove(p.path);
        ok++;
      } catch (e) {
        if (e.status === 422) { this.remove(p.path); ok++; continue; } // 已存在
        this.setError(e.status ? e.message : `連不上 GitHub，可能是網路問題（${e.message}）`);
      }
    }
    return ok;
  },
  lastError() { return store.get('n2.pendingError', null); },
  setError(msg) { store.set('n2.pendingError', msg); },
};

async function fetchJson(path) {
  const res = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`讀取 ${path} 失敗（${res.status}）`);
  return res.json();
}

function daysUntilExam() {
  return Math.ceil((EXAM_DATE - new Date()) / 86400000);
}

function localDateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function stamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function fmtDuration(sec) {
  sec = Math.round(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(c));
  }
  return node;
}

function toast(msg, ms = 2500) {
  const t = el('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

function deviceLabel() {
  return /iPhone|iPad|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}
