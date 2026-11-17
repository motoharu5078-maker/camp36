// DAY 36 のまとめ画面。DAY 0 と DAY 36 の顔、体重、ジムの伸び、達成率、最長ストリークを1枚に。
// スクリーンショットで残す前提のレイアウト。

import * as store from '../store.js';
import * as photos from '../photos.js';
import { today, dayIndex, dateOfDay, TOTAL } from '../dates.js';
import { weightSeries, averageScore, longestStreak, gymProgress, fmtKg } from '../calc.js';
import { weightChart } from '../chart.js';
import { $, esc, icon, tape } from '../ui.js';

export default async function render(el) {
  const date = today();
  const di = dayIndex(date);
  const s = store.settings();

  if (di < TOTAL) {
    el.innerHTML = `
      <header class="sub-head"><a class="icon-btn" href="#/today" aria-label="戻る">${icon.back}</a>${tape('WEIGH-IN RESULT')}</header>
      <div class="envelope">
        <div class="sealed big">${icon.lock}<b>12.23</b><span>計量日に開く</span></div>
        <p class="env-n"><b>${TOTAL - di}</b>日後</p>
        <p class="muted">DAY 0 と DAY 36 の顔を並べる画面だ。並べて恥ずかしくない36日にしろ。</p>
      </div>`;
    return;
  }

  const upto = dateOfDay(TOTAL);
  const pts = weightSeries(upto);
  const w0 = pts.length ? pts[0].w : s.weight;
  const w1 = pts.length ? pts[pts.length - 1].w : null;
  const rate = averageScore(1, TOTAL, s);
  const best = longestStreak(upto, s);
  let videoDays = 0, recDays = 0;
  for (let i = 0; i <= TOTAL; i++) {
    const r = store.day(dateOfDay(i));
    if ((r.checks || {}).video) videoDays++;
    if (r.weight != null) recDays++;
  }
  const gp = gymProgress();

  let idx = {};
  try { idx = await photos.index(); } catch { /* noop */ }
  const inCamp = Object.keys(idx).filter((d) => dayIndex(d) >= 0 && dayIndex(d) <= TOTAL).sort();
  const pair = async (kind) => {
    const ds = inCamp.filter((d) => idx[d][kind]);
    if (!ds.length) return null;
    const a = ds[0], b = ds[ds.length - 1];
    return { a, b, ua: await photos.url(a, kind), ub: await photos.url(b, kind) };
  };
  const front = await pair('front');
  const side = await pair('side');
  const photoRow = (p, lab) => (!p ? '' : `
    <div class="fin-ph">
      <figure class="shot grain"><img src="${p.ua}" alt=""><figcaption class="shot-l">DAY ${dayIndex(p.a)}</figcaption></figure>
      <figure class="shot grain"><img src="${p.ub}" alt=""><figcaption class="shot-l hot">DAY ${dayIndex(p.b)}</figcaption></figure>
      <span class="fin-ph-l">${lab}</span>
    </div>`);

  const diff = w0 != null && w1 != null ? w1 - w0 : null;
  const l = store.letter();

  el.innerHTML = `
    <header class="sub-head"><a class="icon-btn" href="#/today" aria-label="戻る">${icon.back}</a>${tape('WEIGH-IN RESULT')}</header>
    <article class="fin">
      <p class="fin-k">CAMP 36 ／ 2026.11.18 — 12.23</p>
      <h1 class="fin-h"><span>36 DAYS</span><b>DONE.</b></h1>

      ${front || side ? `${photoRow(front, '正面')}${photoRow(side, '横顔')}` : '<p class="muted">顔写真が残っていない。数字だけが証拠だ。</p>'}

      <dl class="fin-w">
        <div><dt>DAY 0</dt><dd>${w0 != null ? w0.toFixed(1) : '—'}<i>kg</i></dd></div>
        <div class="arrow">${icon.arrow}</div>
        <div><dt>DAY 36</dt><dd>${w1 != null ? w1.toFixed(1) : '—'}<i>kg</i></dd></div>
        <div class="delta"><dt>差</dt><dd>${diff != null ? `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff).toFixed(1)}` : '—'}<i>kg</i></dd></div>
      </dl>
      ${weightChart(upto)}

      <dl class="nums compact fin-n">
        <div class="main"><dt>達成率</dt><dd>${rate}<i>/100</i></dd></div>
        <div><dt>最長ストリーク</dt><dd>${best}<i>日</i></dd></div>
        <div><dt>顔トレ</dt><dd>${videoDays}<i>日</i></dd></div>
        <div><dt>ジム</dt><dd>${gp.sessions}<i>回</i></dd></div>
        <div><dt>計量</dt><dd>${recDays}<i>日</i></dd></div>
        <div><dt>顔写真</dt><dd>${inCamp.length}<i>日</i></dd></div>
      </dl>

      ${gp.rows.length ? `
      <div class="fin-g">
        <p class="fin-g-h">LIFT — 重量の伸び</p>
        <ul>
          ${gp.rows.map((r) => `<li><span>${esc(r.name)}</span><em>${fmtKg(r.first)} → ${fmtKg(r.best)}${r.unit}</em><b>${r.gain > 0 ? '+' + fmtKg(r.gain) : '±0'}</b></li>`).join('')}
        </ul>
      </div>` : ''}

      ${s.why && s.why.trim() ? `<blockquote class="fin-why"><span>WHY 12.23</span>${esc(s.why).replace(/\n/g, '<br>')}</blockquote>` : ''}
      <p class="fin-end">計量日だ。36日分の顔で立て。</p>
    </article>
    <p class="muted center">この画面をスクリーンショットで残せ。</p>
    ${l ? `<a class="notice hot" href="#/letter"><span class="en">LETTER</span><span>${l.opened ? 'DAY 0 の自分からの手紙' : '手紙を開封する'}</span>${icon.arrow}</a>` : ''}
  `;
}
