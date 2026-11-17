// 起動とルーティング。画面は #/today のようなハッシュで切り替える。
// デバッグ用の ?date=2026-12-23 はハッシュを変えても残る。

import * as store from './store.js';
import * as photos from './photos.js';
import { $, $$ } from './ui.js';

import today from './views/today.js';
import face from './views/face.js';
import gym from './views/gym.js';
import roadmap from './views/roadmap.js';
import book from './views/book.js';
import video from './views/video.js';
import settings from './views/settings.js';
import setup from './views/setup.js';
import letter from './views/letter.js';
import final from './views/final.js';

const views = { today, face, gym, roadmap, book, video, settings, setup, letter, final };
const TABS = ['today', 'face', 'gym', 'roadmap', 'book'];

let cleanup = null;
let token = 0;

async function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name0, ...params] = raw.split('/').filter(Boolean);
  let name = views[name0] ? name0 : 'today';

  if (!store.settings().setupDone && name !== 'setup') {
    location.replace(location.pathname + location.search + '#/setup');
    return;
  }

  if (cleanup) { try { cleanup(); } catch { /* noop */ } cleanup = null; }
  $('#sheet-root').innerHTML = '';

  // 画面ごとに <main> を作り直す（前の画面のイベントを持ち越さない）
  const old = $('#view');
  const el = document.createElement('main');
  el.id = 'view';
  el.className = 'view-' + name;
  old.replaceWith(el);
  document.body.dataset.view = name;
  document.body.dataset.sub = params[0] || '';
  for (const a of $$('#tabs a')) a.classList.toggle('on', a.dataset.tab === name);
  window.scrollTo(0, 0);

  const my = ++token;
  try {
    const c = await views[name](el, params);
    if (my !== token) { if (typeof c === 'function') c(); return; }
    cleanup = typeof c === 'function' ? c : null;
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="oops"><p class="en">ERROR</p><p>画面を出せなかった。読み込み直せ。</p><button class="btn" onclick="location.reload()">読み込み直す</button></div>`;
  }
}

window.addEventListener('hashchange', route);

// タブを押し直したら先頭へ戻る
$('#tabs').addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (a && a.classList.contains('on') && location.hash === a.getAttribute('href')) window.scrollTo({ top: 0, behavior: 'smooth' });
});

// 日付が変わった状態でアプリに戻ってきたら描き直す
let shownAt = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const view = document.body.dataset.view;
  if (Date.now() - shownAt > 30 * 60 * 1000 && TABS.includes(view) && !document.body.dataset.sub) route();
  shownAt = Date.now();
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 登録できなくてもアプリは動く */ });
  });
}

// 端末がストレージを勝手に消しにくくなるよう頼んでおく（対応ブラウザのみ）
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

photos.syncIndex().finally(route);
