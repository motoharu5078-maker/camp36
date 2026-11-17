// FACE：毎日の顔写真（正面＋横顔）、Before/After 比較、タイムラプス、カレンダー一覧。
// 写真は端末内（IndexedDB）にだけ保存する。

import * as store from '../store.js';
import * as photos from '../photos.js';
import { KINDS, KIND_LABEL } from '../photos.js';
import { today, dayIndex, dateOfDay, label, mmdd, TOTAL } from '../dates.js';
import { $, $$, esc, icon, tape, secHead, toast, ask, buzz, sheet } from '../ui.js';

const HINT = '同じ場所・同じ照明・朝・無表情・アゴを引きすぎない';
const SUBS = [['log', '記録'], ['compare', '比較'], ['lapse', 'タイムラプス']];

const subnav = (cur) => `<nav class="subnav" aria-label="FACE">${SUBS.map(([id, lab]) => `<a href="#/face/${id}" class="${id === cur ? 'on' : ''}">${lab}</a>`).join('')}</nav>`;
const dayTag = (date) => { const di = dayIndex(date); return di >= 0 && di <= TOTAL ? `DAY ${di}` : label(date); };
const kindSeg = (kind) => `<div class="seg" data-kinds>${KINDS.map((k) => `<button data-kind="${k}" class="${k === kind ? 'on' : ''}" aria-pressed="${k === kind}">${KIND_LABEL[k]}</button>`).join('')}</div>`;

export default async function render(el, params) {
  const sub = params[0] || 'log';
  if (sub === 'cam') return camera(el, params[1] === 'side' ? 'side' : 'front');
  if (sub === 'compare') return compare(el);
  if (sub === 'lapse') return lapse(el);
  return log(el);
}

// --- 記録（今日の2枚＋カレンダー） -----------------------------------------

async function log(el) {
  const date = today();
  const tdi = dayIndex(date);
  let idx = {};
  let broken = false;
  try { idx = await photos.index(); } catch { broken = true; }
  const mine = idx[date] || {};
  const both = mine.front && mine.side;
  const nextKind = !mine.front ? 'front' : !mine.side ? 'side' : 'front';
  const nDays = Object.keys(idx).length;

  const shot = async (k) => {
    const u = mine[k] ? await photos.url(date, k) : null;
    return `
      <a class="shot grain" href="#/face/cam/${k}">
        ${u ? `<img src="${u}" alt="今日の${KIND_LABEL[k]}">` : `<span class="shot-empty">${icon.camera}<b>未撮影</b></span>`}
        <span class="shot-l">${KIND_LABEL[k]}</span>
      </a>`;
  };

  const cells = [];
  for (let i = 0; i < 6; i++) cells.push('<span class="cal-x"></span>');   // DAY 0 は火曜。週は水曜始まりで並べる
  for (let i = 0; i <= TOTAL; i++) {
    const d = dateOfDay(i);
    const has = idx[d];
    cells.push(`
      <button class="cal-c${has ? ' has' : ''}${i === tdi ? ' now' : ''}${i > tdi ? ' later' : ''}" data-day="${i}" ${has ? '' : 'disabled'} aria-label="DAY ${i} ${label(d)}${has ? ' 写真あり' : ''}">
        ${has ? `<img data-thumb="${d}|${has.front ? 'front' : 'side'}" alt="">` : ''}
        <b>${i}</b>
      </button>`);
  }

  el.innerHTML = `
    <header class="page-top">${tape('FACE LOG')}<span class="sub-meta">${nDays}日分</span></header>
    <h1 class="page-h">${both ? '今日の顔は残した。' : '今日の顔を残せ。'}</h1>
    ${broken ? '<p class="warn">このブラウザでは写真を保存できない（プライベートブラウズ等）。通常のSafariで開け。</p>' : ''}
    <div class="shots">${await shot('front')}${await shot('side')}</div>
    <p class="hint">${HINT}</p>
    <a class="btn red" href="#/face/cam/${nextKind}">${icon.camera}${both ? '撮り直す' : mine.front ? '横顔を撮る' : '撮影する'}</a>

    <section class="sec">
      ${secHead('CALENDAR', '撮った日', `${nDays}/${TOTAL + 1}`)}
      <div class="cal-h"><span>水</span><span>木</span><span>金</span><span>土</span><span>日</span><span>月</span><span>火</span></div>
      <div class="cal">${cells.join('')}</div>
      <p class="muted">数字は DAY。写真のある日をタップすると、拡大と削除ができる。<br>写真はこの端末の中だけに保存される。サーバーには送らない。</p>
    </section>
    ${subnav('log')}
  `;

  for (const img of $$('[data-thumb]', el)) {
    const [d, k] = img.dataset.thumb.split('|');
    photos.url(d, k).then((u) => { if (u) img.src = u; });
  }

  el.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-day]');
    if (!c) return;
    const d = dateOfDay(+c.dataset.day);
    const has = idx[d] || {};
    const imgs = await Promise.all(KINDS.map(async (k) => (has[k] ? `<figure class="shot grain"><img src="${await photos.url(d, k)}" alt=""><figcaption class="shot-l">${KIND_LABEL[k]}</figcaption></figure>` : `<figure class="shot"><span class="shot-empty"><b>なし</b></span><figcaption class="shot-l">${KIND_LABEL[k]}</figcaption></figure>`)));
    sheet(`
      <p class="sheet-h"><b>DAY ${c.dataset.day}</b><span>${esc(label(d))}</span></p>
      <div class="shots">${imgs.join('')}</div>
      <div class="sheet-btns three">
        ${KINDS.map((k) => `<button class="btn ghost danger small" data-del="${k}" ${has[k] ? '' : 'disabled'}>${icon.trash}${k === 'front' ? '正面' : '横顔'}</button>`).join('')}
        <button class="btn solid small" data-x>閉じる</button>
      </div>`, (box, close) => {
      box.addEventListener('click', async (ev) => {
        const b = ev.target.closest('[data-del]');
        if (!b) return;
        close();
        if (!(await ask(`DAY ${c.dataset.day} の${KIND_LABEL[b.dataset.del]}を消す。元には戻せない。`, { ok: '消す', danger: true }))) return;
        await photos.remove(d, b.dataset.del);
        toast('消した。');
        render(replace(el), ['log']);
      });
    });
  });
}

