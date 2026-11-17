// GYM：chocoZAP の今日のメニュー、前回値と次回の提案、セット間の休憩タイマー。

import * as store from '../store.js';
import { today, dayIndex, label, mmdd, TOTAL } from '../dates.js';
import { isGymDay, gymType, nextGymDay, buildMenu, lastSets, suggest, fmtKg } from '../calc.js';
import { MENU, EXERCISES, EXTRAS } from '../data.js';
import { $, $$, esc, icon, tape, secHead, toast, buzz, beep, primeAudio, mmss, num } from '../ui.js';

// 休憩タイマーは画面を切り替えても動き続けるよう、モジュール側で持つ
const rest = { endAt: 0, total: 0, timeout: null };
function startRest(sec) {
  clearTimeout(rest.timeout);
  rest.total = sec;
  rest.endAt = Date.now() + sec * 1000;
  rest.timeout = setTimeout(() => {
    rest.endAt = 0;
    buzz([300, 120, 300]);
    beep(2);
    toast('休憩終わり。次のセットだ。');
  }, sec * 1000);
}
function stopRest() { clearTimeout(rest.timeout); rest.endAt = 0; }
const restLeft = () => (rest.endAt ? Math.max(0, (rest.endAt - Date.now()) / 1000) : 0);

function lastText(ex, last) {
  if (!last) return '記録なし';
  const sets = last.sets;
  if (ex.bw) return `${sets.map((x) => x.r).join('・')} ${ex.unit}`;
  const same = sets.every((x) => x.w === sets[0].w);
  return same ? `${fmtKg(sets[0].w)}kg × ${sets.map((x) => x.r).join('・')}` : sets.map((x) => `${fmtKg(x.w)}×${x.r}`).join(' / ');
}

