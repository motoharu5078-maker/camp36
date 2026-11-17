// 設定・チェック・数値記録はすべて localStorage（キーは camp36: で始まる）。
// 顔写真だけは photos.js（IndexedDB）に置く。

const P = 'camp36:';
const mem = new Map(); // localStorage が使えない環境（プライベートモード等）の一時置き場

export function get(k, def = null) {
  try {
    const v = localStorage.getItem(P + k);
    return v == null ? (mem.has(k) ? mem.get(k) : def) : JSON.parse(v);
  } catch { return mem.has(k) ? mem.get(k) : def; }
}

export function set(k, v) {
  try { localStorage.setItem(P + k, JSON.stringify(v)); }
  catch { mem.set(k, v); }
}

export function del(k) {
  try { localStorage.removeItem(P + k); } catch { /* noop */ }
  mem.delete(k);
}

export function keys(prefix = '') {
  const out = new Set(mem.keys());
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(P)) out.add(k.slice(P.length));
    }
  } catch { /* noop */ }
  return [...out].filter((k) => k.startsWith(prefix)).sort();
}

export const DEFAULTS = {
  setupDone: false,
  height: null, weight: null, age: null, activity: 1.375,
  machines: [], extras: [],
  gymDays: [3, 5, 0, 2],          // 水・金・日・火
  why: '',
  rules: [],                       // [{id, text}]
  times: { morning: '07:00', video: '21:30', gym: '19:00' },
  adjKcal: 0, adjSteps: 0,         // 週次レビューでの調整
  reviews: {},                     // {週番号: 'kcal-' | 'steps+' | 'kcal+'}
  step: 5,                         // 「重さ1段」= 何kgか
  rest: 75,                        // セット間休憩（秒）
};

export function settings() {
  const s = { ...DEFAULTS, ...get('settings', {}) };
  s.times = { ...DEFAULTS.times, ...(s.times || {}) };
  return s;
}
export function saveSettings(patch) {
  const s = { ...settings(), ...patch };
  set('settings', s);
  return s;
}

// --- 1日ぶんの記録 ---------------------------------------------------------
// { checks:{id:true}, weight, fat, sleep, steps, bloat, skin, salt, alcohol, late,
//   rules:{id:'kept'|'broken'}, photos:{front:true, side:true} }
export const day = (date) => get('day:' + date, {});
export function saveDay(date, patch) {
  const d = { ...day(date), ...patch };
  for (const k of Object.keys(d)) if (d[k] === null || d[k] === undefined) delete d[k];
  set('day:' + date, d);
  return d;
}
export function setCheck(date, id, on) {
  const d = day(date);
  const checks = { ...(d.checks || {}) };
  if (on) checks[id] = true; else delete checks[id];
  return saveDay(date, { checks });
}
export const dayDates = () => keys('day:').map((k) => k.slice(4));

// --- ジムの記録 -------------------------------------------------------------
// { type:'A'|'B', sets:{exId:[{w, r, done}]}, cardio:{min, done}, done:bool }
export const gym = (date) => get('gym:' + date, null);
export const saveGym = (date, v) => set('gym:' + date, v);
export const gymDates = () => keys('gym:').map((k) => k.slice(4));

// --- 今週のタスク（身だしなみ等） -----------------------------------------
export const tasks = () => get('tasks', {});
export function setTask(id, on) {
  const t = tasks();
  if (on) t[id] = true; else delete t[id];
  set('tasks', t);
}

// --- 未来の自分への手紙 -----------------------------------------------------
// 中身は Base64 にして保存する（バックアップを開いたときに、うっかり読めてしまわないように）
const enc = (s) => { let b = ''; for (const c of new TextEncoder().encode(s)) b += String.fromCharCode(c); return btoa(b); };
const dec = (b) => new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));

export const letter = () => get('letter', null); // {body, sealedAt, opened}
export function sealLetter(text, date) { set('letter', { body: enc(text), sealedAt: date, opened: false }); }
export function openLetter() {
  const l = letter();
  if (!l) return '';
  if (!l.opened) set('letter', { ...l, opened: true });
  try { return dec(l.body); } catch { return ''; }
}

export function wipeAll() {
  for (const k of keys()) del(k);
}