/** 同じ画面を描き直すときは <main> を作り直して、古いイベントを捨てる */
function replace(el) {
  const fresh = document.createElement('main');
  fresh.id = 'view';
  fresh.className = el.className;
  el.replaceWith(fresh);
  return fresh;
}

// --- 撮影 -------------------------------------------------------------------

function guide(kind) {
  // 顔の輪郭ガイド。毎日この枠に合わせて撮る。
  const front = `
    <ellipse cx="150" cy="186" rx="86" ry="116"/>
    <path d="M64 170h20M216 170h20M150 60v14M150 302v16"/>
    <path class="thin" d="M150 80v216M92 170h116"/>
    <text x="150" y="338">アゴ先をこの線に</text>`;
  const side = `
    <path d="M196 78c-52-14-104 18-104 78 0 22 6 34 2 50-4 14-18 22-18 32 0 8 10 10 12 16 2 8-4 12 0 20 4 8 4 14 12 20 12 8 34 6 52 2"/>
    <path d="M100 302h60"/>
    <path class="thin" d="M76 170h150"/>
    <text x="150" y="338">横顔（左）— アゴ先をこの線に</text>`;
  return `<svg class="cam-guide" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${kind === 'front' ? front : side}</svg>`;
}

async function camera(el, kind) {
  document.body.dataset.view = 'cam';
  const date = today();
  let idx = {};
  try { idx = await photos.index(); } catch { /* noop */ }
  const prevDate = Object.keys(idx).filter((d) => d < date && idx[d][kind]).sort().pop();
  const ghostUrl = prevDate ? await photos.url(prevDate, kind) : null;
  let ghostOn = store.get('ghost', true);

  el.innerHTML = `
    <div class="cam">
      <div class="cam-bar">
        <a class="icon-btn" href="#/face" aria-label="閉じる">${icon.close}</a>
        <div class="seg small">
          <a href="#/face/cam/front" class="${kind === 'front' ? 'on' : ''}">正面</a>
          <a href="#/face/cam/side" class="${kind === 'side' ? 'on' : ''}">横顔</a>
        </div>
        <button class="mini" data-ghost ${ghostUrl ? '' : 'disabled'}>GHOST</button>
      </div>
      <div class="cam-stage grain" data-stage>
        <video playsinline autoplay muted></video>
        ${ghostUrl ? `<img class="cam-ghost" src="${ghostUrl}" alt="">` : ''}
        <img class="cam-shot" alt="" hidden>
        ${guide(kind)}
        <span class="cam-tag">${esc(dayTag(date))} ・ ${KIND_LABEL[kind]}</span>
        ${ghostUrl ? `<span class="cam-tag r" data-ghost-tag>前回 ${esc(dayTag(prevDate))} を30%で重ねている</span>` : ''}
        <div class="cam-msg" data-msg hidden></div>
      </div>
      <p class="hint">${HINT}</p>
      <div class="cam-ctl" data-live>
        <label class="cam-alt">${icon.copy}<span>写真から</span><input type="file" accept="image/*" capture="user" data-file hidden></label>
        <button class="shutter" data-shoot aria-label="撮影する" disabled><i></i></button>
        <span class="cam-alt ph" aria-hidden="true"></span>
      </div>
      <div class="cam-ctl review" data-review hidden>
        <button class="btn ghost" data-retake>撮り直す</button>
        <button class="btn red" data-save>保存する</button>
      </div>
    </div>`;

  const video = $('video', el);
  const stage = $('[data-stage]', el);
  const shotImg = $('.cam-shot', el);
  const msg = $('[data-msg]', el);
  const live = $('[data-live]', el);
  const review = $('[data-review]', el);
  const btnShoot = $('[data-shoot]', el);
  let stream = null;
  let pending = null;
  let pendingUrl = null;
  let alive = true;

  const paintGhost = () => {
    stage.classList.toggle('ghost-off', !ghostOn);
    const b = $('[data-ghost]', el);
    b.classList.toggle('on', ghostOn && !!ghostUrl);
    b.textContent = ghostUrl ? (ghostOn ? 'GHOST ON' : 'GHOST OFF') : 'GHOST —';
  };
  paintGhost();

  function fallback(text) {
    // ライブ撮影が使えない時は、標準カメラ（ファイル選択）に切り替える
    stage.classList.add('no-live');
    msg.hidden = false;
    msg.innerHTML = `
      <p>${esc(text)}</p>
      <label class="btn solid">${icon.camera}標準カメラで撮る<input type="file" accept="image/*" capture="user" data-file hidden></label>
      <p class="small">${ghostUrl ? '後ろに見えているのが前回の写真だ。同じ距離・同じ角度で。' : '顔が枠いっぱいに入る距離で。'}</p>`;
    btnShoot.hidden = true;
  }

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fallback('この接続ではライブ撮影が使えない（HTTPS が必要）。');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1440 }, height: { ideal: 1080 } }, audio: false });
      if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream;
      await video.play().catch(() => {});
      btnShoot.disabled = false;
    } catch (err) {
      fallback(err && err.name === 'NotAllowedError' ? 'カメラが許可されていない。設定で許可するか、標準カメラで撮れ。' : 'カメラを起動できなかった。');
    }
  }

  function showReview(blob) {
    pending = blob;
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    pendingUrl = URL.createObjectURL(blob);
    shotImg.src = pendingUrl;
    shotImg.hidden = false;
    msg.hidden = true;
    stage.classList.add('reviewing');
    live.hidden = true;
    review.hidden = false;
  }

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('ghost' in b.dataset) {
      ghostOn = !ghostOn;
      store.set('ghost', ghostOn);
      paintGhost();
    } else if ('shoot' in b.dataset) {
      if (!video.videoWidth) return;
      buzz(20);
      showReview(await photos.fromVideo(video, true));
    } else if ('retake' in b.dataset) {
      pending = null;
      shotImg.hidden = true;
      stage.classList.remove('reviewing');
      review.hidden = true;
      live.hidden = false;
      if (stage.classList.contains('no-live')) msg.hidden = false;
    } else if ('save' in b.dataset) {
      if (!pending) return;
      b.disabled = true;
      try {
        await photos.put(date, kind, pending);
        buzz(25);
        const now = await photos.index();
        const needSide = kind === 'front' && !(now[date] || {}).side;
        toast(needSide ? '正面を保存した。次は横顔。' : '保存した。');
        location.hash = needSide ? '#/face/cam/side' : '#/face';
      } catch {
        b.disabled = false;
        toast('保存できなかった。端末の空き容量を確かめろ。');
      }
    }
  });

  el.addEventListener('change', async (e) => {
    if (!('file' in e.target.dataset)) return;
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { showReview(await photos.fromFile(file)); } catch { toast('その画像は読めなかった。'); }
  });

  start();

  return () => {
    alive = false;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
  };
}