export default function render(el) {
  const date = today();
  const di = dayIndex(date);
  const s = store.settings();
  const scheduled = isGymDay(date, s);
  const light = di === TOTAL - 1;
  let session = store.gym(date);
  let type = (session && session.type) || gymType(date, s);
  let forced = false;                     // オフの日に「今日やる」を押した

  const defaultSets = () => (light ? 2 : 3);
  const ensure = () => {
    if (!session) session = { type, sets: {}, cardio: {}, done: false };
    session.type = type;
    return session;
  };
  const save = () => store.saveGym(date, ensure());
  const rows = (exId) => {
    const have = (session && session.sets && session.sets[exId]) || [];
    const n = Math.max(defaultSets(), have.length);
    return Array.from({ length: n }, (_, i) => have[i] || { w: null, r: null, done: false });
  };

  function exHtml(ex, n, menuLen) {
    const last = lastSets(ex.id, date);
    const sug = suggest(ex.id, last, s);
    const rs = rows(ex.id);
    const hint = (i) => (sug.sets ? sug.sets[Math.min(i, sug.sets.length - 1)] : null);
    return `
      <section class="ex" data-ex="${ex.id}">
        <div class="ex-h">
          <span class="ex-n">${String(n).padStart(2, '0')}</span>
          <h2>${esc(ex.name)}</h2>
          <span class="ex-p">${esc(ex.part)}${ex.optional ? '・余力があれば' : ''}${ex.swapped ? '・代替' : ''}</span>
        </div>
        <p class="ex-cue">${esc(ex.cue)}</p>
        <div class="ex-last">
          <span>前回${last ? ' ' + esc(mmdd(last.date)) : ''}</span><b>${esc(lastText(ex, last))}</b>
        </div>
        <p class="ex-sug">${icon.arrow}${esc(sug.text)}</p>
        <div class="sets">
          ${rs.map((x, i) => {
            const h = hint(i);
            return `
            <div class="set${x.done ? ' is-done' : ''}" data-set="${i}">
              <span class="set-n">${i + 1}</span>
              ${ex.bw ? '' : `<label class="set-f"><input data-w type="text" inputmode="decimal" autocomplete="off" value="${x.w != null ? fmtKg(x.w) : ''}" placeholder="${h && h.w != null ? fmtKg(h.w) : '—'}" aria-label="重さ"><i>kg</i></label><span class="set-x">×</span>`}
              <label class="set-f"><input data-r type="text" inputmode="numeric" autocomplete="off" value="${x.r != null ? x.r : ''}" placeholder="${h ? h.r : '—'}" aria-label="回数"><i>${ex.bw ? ex.unit : '回'}</i></label>
              <button class="set-ok" data-ok aria-label="セット${i + 1}を完了">${icon.check}</button>
            </div>`;
          }).join('')}
        </div>
        <div class="ex-btns">
          <button class="mini" data-fill ${sug.sets ? '' : 'disabled'}>${icon.copy}前回＋提案を入れる</button>
          <button class="mini" data-addset ${rs.length >= 5 ? 'disabled' : ''}>${icon.plus}セット</button>
        </div>
      </section>`;
  }

  function offHtml() {
    const next = nextGymDay(date, s);
    const why = di < 1 ? 'DAY 0 は記録の日だ。ジムは明日から。' : di === TOTAL ? '計量日だ。今日はジムなし。' : '今日はオフ。休め。ただし歩け。';
    return `
      <header class="page-top">${tape('GYM — OFF')}<span class="sub-meta">${esc(label(date))}</span></header>
      <h1 class="page-h">${why}</h1>
      ${next ? `<p class="next-gym"><span>NEXT</span><b>${esc(label(next))}</b><em>${gymType(next, s)}日：${MENU[gymType(next, s)].title}</em></p>` : ''}
      ${di >= 1 && di !== TOTAL ? `<button class="btn" data-force>それでも今日やる（${type}日：${MENU[type].title}）</button>` : ''}
    `;
  }

  function bodyHtml() {
    const rec = store.day(date);
    return `
      <section class="sec">
        ${secHead('BODY COMP', '体組成計の数値', 'TODAYの記録に入る')}
        <div class="grid2">
          <label class="field"><span class="field-l">体重</span><span class="field-in"><input data-rec="weight" type="text" inputmode="decimal" autocomplete="off" placeholder="—" value="${rec.weight ?? ''}"><i>kg</i></span></label>
          <label class="field"><span class="field-l">体脂肪率</span><span class="field-in"><input data-rec="fat" type="text" inputmode="decimal" autocomplete="off" placeholder="—" value="${rec.fat ?? ''}"><i>%</i></span></label>
        </div>
      </section>`;
  }

  function logHtml() {
    const dates = store.gymDates().filter((d) => d !== date).reverse().slice(0, 6);
    if (!dates.length) return '';
    return `
      <section class="sec">
        ${secHead('LOG', 'これまでの記録')}
        <ul class="gym-log">
          ${dates.map((d) => {
            const g = store.gym(d);
            const n = Object.values(g.sets || {}).reduce((a, x) => a + x.filter((y) => y && y.r > 0).length, 0);
            return `<li><span>${esc(label(d))}</span><b>${g.type}日</b><em>${n}セット${g.done ? '・完了' : ''}</em></li>`;
          }).join('')}
        </ul>
      </section>`;
  }

  function restHtml() {
    return `
      <div class="rest" data-rest>
        <div class="clock" data-rest-clock>
          <span class="clock-l">REST</span><span class="clock-r" data-rest-state>${s.rest} SEC</span>
          <b data-rest-time>${mmss(s.rest)}</b>
        </div>
        <div class="rest-ctl">
          <div class="seg small">${[60, 75, 90].map((v) => `<button data-rest-sec="${v}" class="${s.rest === v ? 'on' : ''}">${v}</button>`).join('')}</div>
          <button class="btn solid small" data-rest-go>${icon.play}休憩</button>
        </div>
      </div>`;
  }

  function draw() {
    const active = scheduled || forced || !!session;
    if (!active) {
      el.innerHTML = `${offHtml()}${di >= 0 ? bodyHtml() : ''}${logHtml()}`;
      document.body.dataset.sub = '';
      return;
    }
    const menu = buildMenu(type, s);
    const cardio = (session && session.cardio) || {};
    const extras = EXTRAS.filter((x) => (s.extras || []).includes(x.id));
    const checks = store.day(date).checks || {};
    const done = !!(session && session.done);
    el.innerHTML = `
      <header class="page-top">${tape(`${type} — ${menu.title}`)}<span class="sub-meta">${di >= 0 && di <= TOTAL ? `DAY ${di}` : esc(label(date))}</span></header>
      <div class="gym-top">
        <p class="gym-rule">${light ? '<b>今日は軽め。</b>2セットまで。重さは前回のまま。追い込むな。睡眠が最優先だ。' : '2〜3セット × 8〜12回。<b>あと1〜2回できる</b>余力で止める。'}</p>
        <div class="seg small" aria-label="メニューの切り替え">
          <button data-type="A" class="${type === 'A' ? 'on' : ''}">A</button>
          <button data-type="B" class="${type === 'B' ? 'on' : ''}">B</button>
        </div>
      </div>
      ${!(s.machines || []).length ? '<p class="warn">店舗のマシンが未設定だ。今は自重種目で組んである。<a class="lnk" href="#/settings">設定で選べ。</a></p>' : ''}

      ${menu.list.map((ex, i) => exHtml(ex, i + 1, menu.list.length)).join('')}

      <section class="ex cardio" data-cardio>
        <div class="ex-h"><span class="ex-n">${String(menu.list.length + 1).padStart(2, '0')}</span><h2>${esc(menu.cardio.name)}</h2><span class="ex-p">有酸素</span></div>
        <p class="ex-cue">${esc(menu.cardio.note)}</p>
        <div class="set${cardio.done ? ' is-done' : ''}">
          <span class="set-n">—</span>
          <label class="set-f wide"><input data-cardio-min type="text" inputmode="numeric" autocomplete="off" value="${cardio.min ?? ''}" placeholder="15" aria-label="分"><i>分</i></label>
          <button class="set-ok" data-cardio-ok aria-label="有酸素を完了">${icon.check}</button>
        </div>
      </section>

      ${extras.length ? `
      <section class="sec">
        ${secHead('SELF CARE', '店舗の設備', '任意')}
        ${extras.map((x) => `
          <button class="chk${checks['x_' + x.id] ? ' is-done' : ''}" data-extra-check="x_${x.id}">
            <span class="chk-box">${icon.check}</span><span class="chk-label">${esc(x.name)}を使った</span><span class="chk-end"><span class="chk-tape">DONE</span></span>
          </button>`).join('')}
      </section>` : ''}

      ${bodyHtml()}
      ${logHtml()}

      <button class="btn ${done ? 'ghost' : 'red'} gym-done" data-finish>${done ? '完了済み（取り消す）' : '今日のジムを完了にする'}</button>
      <p class="foot-note">前回の自分に勝て。1回でいい。</p>
      ${restHtml()}
    `;
    document.body.dataset.sub = 'active';
    paintRest();
  }

  function paintRest() {
    const box = $('[data-rest]', el);
    if (!box) return;
    const l = restLeft();
    const running = l > 0;
    box.classList.toggle('run', running);
    $('[data-rest-clock]', el).classList.toggle('run', running);
    $('[data-rest-time]', el).textContent = mmss(running ? l : s.rest);
    $('[data-rest-state]', el).textContent = running ? 'RESTING' : `${s.rest} SEC`;
    $('[data-rest-go]', el).innerHTML = running ? `${icon.close}止める` : `${icon.play}休憩`;
  }

  function readRow(exId, rowEl) {
    const ex = EXERCISES[exId];
    const i = +rowEl.dataset.set;
    const list = rows(exId);
    const w = ex.bw ? null : num($('[data-w]', rowEl).value, { min: 0, max: 500 });
    const r = num($('[data-r]', rowEl).value, { min: 0, max: 999 });
    list[i] = { w, r: r == null ? null : Math.round(r), done: !!list[i].done };
    ensure().sets[exId] = list;
    return list[i];
  }

  el.addEventListener('input', (e) => {
    const t = e.target;
    if ('w' in t.dataset || 'r' in t.dataset) {
      const sec = t.closest('[data-ex]');
      readRow(sec.dataset.ex, t.closest('[data-set]'));
      save();
    } else if ('cardioMin' in t.dataset) {
      const v = num(t.value, { min: 0, max: 300 });
      ensure().cardio = { ...(session.cardio || {}), min: v == null ? null : Math.round(v) };
      save();
    } else if (t.dataset.rec) {
      const lim = t.dataset.rec === 'weight' ? { min: 30, max: 250 } : { min: 3, max: 60 };
      const v = num(t.value, lim);
      t.classList.toggle('bad', t.value.trim() !== '' && v == null);
      store.saveDay(date, { [t.dataset.rec]: v });
    }
  });

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;

    if ('force' in d) { forced = true; draw(); window.scrollTo(0, 0); return; }

    if (d.type) {
      if (d.type === type) return;
      type = d.type;
      if (session) { session.type = type; save(); }
      draw();
      return;
    }

    if ('ok' in d) {
      primeAudio();
      const sec = b.closest('[data-ex]');
      const rowEl = b.closest('[data-set]');
      const exId = sec.dataset.ex;
      const ex = EXERCISES[exId];
      let row = readRow(exId, rowEl);
      if (row.done) {
        row.done = false;
      } else {
        // 空のまま押したら、提案値（薄く見えている数字）をそのまま採用する
        const inW = $('[data-w]', rowEl);
        const inR = $('[data-r]', rowEl);
        if (row.r == null) {
          const ph = num(inR.placeholder);
          const prev = +rowEl.dataset.set > 0 ? rows(exId)[+rowEl.dataset.set - 1] : null;
          const r = ph != null ? ph : prev && prev.r;
          if (r == null) { toast('回数を入れろ。'); inR.focus(); return; }
          inR.value = r;
        }
        if (!ex.bw && row.w == null) {
          const ph = num(inW.placeholder);
          const prev = +rowEl.dataset.set > 0 ? rows(exId)[+rowEl.dataset.set - 1] : null;
          const w = ph != null ? ph : prev && prev.w;
          if (w == null) { toast('重さを入れろ。'); inW.focus(); return; }
          inW.value = fmtKg(w);
        }
        row = readRow(exId, rowEl);
        row.done = true;
        buzz(18);
        startRest(s.rest);
      }
      session.sets[exId][+rowEl.dataset.set] = row;
      save();
      rowEl.classList.toggle('is-done', row.done);
      paintRest();
      return;
    }

    if ('fill' in d) {
      const sec = b.closest('[data-ex]');
      const exId = sec.dataset.ex;
      const sug = suggest(exId, lastSets(exId, date), s);
      if (!sug.sets) return;
      const cur = rows(exId);
      ensure().sets[exId] = cur.map((x, i) => {
        const h = sug.sets[Math.min(i, sug.sets.length - 1)];
        return x.done ? x : { w: h.w, r: h.r, done: false };
      });
      save();
      draw();
      toast('入れた。違うところだけ直せ。');
      return;
    }

    if ('addset' in d) {
      const exId = b.closest('[data-ex]').dataset.ex;
      const cur = rows(exId);
      cur.push({ w: null, r: null, done: false });
      ensure().sets[exId] = cur;
      save();
      draw();
      return;
    }

    if ('cardioOk' in d) {
      const c = { ...(ensure().cardio || {}) };
      c.done = !c.done;
      if (c.done && c.min == null) c.min = 15;
      session.cardio = c;
      save();
      draw();
      if (c.done) buzz(18);
      return;
    }

    if (d.extraCheck) {
      const on = !(store.day(date).checks || {})[d.extraCheck];
      store.setCheck(date, d.extraCheck, on);
      b.classList.toggle('is-done', on);
      if (on) { b.classList.remove('slap'); void b.offsetWidth; b.classList.add('slap'); buzz(18); }
      return;
    }

    if (d.restSec) {
      s.rest = +d.restSec;
      store.saveSettings({ rest: s.rest });
      for (const x of $$('[data-rest-sec]', el)) x.classList.toggle('on', x === b);
      if (restLeft() > 0) startRest(s.rest);
      paintRest();
      return;
    }

    if ('restGo' in d) {
      primeAudio();
      if (restLeft() > 0) stopRest(); else startRest(s.rest);
      paintRest();
      return;
    }

    if ('finish' in d) {
      ensure();
      if (session.done) {
        session.done = false;
      } else {
        const n = Object.values(session.sets || {}).reduce((a, x) => a + x.filter((y) => y && y.done).length, 0);
        if (!n && !(session.cardio && session.cardio.done)) { toast('1セットも終わっていない。やってから押せ。'); return; }
        session.done = true;
        stopRest();
        buzz([30, 60, 30]);
        toast('完了。よくやった。帰って食って寝ろ。');
      }
      save();
      draw();
    }
  });

  draw();
  const iv = setInterval(paintRest, 200);
  return () => clearInterval(iv);
}
