// 間隔重複（SRS）：排程、佇列、同步到 progress/srs.json
const SRS = {
  NEW_PER_DAY: 20,
  REMOTE_PATH: 'progress/srs.json',
  DAY: 86400000,
  AGAIN_MS: 10 * 60 * 1000,

  empty() { return { cards: {}, newByDay: {} }; },

  loadLocal() {
    const s = store.get('n2.srs', null);
    return s && s.cards ? s : this.empty();
  },
  saveLocal(state) { store.set('n2.srs', state); },

  // 每張卡以最後複習時間較新的一方為準
  merge(a, b) {
    const out = { cards: { ...a.cards }, newByDay: { ...a.newByDay } };
    for (const [id, c] of Object.entries(b.cards || {})) {
      if (!out.cards[id] || (c.last || 0) > (out.cards[id].last || 0)) out.cards[id] = c;
    }
    for (const [d, n] of Object.entries(b.newByDay || {})) {
      out.newByDay[d] = Math.max(out.newByDay[d] || 0, n);
    }
    return out;
  },

  async sync() {
    if (!GH.hasToken()) return { ok: false, reason: 'no-token' };
    for (let attempt = 0; attempt < 2; attempt++) {
      const remote = await GH.getFile(this.REMOTE_PATH);
      const remoteState = remote ? JSON.parse(remote.text) : this.empty();
      const merged = this.merge(remoteState, this.loadLocal());
      this.saveLocal(merged);
      const text = JSON.stringify(merged, null, 1);
      if (remote && remote.text === text) return { ok: true };
      try {
        await GH.putFile(this.REMOTE_PATH, text, `srs: sync ${localDateKey()} (${deviceLabel()})`, remote && remote.sha);
        return { ok: true };
      } catch (e) {
        if (e.status !== 409 && e.status !== 422) throw e; // sha 衝突時重試一次
      }
    }
    return { ok: false, reason: 'conflict' };
  },

  // due：到期的舊卡；fresh：今天還能學的新卡
  buildQueue(deck, state, now = Date.now()) {
    const due = [], fresh = [];
    const today = localDateKey();
    const remainingNew = Math.max(0, this.NEW_PER_DAY - (state.newByDay[today] || 0));
    for (const card of deck) {
      const s = state.cards[card.id];
      if (!s) {
        if (fresh.length < remainingNew) fresh.push(card);
      } else if (s.due <= now) {
        due.push(card);
      }
    }
    due.sort((x, y) => state.cards[x.id].due - state.cards[y.id].due);
    return { due, fresh };
  },

  // rating: 0 忘了 / 1 模糊 / 2 記得
  schedule(prev, rating, now = Date.now()) {
    const s = prev
      ? { ...prev, history: [...(prev.history || [])] }
      : { interval: 0, ease: 2.5, reps: 0, lapses: 0, history: [] };
    if (rating === 0) {
      if (s.interval >= 1) s.lapses++;
      s.interval = 0;
      s.ease = Math.max(1.3, s.ease - 0.2);
      s.due = now + this.AGAIN_MS;
    } else {
      if (rating === 1) {
        s.interval = s.interval < 1 ? 1 : Math.max(s.interval + 1, Math.round(s.interval * 1.2));
        s.ease = Math.max(1.3, s.ease - 0.15);
      } else {
        s.interval = s.interval < 1 ? 1 : s.interval < 3 ? 3 : Math.round(s.interval * s.ease);
      }
      s.reps++;
      s.due = now + s.interval * this.DAY - 2 * 3600000; // 提早 2 小時，避免隔天同時段還沒到期
    }
    s.last = now;
    s.history.push({ t: now, r: rating });
    if (s.history.length > 20) s.history = s.history.slice(-20);
    return s;
  },

  previewLabel(prev, rating) {
    const s = this.schedule(prev, rating, 0);
    if (rating === 0) return '10 分鐘';
    return s.interval + ' 天';
  },
};
