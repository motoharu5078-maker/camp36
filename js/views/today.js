// TODAY：カウントダウン、今日のチェックリスト、数値記録、スコア。

import * as store from '../store.js';
import { today, dayIndex, addDays, label, jstHour, debugDate, TOTAL } from '../dates.js';
import { phaseOf, checklist, isDone, score, streak, videoStreak, bloatRisk, tasksFor, PASS } from '../calc.js';
import { $, $$, esc, icon, tape, secHead, buzz, toast, num } from '../ui.js';

const FIELDS = {
  weight: { label: '体重', unit: 'kg', min: 30, max: 250, mode: 'decimal' },
  fat: { label: '体脂肪率', unit: '%', min: 3, max: 60, mode: 'decimal', opt: true },
  sleep: { label: '睡眠', unit: '時間', min: 0, max: 24, mode: 'decimal' },
  steps: { label: '歩数', unit: '歩', min: 0, max: 99999, mode: 'numeric' },
};

function hero(di, date, phase) {
  let big, sub;
  if (di < 0) {
    big = `<span class="lbl">DAY</span> <span class="n">−${-di}</span>`;
    sub = `<span class="of">PRE-CAMP</span><span class="left"><em>開始まで</em><b>${-di}</b>日</span>`;
  } else if (di > TOTAL) {
    big = `<span class="lbl">DAY</span> <span class="n">${TOTAL}</span>`;
    sub = `<span class="of">/ ${TOTAL} 完走</span><span class="left"><em>計量から</em><b>${di - TOTAL}</b>日</span>`;
  } else if (di === TOTAL) {
    big = `<span class="lbl">DAY</span> <span class="n">${TOTAL}</span>`;
    sub = `<span class="of">/ ${TOTAL}</span><span class="left now"><b>WEIGH-IN</b></span>`;
  } else {
    big = `<span class="lbl">DAY</span> <span class="n">${di}</span>`;
    sub = `<span class="of">/ ${TOTAL}</span><span class="left"><em>計量まで</em><b>${TOTAL - di}</b>日</span>`;
  }
  const code = phase ? `${phase.code} — ${phase.name}` : 'PRE-CAMP — 準備';
  const theme = phase ? phase.theme : '11/17 が DAY 0';
  const quote = phase ? phase.quote : '始まる前に、設定だけ終わらせておけ。';
  return `
  <header class="hero">
    <div class="hero-top">
      ${tape(code)}
      <a class="icon-btn" href="#/settings" aria-label="設定">${icon.tune}</a>
    </div>
    <h1 class="hero-day">${big}</h1>
    <div class="hero-sub">${sub}</div>
    <p class="hero-date"><span>${esc(label(date))}</span><span>${esc(theme)}</span>${debugDate() ? '<span class="dbg">DEBUG DATE</span>' : ''}</p>
    <p class="hero-quote">${esc(quote)}</p>
  </header>`;
}

function why(s) {
  if (s.why && s.why.trim()) {
    return `<section class="why"><span class="why-l">WHY 12.23</span><p>${esc(s.why).replace(/\n/g, '<br>')}</p></section>`;
  }
  return `<section class="why"><span class="why-l">WHY 12.23</span><p><a href="#/settings" class="lnk">なぜ12/23なのか。まだ書いていない。書け。</a></p></section>`;
}

function row(it, done) {
  const right = it.type === 'link' ? `<span class="chk-go">${icon.arrow}</span>` : '';
  return `
  <button class="chk${done ? ' is-done' : ''}" data-check="${it.id}" aria-pressed="${done}">
    <span class="chk-box">${icon.check}</span>
    <span class="chk-label">${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>
    <span class="chk-end"><span class="chk-tape">DONE</span>${right}</span>
  </button>`;
}

function field(id, rec) {
  const f = FIELDS[id];
  const v = rec[id] != null ? rec[id] : '';
  return `
  <label class="field">
    <span class="field-l">${f.label}${f.opt ? '<small>任意</small>' : ''}</span>
    <span class="field-in"><input id="rec-${id}" data-rec="${id}" type="text" inputmode="${f.mode}" autocomplete="off" enterkeyhint="done" placeholder="—" value="${esc(v)}"><i>${f.unit}</i></span>
  </label>`;
}

