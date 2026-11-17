// ROADMAP：36日の全体図、体重グラフ、週次レビュー、むくみの答え合わせ。

import * as store from '../store.js';
import * as photos from '../photos.js';
import { today, dayIndex, dateOfDay, mmdd, label, TOTAL } from '../dates.js';
import { phaseOf, tasksFor, weeklyReview, applyReview, weightSeries, movingAvg, bloatInsights, targets, stepsTarget } from '../calc.js';
import { PHASES } from '../data.js';
import { weightChart } from '../chart.js';
import { $, $$, esc, icon, tape, secHead, buzz, toast } from '../ui.js';

const sign = (n, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(d)}`;

export default function render(el) {
  const date = today();
  const di = dayIndex(date);

  function chartHtml() {
    const pts = weightSeries(date);
    if (!pts.length) {
      return `<section class="sec">${secHead('WEIGHT', '体重')}<p class="muted">体重を記録すると、ここに線が出る。判断は7日平均でやる。</p></section>`;
    }
    const ma = movingAvg(pts);
    const first = pts[0].w;
    const cur = ma[ma.length - 1].w;
    return `
      <section class="sec">
        ${secHead('WEIGHT', '体重', `${pts.length}日分`)}
        <dl class="nums compact three">
          <div><dt>開始</dt><dd>${first.toFixed(1)}<i>kg</i></dd></div>
          <div class="main"><dt>7日平均</dt><dd>${cur.toFixed(1)}<i>kg</i></dd></div>
          <div><dt>差</dt><dd>${sign(cur - first)}<i>kg</i></dd></div>
        </dl>
        ${weightChart(date)}
      </section>`;
  }

  function timelineHtml(s) {
    const cur = phaseOf(di);
    const done = store.tasks();
    return `
      <section class="sec">
        ${secHead('36 DAYS', '全体図')}
        <ol class="tl">
          ${PHASES.map((p) => {
            const state = di > p.to ? 'past' : di >= p.from ? 'now' : 'next';
            const dates = p.from === p.to ? label(dateOfDay(p.from)) : `${mmdd(dateOfDay(p.from))}〜${mmdd(dateOfDay(p.to))}`;
            const tasks = tasksFor(p.id, s);
            const steps = p.steps ? stepsTarget(p.from, s) : null;
            const goals = p.goals.map((g) => (steps && /^歩数/.test(g) ? `歩数 ${steps.toLocaleString('en-US')}歩` : g));
            return `
            <li class="tl-i ${state}">
              <span class="tl-dot"></span>
              <div class="tl-b">
                <div class="tl-h">${tape(p.code, state === 'now' ? 'hot' : '')}<span class="tl-d">${esc(dates)}</span></div>
                <h3>${esc(p.name)}<small>${esc(p.theme)}</small></h3>
                ${state === 'now' ? `<p class="tl-now"><b>NOW</b>DAY ${di}${p.from !== p.to ? ` ・ この期間の${di - p.from + 1}日目／${p.to - p.from + 1}日` : ''}</p>` : ''}
                <p class="tl-q">${esc(p.quote)}</p>
                <ul class="tl-g">${goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
                ${tasks.length ? `<div class="tl-t">${tasks.map((t) => `
                  <button class="chk slim${done[t.id] ? ' is-done' : ''}" data-task="${t.id}">
                    <span class="chk-box">${icon.check}</span><span class="chk-label">${esc(t.label)}</span><span class="chk-end"><span class="chk-tape">DONE</span></span>
                  </button>`).join('')}</div>` : ''}
              </div>
            </li>`;
          }).join('')}
        </ol>
        ${cur && cur.id === 'after' ? '<p class="muted">36日は終わった。ここから先は、同じことを続けるだけだ。</p>' : ''}
      </section>`;
  }

  function reviewHtml(s) {
    const open = [], later = [];
    for (let k = 1; k <= 5; k++) {
      if (di >= 7 * k) open.unshift(weeklyReview(k, s)); else later.push(k);
    }
    const t = targets(s);
    const block = (r) => {
      const opts = r.applied
        ? `<p class="rv-applied">${icon.check}<span>${r.applied === 'kcal-' ? '摂取を150kcal減らした' : r.applied === 'kcal+' ? '摂取を150kcal戻した' : '歩数目標を+2,000にした'}（反映済み）</span><button class="mini" data-rv-undo="${r.k}">取り消す</button></p>`
        : r.options.length ? `<div class="rv-opts">${r.options.map((o) => `<button class="btn small" data-rv="${r.k}" data-opt="${o.id}">${esc(o.label)}</button>`).join('')}</div>` : '';
      return `
        <article class="rv ${r.kind}">
          <div class="tl-h">${tape(`W${r.k} REVIEW`)}<span class="tl-d">${esc(label(r.date))}${di === r.day ? ' ・ 今夜' : ''}</span></div>
          <dl class="nums compact three">
            <div class="main"><dt>7日平均</dt><dd>${r.avg != null ? r.avg.toFixed(1) : '—'}<i>kg</i></dd></div>
            <div><dt>${r.k === 1 ? 'DAY 0 比' : '前週比'}</dt><dd>${r.diff != null ? sign(-r.diff) : '—'}<i>kg</i></dd></div>
            <div><dt>達成率</dt><dd>${r.rate}<i>/100</i></dd></div>
          </dl>
          <div class="rv-ph" data-rv-photos="${r.k}">
            <figure class="shot grain"><span class="shot-empty"><b>写真なし</b></span><figcaption class="shot-l">DAY ${r.day - 7}</figcaption></figure>
            <figure class="shot grain"><span class="shot-empty"><b>写真なし</b></span><figcaption class="shot-l">DAY ${r.day}</figcaption></figure>
          </div>
          <p class="rv-v"><span>来週の調整</span>${esc(r.verdict)}</p>
          ${opts}
        </article>`;
    };
    return `
      <section class="sec">
        ${secHead('WEEKLY REVIEW', '毎週火曜の夜', t ? `摂取 ${t.intake.toLocaleString('en-US')}kcal` : '')}
        ${open.length ? open.map(block).join('') : '<p class="muted">最初のレビューは 11/24（火）の夜。それまでは毎朝測って、線を作れ。</p>'}
        ${later.length ? `<ul class="rv-later">${later.map((k) => `<li><b>W${k}</b><span>${esc(label(dateOfDay(7 * k)))}の夜に開く</span></li>`).join('')}</ul>` : ''}
      </section>`;
  }

  function bloatHtml() {
    if (di < 1) return '';
    const { rows, log } = bloatInsights(date);
    const f = (v, n) => (v == null ? '<td class="na">—</td>' : `<td>${v.toFixed(1)}<small>${n}回</small></td>`);
    let top = null;
    for (const r of rows) {
      if (r.yes == null || r.no == null || r.nYes < 2) continue;
      const d = r.yes - r.no;
      if (d >= 0.5 && (!top || d > top.d)) top = { label: r.label, d };
    }
    return `
      <section class="sec">
        ${secHead('BLOAT', 'むくみの答え合わせ')}
        ${log.length ? `
        <table class="bl">
          <thead><tr><th>前日の行動</th><th>あった翌朝</th><th>なかった翌朝</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><th>${esc(r.label)}</th>${f(r.yes, r.nYes)}${f(r.no, r.nNo)}</tr>`).join('')}</tbody>
        </table>
        <p class="muted">数字は翌朝のむくみ評価（1〜5）の平均。差が大きい行動ほど、自分の顔に効いている。</p>
        ${top ? `<p class="rv-v"><span>一番効いている</span>「${esc(top.label)}」の翌朝は、むくみが平均 +${top.d.toFixed(1)}。まずこれを止めろ。</p>` : ''}
        <ul class="bl-log">
          ${log.slice(-7).reverse().map((x) => `<li><span>${esc(mmdd(x.date))}</span><em>予報 ${x.risk.level}</em><b>実感 ${x.actual}/5</b></li>`).join('')}
        </ul>` : '<p class="muted">夜に「塩分・お酒・23時以降」を付け、翌朝にむくみを1〜5で付ける。数日たまると、どの行動が自分の顔に効くかがここに出る。</p>'}
      </section>`;
  }

  function draw() {
    const s = store.settings();
    el.innerHTML = `
      <header class="page-top">${tape('ROADMAP')}<span class="sub-meta">${di < 0 ? 'PRE-CAMP' : di > TOTAL ? '完走' : `DAY ${di} / ${TOTAL}`}</span></header>
      <h1 class="page-h">12/23 から逆算しろ。</h1>
      <div class="prog" aria-hidden="true"><i style="width:${Math.min(100, Math.max(0, (di / TOTAL) * 100))}%"></i>${[7, 14, 21, 28, 35].map((d) => `<u style="left:${(d / TOTAL) * 100}%"></u>`).join('')}</div>
      ${chartHtml()}
      ${reviewHtml(s)}
      ${timelineHtml(s)}
      ${bloatHtml()}
    `;
    loadPhotos();
  }

  async function loadPhotos() {
    let idx;
    try { idx = await photos.index(); } catch { return; }
    // 火曜に撮れていなければ、その週でいちばん近い日の正面写真を使う
    const near = (d) => {
      for (let i = d; i > Math.max(-1, d - 7); i--) {
        const dt = dateOfDay(i);
        if (idx[dt] && idx[dt].front) return dt;
      }
      return null;
    };
    for (const box of $$('[data-rv-photos]', el)) {
      const k = +box.dataset.rvPhotos;
      const days = [7 * k - 7, 7 * k];
      const figs = $$('figure', box);
      for (let i = 0; i < 2; i++) {
        const dt = near(days[i]);
        if (!dt) continue;
        const u = await photos.url(dt, 'front');
        if (!u) continue;
        figs[i].querySelector('.shot-empty').outerHTML = `<img src="${u}" alt="">`;
        figs[i].querySelector('figcaption').textContent = `DAY ${dayIndex(dt)}`;
      }
    }
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.task) {
      const on = !store.tasks()[b.dataset.task];
      store.setTask(b.dataset.task, on);
      b.classList.toggle('is-done', on);
      if (on) { b.classList.remove('slap'); void b.offsetWidth; b.classList.add('slap'); buzz(18); }
    } else if (b.dataset.rv) {
      applyReview(+b.dataset.rv, b.dataset.opt);
      toast('来週の目標に反映した。');
      const y = window.scrollY;
      draw();
      window.scrollTo(0, y);
    } else if (b.dataset.rvUndo) {
      applyReview(+b.dataset.rvUndo, null);
      toast('取り消した。');
      const y = window.scrollY;
      draw();
      window.scrollTo(0, y);
    }
  });

  draw();
}