// --- 比較（Before / After スライダー） -------------------------------------

async function compare(el) {
  let idx = {};
  try { idx = await photos.index(); } catch { /* noop */ }
  let kind = store.get('faceKind', 'front');
  const datesOf = (k) => Object.keys(idx).filter((d) => idx[d][k]).sort();
  if (!datesOf(kind).length && datesOf(kind === 'front' ? 'side' : 'front').length) kind = kind === 'front' ? 'side' : 'front';
  let a = null, b = null, pos = 50;

  function pick() {
    const ds = datesOf(kind);
    const d0 = dateOfDay(0);
    a = ds.includes(a) ? a : (ds.includes(d0) ? d0 : ds[0]) || null;
    b = ds.includes(b) ? b : ds[ds.length - 1] || null;
    return ds;
  }

  async function draw() {
    const ds = pick();
    if (!ds.length) {
      el.innerHTML = `
        <header class="page-top">${tape('BEFORE / AFTER')}</header>
        <div class="empty-box">${icon.camera}<p>まだ写真がない。<br>比べるには、まず撮れ。</p><a class="btn red" href="#/face/cam/front">撮影する</a></div>
        ${subnav('compare')}`;
      return;
    }
    const opts = (cur) => ds.map((d) => `<option value="${d}" ${d === cur ? 'selected' : ''}>${esc(dayTag(d))} ・ ${esc(mmdd(d))}</option>`).join('');
    const [ua, ub] = await Promise.all([photos.url(a, kind), photos.url(b, kind)]);
    el.innerHTML = `
      <header class="page-top">${tape('BEFORE / AFTER')}<span class="sub-meta">${ds.length}枚</span></header>
      <div class="cmp grain" data-cmp style="--p:${pos}%">
        <img class="cmp-a" src="${ua}" alt="Before" draggable="false">
        <img class="cmp-b" src="${ub}" alt="After" draggable="false">
        <span class="cmp-l a">BEFORE<small>${esc(dayTag(a))}</small></span>
        <span class="cmp-l b">AFTER<small>${esc(dayTag(b))}</small></span>
        <i class="cmp-bar"></i>
      </div>
      <input type="range" class="range" min="0" max="100" step="0.5" value="${pos}" data-pos aria-label="比較の位置">
      ${ds.length < 2 ? '<p class="muted">2日分たまると、違いが見える。明日も同じ条件で撮れ。</p>' : ''}
      <div class="grid2 sels">
        <label class="sel"><span>BEFORE</span><select data-sel="a">${opts(a)}</select></label>
        <label class="sel"><span>AFTER</span><select data-sel="b">${opts(b)}</select></label>
      </div>
      ${kindSeg(kind)}
      ${subnav('compare')}`;
    bindCmp();
  }

  function bindCmp() {
    const box = $('[data-cmp]', el);
    const range = $('[data-pos]', el);
    const set = (p) => {
      pos = Math.min(100, Math.max(0, p));
      box.style.setProperty('--p', pos + '%');
      range.value = pos;
    };
    range.addEventListener('input', () => set(+range.value));
    let dragging = false;
    const at = (e) => { const r = box.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
    box.addEventListener('pointerdown', (e) => { dragging = true; box.setPointerCapture(e.pointerId); at(e); });
    box.addEventListener('pointermove', (e) => { if (dragging) at(e); });
    box.addEventListener('pointerup', () => { dragging = false; });
    box.addEventListener('pointercancel', () => { dragging = false; });
  }

  el.addEventListener('change', (e) => {
    const w = e.target.dataset.sel;
    if (!w) return;
    if (w === 'a') a = e.target.value; else b = e.target.value;
    draw();
  });
  el.addEventListener('click', (e) => {
    const k = e.target.closest('[data-kind]');
    if (!k || k.dataset.kind === kind) return;
    if (!datesOf(k.dataset.kind).length) { toast(`${KIND_LABEL[k.dataset.kind]}の写真がまだない。`); return; }
    kind = k.dataset.kind;
    store.set('faceKind', kind);
    a = b = null;
    draw();
  });

  await draw();
}

// --- タイムラプス -----------------------------------------------------------

async function lapse(el) {
  let idx = {};
  try { idx = await photos.index(); } catch { /* noop */ }
  let kind = store.get('faceKind', 'front');
  const datesOf = (k) => Object.keys(idx).filter((d) => idx[d][k]).sort();
  if (!datesOf(kind).length && datesOf(kind === 'front' ? 'side' : 'front').length) kind = kind === 'front' ? 'side' : 'front';
  let fps = store.get('lapseFps', 4);
  let frames = [];
  let i = 0;
  let timer = null;

  const stop = () => { clearInterval(timer); timer = null; };

  function show() {
    const f = frames[i];
    if (!f) return;
    $('[data-frame]', el).src = f.url;
    $('[data-tag]', el).textContent = `${dayTag(f.date)} ・ ${label(f.date)}`;
    $('[data-prog]', el).style.width = `${((i + 1) / frames.length) * 100}%`;
    $('[data-n]', el).textContent = `${i + 1}/${frames.length}`;
  }
  function paintPlay() {
    const b = $('[data-play]', el);
    if (b) b.innerHTML = timer ? `${icon.pause}止める` : `${icon.play}再生`;
  }
  function play() {
    stop();
    if (frames.length < 2) return;
    timer = setInterval(() => { i = (i + 1) % frames.length; show(); }, 1000 / fps);
    paintPlay();
  }

  async function draw() {
    stop();
    const ds = datesOf(kind);
    if (!ds.length) {
      el.innerHTML = `
        <header class="page-top">${tape('TIMELAPSE')}</header>
        <div class="empty-box">${icon.play}<p>まだ写真がない。<br>毎日撮れば、36枚の変化が流れる。</p><a class="btn red" href="#/face/cam/front">撮影する</a></div>
        ${subnav('lapse')}`;
      return;
    }
    frames = await Promise.all(ds.map(async (d) => ({ date: d, url: await photos.url(d, kind) })));
    i = 0;
    el.innerHTML = `
      <header class="page-top">${tape('TIMELAPSE')}<span class="sub-meta" data-n></span></header>
      <div class="lapse grain"><img data-frame alt=""><span class="cam-tag" data-tag></span></div>
      <div class="bar thin"><i data-prog></i></div>
      ${frames.length < 2 ? '<p class="muted">1枚だけでは流れない。明日も撮れ。</p>' : ''}
      <div class="speed">
        <span>SPEED</span>
        <input type="range" class="range" min="1" max="12" step="1" value="${fps}" data-speed aria-label="再生速度">
        <b data-fps>${fps}枚/秒</b>
      </div>
      <div class="row2">
        <button class="btn solid" data-play ${frames.length < 2 ? 'disabled' : ''}>${icon.play}再生</button>
        ${kindSeg(kind)}
      </div>
      ${subnav('lapse')}`;
    show();
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-play]')) {
      if (timer) { stop(); paintPlay(); } else play();
      return;
    }
    const k = e.target.closest('[data-kind]');
    if (!k || k.dataset.kind === kind) return;
    if (!datesOf(k.dataset.kind).length) { toast(`${KIND_LABEL[k.dataset.kind]}の写真がまだない。`); return; }
    kind = k.dataset.kind;
    store.set('faceKind', kind);
    draw();
  });
  el.addEventListener('input', (e) => {
    if (!('speed' in e.target.dataset)) return;
    fps = +e.target.value;
    store.set('lapseFps', fps);
    $('[data-fps]', el).textContent = `${fps}枚/秒`;
    if (timer) play();
  });

  await draw();
  return stop;
}
