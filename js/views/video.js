// 鬼の顔痩せ動画：埋め込み再生＋7:00 のカウントダウン＋完了チェック＋自分用メモ。
// 動画の中身（種目や手順）はアプリ側では書かない。気づきはメモ欄に自分で残す。

import * as store from '../store.js';
import { today } from '../dates.js';
import { videoStreak } from '../calc.js';
import { VIDEO } from '../data.js';
import { $, esc, icon, tape, mmss, buzz, beep, primeAudio, toast } from '../ui.js';

function total() {
  // テスト用：?timer=5 でタイマーを5秒にできる
  try {
    const q = new URLSearchParams(location.search).get('timer');
    if (q && /^\d+$/.test(q)) return Math.max(1, +q);
  } catch { /* noop */ }
  return VIDEO.seconds;
}

export default function render(el) {
  const date = today();
  const TOTAL_SEC = total();

  // タイマーは「終了時刻」で持つ。YouTube アプリに切り替えて戻ってきても進んでいる。
  let t = store.get('vtimer', null);
  if (!t || t.date !== date || t.total !== TOTAL_SEC) t = { date, total: TOTAL_SEC, left: TOTAL_SEC, endAt: null, finished: false };
  const save = () => store.set('vtimer', t);
  const left = () => (t.endAt ? Math.max(0, (t.endAt - Date.now()) / 1000) : t.left);
  const isDone = () => !!(store.day(date).checks || {}).video;

  el.innerHTML = `
    <header class="sub-head">
      <a class="icon-btn" href="#/today" aria-label="戻る">${icon.back}</a>
      ${tape('FACE TRAINING')}
      <span class="sub-meta">顔トレ連続 <b data-streak>0</b>日</span>
    </header>

    <div class="yt">
      <iframe src="${VIDEO.embed}" title="鬼の顔痩せ動画"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      ${navigator.onLine === false ? '<p class="yt-off">オフラインだ。動画は電波のある所で。</p>' : ''}
    </div>

    <div class="clock vclock" data-clock>
      <span class="clock-l">7 MIN</span><span class="clock-r" data-state>READY</span>
      <b data-time>${mmss(left())}</b>
    </div>
    <div class="row2">
      <button class="btn solid" data-toggle>${icon.play}スタート</button>
      <button class="btn ghost" data-reset>リセット</button>
    </div>
    <p class="muted">動画の再生と同時にスタートを押せ。0になったら完了を付けられる。</p>

    <p class="yt-t">${esc(VIDEO.title)}</p>
    <a class="btn ghost" href="${VIDEO.url}" target="_blank" rel="noopener">${icon.out}YouTubeアプリで開く</a>
    <p class="muted">埋め込みが再生できない時は、こっちで開け。タイマーは裏でも進む。</p>

    <section class="sec">
      <div class="sec-h"><span class="en">MEMO</span><span class="jp">キツかった所・コツ</span></div>
      <textarea class="ta" data-memo rows="5" maxlength="2000" placeholder="どこが一番きつかったか。次に気をつけること。自分の言葉で残せ。">${esc(store.get('videoMemo', ''))}</textarea>
      <button class="wiz-skip" data-outside>アプリの外で済ませた（タイマーなしで完了にする）</button>
    </section>

    <div class="dock">
      <button class="btn red" data-done disabled>完了にする</button>
    </div>
  `;

  const elTime = $('[data-time]', el);
  const elState = $('[data-state]', el);
  const btnToggle = $('[data-toggle]', el);
  const btnDone = $('[data-done]', el);
  const btnOutside = $('[data-outside]', el);
  const clock = $('[data-clock]', el);

  function paint() {
    const l = left();
    elTime.textContent = mmss(l);
    const running = !!t.endAt && l > 0;
    clock.classList.toggle('run', running);
    clock.classList.toggle('end', t.finished);
    elState.textContent = t.finished ? 'TIME' : running ? 'RUNNING' : l < TOTAL_SEC ? 'PAUSED' : 'READY';
    btnToggle.innerHTML = running ? `${icon.pause}一時停止` : `${icon.play}${l < TOTAL_SEC && !t.finished ? '再開' : 'スタート'}`;
    btnToggle.disabled = t.finished;
    const done = isDone();
    btnDone.disabled = !t.finished && !done;
    btnDone.textContent = done ? '完了済み（取り消す）' : t.finished ? '完了にする' : '7分やり切ったら押せる';
    btnDone.classList.toggle('red', !done);
    btnDone.classList.toggle('ghost', done);
    btnOutside.hidden = done || t.finished;
    $('[data-streak]', el).textContent = videoStreak(date);
  }

  function tick() {
    if (t.endAt && left() <= 0 && !t.finished) {
      t.finished = true; t.endAt = null; t.left = 0;
      save();
      buzz([200, 100, 200]);
      beep(3);
    }
    paint();
  }

  const iv = setInterval(tick, 250);
  tick();

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('toggle' in b.dataset) {
      primeAudio();
      if (t.endAt) { t.left = left(); t.endAt = null; } else { t.endAt = Date.now() + t.left * 1000; }
      save(); paint();
    } else if ('reset' in b.dataset) {
      t = { date, total: TOTAL_SEC, left: TOTAL_SEC, endAt: null, finished: false };
      save(); paint();
    } else if ('done' in b.dataset) {
      const on = !isDone();
      store.setCheck(date, 'video', on);
      if (on) { buzz(25); toast(`完了。顔トレ連続 ${videoStreak(date)}日。`); }
      paint();
    } else if ('outside' in b.dataset) {
      store.setCheck(date, 'video', true);
      buzz(25);
      toast(`完了。顔トレ連続 ${videoStreak(date)}日。`);
      paint();
    }
  });

  el.addEventListener('input', (e) => {
    if ('memo' in e.target.dataset) store.set('videoMemo', e.target.value);
  });

  return () => clearInterval(iv);
}
