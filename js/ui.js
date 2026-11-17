// 画面まわりの小さな道具。

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** 線だけの自作アイコン（24x24） */
const svg = (d, extra = '') => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
export const icon = {
  check: svg('<path d="M5 12.500l4.500 4.500L19 7"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  tune: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><path d="M13 5h4v4h-4zM7 15h4v4H7z"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.500"/>'),
  play: svg('<path d="M7 5l12 7-12 7z"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  lock: svg('<path d="M6 11h12v9H6zM9 11V8a3 3 0 016 0v3"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  trash: svg('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'),
  copy: svg('<path d="M9 9h10v11H9zM5 15V4h10"/>'),
  out: svg('<path d="M14 5h5v5M19 5l-8 8M11 6H5v13h13v-6"/>'),
};

export function buzz(pattern = 15) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* 非対応（iPhone など）は無視 */ }
}

let actx = null;
/** タイマー終了音。振動が使えない iPhone 用の保険。 */
export function beep(times = 2) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    for (let i = 0; i < times; i++) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'square';
      o.frequency.value = 880;
      const t0 = actx.currentTime + i * 0.28;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      o.connect(g).connect(actx.destination);
      o.start(t0);
      o.stop(t0 + 0.22);
    }
  } catch { /* 音が出せなくても続行 */ }
}
/** ユーザー操作のタイミングで呼んでおくと、あとで音を鳴らせる（iOS の制限対策） */
export function primeAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { /* noop */ }
}

let toastTimer = null;
export function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/** 下から出る確認シート。OK なら true。 */
export function ask(message, { ok = 'やる', cancel = 'やめる', danger = false } = {}) {
  return new Promise((resolve) => {
    const root = $('#sheet-root');
    root.innerHTML = `
      <div class="sheet-bg" data-x></div>
      <div class="sheet" role="dialog" aria-modal="true">
        <p class="sheet-msg">${esc(message).replace(/\n/g, '<br>')}</p>
        <div class="sheet-btns">
          <button class="btn ghost" data-x>${esc(cancel)}</button>
          <button class="btn ${danger ? 'red' : 'solid'}" data-ok>${esc(ok)}</button>
        </div>
      </div>`;
    const done = (v) => { root.innerHTML = ''; resolve(v); };
    root.onclick = (e) => {
      if (e.target.closest('[data-ok]')) done(true);
      else if (e.target.closest('[data-x]')) done(false);
    };
  });
}

/** 中身を自由に入れられるシート。閉じる関数を返す。 */
export function sheet(html, onReady) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-bg" data-x></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { root.innerHTML = ''; root.onclick = null; };
  root.onclick = (e) => { if (e.target.closest('[data-x]')) close(); };
  if (onReady) onReady(root.querySelector('.sheet'), close);
  return close;
}

/** 数値入力を読む。空・不正は null。 */
export function num(v, { min = -Infinity, max = Infinity } = {}) {
  if (v == null) return null;
  const s = String(v).trim().replace(/[０-９．]/g, (c) => (c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0))).replace(',', '.');
  if (s === '') return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export const mmss = (sec) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** ファイルを端末に渡す。スマホは共有シート（カレンダーやファイルに保存できる）、それ以外はダウンロード。 */
export async function saveFile(name, mime, content) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  try {
    const file = new File([blob], name, { type: mime });
    if (coarse && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}

/** テーピング風ラベル */
export const tape = (text, cls = '') => `<span class="tape ${cls}">${esc(text)}</span>`;

/** セクション見出し（英字＋日本語＋右端メタ） */
export const secHead = (en, jp = '', meta = '') =>
  `<div class="sec-h"><span class="en">${esc(en)}</span>${jp ? `<span class="jp">${esc(jp)}</span>` : ''}${meta ? `<span class="meta">${meta}</span>` : ''}</div>`;