function rating(id, lab, hint, rec) {
  const btns = [1, 2, 3, 4, 5].map((n) => `<button data-rate="${id}" data-v="${n}" class="${rec[id] === n ? 'on' : ''}" aria-label="${lab} ${n}">${n}</button>`).join('');
  return `<div class="rate"><span class="lab">${lab}<small>${hint}</small></span><div class="btns">${btns}</div></div>`;
}

function forecast(di, date) {
  if (di < 0 || di >= TOTAL) return '';
  const hour = jstHour();
  if (hour >= 18) {
    const r = bloatRisk(store.day(date));
    const advice = r.level === '高' ? '今から水を1杯。明日の朝は首ストレッチを長めに。'
      : r.level === '中' ? '水を1杯飲んで、早く寝ろ。' : 'このまま寝ろ。';
    return `
    <div class="fc lv-${r.n >= 2 ? 'hi' : r.n === 1 ? 'mid' : 'lo'}">
      <span class="fc-l">むくみ予報<small>明日の朝</small></span>
      <span class="fc-v">${r.level}</span>
      <span class="fc-t">${r.factors.length ? esc(r.factors.join('・')) + '。' : '引っかかる行動なし。'}${advice}</span>
    </div>`;
  }
  if (di < 1) return '';
  const prev = store.day(addDays(date, -1));
  if (!Object.keys(prev).length) return '';
  const r = bloatRisk(prev);
  const cur = store.day(date).bloat;
  return `
  <div class="fc lv-${r.n >= 2 ? 'hi' : r.n === 1 ? 'mid' : 'lo'}">
    <span class="fc-l">むくみ予報<small>昨夜の時点</small></span>
    <span class="fc-v">${r.level}</span>
    <span class="fc-t">${r.factors.length ? esc(r.factors.join('・')) + '。' : '引っかかる行動なし。'}${cur != null ? `今朝の実感は ${cur}/5。` : '今朝のむくみを下で付けて、答え合わせしろ。'}</span>
  </div>`;
}

function notices(di, s) {
  const out = [];
  if (di >= TOTAL) {
    out.push(`<a class="notice hot" href="#/final"><span class="en">WEIGH-IN RESULT</span><span>36日のまとめを見る</span>${icon.arrow}</a>`);
    const l = store.letter();
    if (l) out.push(`<a class="notice hot" href="#/letter"><span class="en">LETTER</span><span>${l.opened ? 'DAY 0 の自分からの手紙' : '手紙を開封する'}</span>${icon.arrow}</a>`);
  } else if (di >= 7 && di % 7 === 0) {
    out.push(`<a class="notice" href="#/roadmap"><span class="en">WEEKLY REVIEW</span><span>今夜は週次レビュー（W${di / 7}）</span>${icon.arrow}</a>`);
  }
  if (di >= 22 && di < TOTAL) {
    out.push(`<p class="notice plain"><span class="en">NO NEW SKINCARE</span><span>新しい化粧品・強い成分は始めない。</span></p>`);
  }
  return out.join('');
}

export default function render(el) {
  const date = today();
  const di = dayIndex(date);
  const s = store.settings();
  const phase = phaseOf(di);
  const groups = checklist(date, s);
  const items = new Map(groups.flatMap((g) => g.items).map((it) => [it.id, it]));
  const rec = store.day(date);
  const showRules = di >= 1 && di !== TOTAL && (s.rules || []).length > 0;
  const weekTasks = phase ? tasksFor(phase.id, s) : [];
  const doneTasks = store.tasks();

  const groupsHtml = groups.map((g) => {
    const n = g.items.filter((it) => isDone(it.id, date, s, rec)).length;
    return `
    <section class="sec" data-group="${g.id}">
      ${secHead(g.en, g.jp, `<span data-count="${g.id}">${n}/${g.items.length}</span>`)}
      ${g.items.map((it) => row(it, isDone(it.id, date, s, rec))).join('')}
    </section>`;
  }).join('');

  const rulesHtml = !showRules ? '' : `
    <section class="sec">
      ${secHead('MY RULES', '自分ルール', 'タップで記録')}
      ${s.rules.map((r) => {
        const st = (rec.rules || {})[r.id] || '';
        return `
        <button class="chk rule${st === 'kept' ? ' is-done' : ''}${st === 'broken' ? ' is-broken' : ''}" data-rule="${esc(r.id)}">
          <span class="chk-box">${st === 'broken' ? icon.close : icon.check}</span>
          <span class="chk-label">${esc(r.text)}<small data-rule-state>${st === 'kept' ? '守れた' : st === 'broken' ? '破った。明日は守れ。' : '守れたか？'}</small></span>
          <span class="chk-end"><span class="chk-tape">KEPT</span></span>
        </button>`;
      }).join('')}
    </section>`;

  const tasksHtml = !weekTasks.length ? '' : `
    <section class="sec">
      ${secHead('THIS ROUND', 'この期間に片付ける')}
      ${weekTasks.map((t) => `
        <button class="chk${doneTasks[t.id] ? ' is-done' : ''}" data-task="${t.id}">
          <span class="chk-box">${icon.check}</span>
          <span class="chk-label">${esc(t.label)}</span>
          <span class="chk-end"><span class="chk-tape">DONE</span></span>
        </button>`).join('')}
    </section>`;

  const recordHtml = di < 0 ? '' : `
    <section class="sec" id="record">
      ${secHead('RECORD', '今日の数値', '10秒で終わらせろ')}
      <div class="grid2">
        ${field('weight', rec)}${field('fat', rec)}${field('sleep', rec)}${field('steps', rec)}
      </div>
      ${rating('bloat', 'むくみ', '1 なし → 5 強い', rec)}
      ${rating('skin', '肌', '1 荒れ → 5 良い', rec)}
      <div class="flags">
        <button class="flag${rec.salt ? ' on' : ''}" data-flag="salt" aria-pressed="${!!rec.salt}">塩分多めの食事</button>
        <button class="flag${rec.alcohol ? ' on' : ''}" data-flag="alcohol" aria-pressed="${!!rec.alcohol}">お酒を飲んだ</button>
        <button class="flag${rec.late ? ' on' : ''}" data-flag="late" aria-pressed="${!!rec.late}">23時以降に食べた</button>
      </div>
    </section>`;

  const scoreHtml = di < 0 ? `
    <section class="pre">
      <p>キャンプは 11/18 から。11/17 が DAY 0（初回計測日）だ。設定は済んだ。あとは当日を待て。</p>
      <a class="btn" href="#/roadmap">36日の全体図を見る</a>
    </section>` : `
    <section class="score" aria-label="今日のスコア">
      <div class="score-n"><b data-sc>0</b><span>/100</span></div>
      <div class="score-m">
        <div class="bar"><i data-sc-bar></i><u style="left:${PASS}%"></u></div>
        <div class="score-row">
          <span>CHECK <b data-sc-done>0/0</b></span>
          <span>STREAK <b data-sc-streak>0</b>日</span>
          <span>顔トレ <b data-sc-video>0</b>日</span>
        </div>
      </div>
    </section>`;

  el.innerHTML = `
    ${hero(di, date, phase)}
    ${why(s)}
    ${notices(di, s)}
    <div data-fc>${forecast(di, date)}</div>
    ${scoreHtml}
    ${groupsHtml}
    ${rulesHtml}
    ${recordHtml}
    ${tasksHtml}
    <p class="foot-note">記録しろ。感覚は嘘をつく。</p>
  `;

  function refresh() {
    const r = store.day(date);
    for (const b of $$('[data-check]', el)) {
      const done = isDone(b.dataset.check, date, s, r);
      b.classList.toggle('is-done', done);
      b.setAttribute('aria-pressed', done);
    }
    for (const g of groups) {
      const c = $(`[data-count="${g.id}"]`, el);
      if (c) c.textContent = `${g.items.filter((it) => isDone(it.id, date, s, r)).length}/${g.items.length}`;
    }
    if (di >= 0) {
      const sc = score(date, s);
      $('[data-sc]', el).textContent = sc.score;
      $('[data-sc-bar]', el).style.width = sc.score + '%';
      $('[data-sc-done]', el).textContent = `${sc.done}/${sc.total}`;
      $('[data-sc-streak]', el).textContent = streak(date, s);
      $('[data-sc-video]', el).textContent = videoStreak(date);
      $('.score', el).classList.toggle('pass', sc.score >= PASS);
    }
    $('[data-fc]', el).innerHTML = forecast(di, date);
  }

  function slap(b) {
    b.classList.remove('slap');
    void b.offsetWidth;
    b.classList.add('slap');
    buzz(18);
  }

  el.addEventListener('click', (e) => {
    const chk = e.target.closest('[data-check]');
    if (chk) {
      const it = items.get(chk.dataset.check);
      if (!it) return;
      if (it.type === 'link') { location.hash = it.link; return; }
      if (it.type === 'focus') {
        const input = $('#rec-weight', el);
        input.scrollIntoView({ block: 'center', behavior: 'smooth' });
        input.focus({ preventScroll: true });
        return;
      }
      if (it.type === 'auto') return;
      const was = isDone(it.id, date, s);
      const manual = !!(store.day(date).checks || {})[it.id];
      if (was && !manual) { toast('記録の数値で達成済み。'); return; }
      store.setCheck(date, it.id, !was);
      refresh();
      if (!was) slap(chk);
      return;
    }

    const rule = e.target.closest('[data-rule]');
    if (rule) {
      const id = rule.dataset.rule;
      const rules = { ...(store.day(date).rules || {}) };
      const next = rules[id] === 'kept' ? 'broken' : rules[id] === 'broken' ? '' : 'kept';
      if (next) rules[id] = next; else delete rules[id];
      store.saveDay(date, { rules });
      rule.classList.toggle('is-done', next === 'kept');
      rule.classList.toggle('is-broken', next === 'broken');
      $('.chk-box', rule).innerHTML = next === 'broken' ? icon.close : icon.check;
      $('[data-rule-state]', rule).textContent = next === 'kept' ? '守れた' : next === 'broken' ? '破った。明日は守れ。' : '守れたか？';
      refresh();
      if (next === 'kept') slap(rule);
      return;
    }

    const task = e.target.closest('[data-task]');
    if (task) {
      const on = !store.tasks()[task.dataset.task];
      store.setTask(task.dataset.task, on);
      task.classList.toggle('is-done', on);
      if (on) slap(task);
      return;
    }

    const rate = e.target.closest('[data-rate]');
    if (rate) {
      const id = rate.dataset.rate;
      const v = +rate.dataset.v;
      const cur = store.day(date)[id];
      store.saveDay(date, { [id]: cur === v ? null : v });
      for (const b of $$(`[data-rate="${id}"]`, el)) b.classList.toggle('on', cur !== v && +b.dataset.v === v);
      buzz(8);
      refresh();
      return;
    }

    const flag = e.target.closest('[data-flag]');
    if (flag) {
      const id = flag.dataset.flag;
      const on = !store.day(date)[id];
      store.saveDay(date, { [id]: on ? true : null });
      flag.classList.toggle('on', on);
      flag.setAttribute('aria-pressed', on);
      buzz(8);
      refresh();
    }
  });

  el.addEventListener('input', (e) => {
    const id = e.target.dataset.rec;
    if (!id) return;
    const f = FIELDS[id];
    const v = num(e.target.value, f);
    e.target.classList.toggle('bad', e.target.value.trim() !== '' && v == null);
    store.saveDay(date, { [id]: v == null ? null : (id === 'steps' ? Math.round(v) : v) });
    refresh();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset.rec) e.target.blur();
  });

  refresh();
}
