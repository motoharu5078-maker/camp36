// 初回設定と設定画面で共通に使う入力フォーム。変更はその場で保存する。

import * as store from './store.js';
import { targets } from './calc.js';
import { ACTIVITY, MACHINES, EXTRAS } from './data.js';
import { WD } from './dates.js';
import { $, $$, esc, icon, num, buzz } from './ui.js';

const BODY = {
  height: { label: '身長', unit: 'cm', min: 120, max: 230 },
  weight: { label: '体重', unit: 'kg', min: 30, max: 250 },
  age: { label: '年齢', unit: '歳', min: 15, max: 99 },
};

export function bodyForm(s) {
  const f = (id) => `
    <label class="field">
      <span class="field-l">${BODY[id].label}</span>
      <span class="field-in"><input data-body="${id}" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" placeholder="—" value="${s[id] ?? ''}"><i>${BODY[id].unit}</i></span>
    </label>`;
  return `
    <div class="grid3">${f('height')}${f('weight')}${f('age')}</div>
    <p class="form-l">普段の活動量</p>
    <div class="acts">
      ${ACTIVITY.map((a) => `
        <button class="act${s.activity === a.v ? ' on' : ''}" data-act="${a.v}" aria-pressed="${s.activity === a.v}">
          <b>${esc(a.label)}</b><small>${esc(a.sub)}</small>
        </button>`).join('')}
    </div>`;
}

export function targetsHtml(s) {
  const t = targets(s);
  if (!t) return `<p class="muted">身長・体重・年齢を入れると、目標が出る。</p>`;
  const adj = [];
  if (s.adjKcal) adj.push(`週次レビューの調整 ${s.adjKcal > 0 ? '+' : ''}${s.adjKcal}kcal を反映済み`);
  if (s.adjSteps) adj.push(`歩数目標 +${s.adjSteps.toLocaleString('en-US')}歩 を反映済み`);
  return `
    <dl class="nums">
      <div><dt>基礎代謝<small>BMR</small></dt><dd>${t.bmr.toLocaleString('en-US')}<i>kcal</i></dd></div>
      <div><dt>1日の消費<small>TDEE</small></dt><dd>${t.tdee.toLocaleString('en-US')}<i>kcal</i></dd></div>
      <div class="main"><dt>摂取目標<small>消費 −400</small></dt><dd>${t.intake.toLocaleString('en-US')}<i>kcal</i></dd></div>
      <div><dt>タンパク質<small>体重×2.0g</small></dt><dd>${t.protein}<i>g</i></dd></div>
      <div><dt>水分<small>体重×35ml</small></dt><dd>${(t.water / 1000).toFixed(1)}<i>L</i></dd></div>
      <div><dt>減量ペース<small>週に体重の0.5〜1.0%</small></dt><dd>${t.paceLo}〜${t.paceHi}<i>kg/週</i></dd></div>
    </dl>
    <p class="muted">36日で約 ${t.totalLo}〜${t.totalHi}kg が現実的な範囲。それ以上は狙わない。${t.atFloor ? '摂取目標は基礎代謝を下回らない値で止めてある。' : ''}${adj.length ? '<br>' + esc(adj.join('／')) + '。' : ''}</p>`;
}

export function gymForm(s) {
  const mset = new Set(s.machines || []);
  const eset = new Set(s.extras || []);
  const days = new Set(s.gymDays || []);
  const order = [1, 2, 3, 4, 5, 6, 0]; // 月〜日
  return `
    <p class="form-l">自分の店舗にあるマシン<button class="mini" data-machine-all>${mset.size === MACHINES.length ? '全部外す' : '全部ある'}</button></p>
    <div class="picks">
      ${MACHINES.map((m) => `<button class="pick${mset.has(m.id) ? ' on' : ''}" data-machine="${m.id}" aria-pressed="${mset.has(m.id)}"><span class="pick-box">${icon.check}</span><span>${esc(m.name)}</span></button>`).join('')}
    </div>
    <p class="form-l">セルフ設備</p>
    <div class="picks">
      ${EXTRAS.map((m) => `<button class="pick${eset.has(m.id) ? ' on' : ''}" data-extra="${m.id}" aria-pressed="${eset.has(m.id)}"><span class="pick-box">${icon.check}</span><span>${esc(m.name)}</span></button>`).join('')}
    </div>
    <p class="form-l">ジムに行く曜日<span class="form-r" data-wd-count>週${days.size}回</span></p>
    <div class="wds">
      ${order.map((d) => `<button class="wd${days.has(d) ? ' on' : ''}" data-wd="${d}" aria-pressed="${days.has(d)}">${WD[d]}</button>`).join('')}
    </div>
    <p class="muted">A日（上半身＋腹）とB日（下半身＋腹）を交互に回す。ないマシンは自重種目に置き換える。</p>`;
}

export function rulesForm(s) {
  return `
    <ul class="rules">
      ${(s.rules || []).map((r) => `<li><span>${esc(r.text)}</span><button class="icon-btn" data-rule-del="${esc(r.id)}" aria-label="削除">${icon.close}</button></li>`).join('') || '<li class="empty">まだ何もない。</li>'}
    </ul>
    <div class="adder">
      <input data-rule-new type="text" maxlength="40" placeholder="例：夜のラーメン" enterkeyhint="done" autocomplete="off">
      <button class="btn small" data-rule-add>足す</button>
    </div>`;
}

export function whyForm(s) {
  return `<textarea class="ta" data-why rows="4" maxlength="200" placeholder="誰に、どう見られたいか。なぜその日なのか。自分の言葉で一文。">${esc(s.why || '')}</textarea>`;
}

/**
 * フォームの操作を保存につなぐ。
 * onChange(what) は保存のたびに呼ばれる（what: 'body' | 'gym' | 'rules' | 'why'）
 */
export function bind(root, onChange = () => {}) {
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.body) {
      const id = t.dataset.body;
      const v = num(t.value, BODY[id]);
      t.classList.toggle('bad', t.value.trim() !== '' && v == null);
      store.saveSettings({ [id]: v });
      onChange('body');
    } else if ('why' in t.dataset) {
      store.saveSettings({ why: t.value });
      onChange('why');
    }
  });

  const addRule = () => {
    const input = $('[data-rule-new]', root);
    const text = (input.value || '').trim();
    if (!text) return;
    const s = store.settings();
    store.saveSettings({ rules: [...(s.rules || []), { id: 'r' + Date.now().toString(36), text }] });
    onChange('rules');
  };
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && 'ruleNew' in e.target.dataset) { e.preventDefault(); addRule(); }
    else if (e.key === 'Enter' && e.target.dataset.body) e.target.blur();
  });

  root.addEventListener('click', (e) => {
    const s = store.settings();
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act) {
      store.saveSettings({ activity: +b.dataset.act });
      for (const x of $$('[data-act]', root)) { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }
      buzz(8);
      onChange('body');
    } else if (b.dataset.machine || b.dataset.extra) {
      const key = b.dataset.machine ? 'machines' : 'extras';
      const id = b.dataset.machine || b.dataset.extra;
      const set = new Set(s[key] || []);
      if (set.has(id)) set.delete(id); else set.add(id);
      store.saveSettings({ [key]: [...set] });
      b.classList.toggle('on', set.has(id));
      b.setAttribute('aria-pressed', set.has(id));
      const all = $('[data-machine-all]', root);
      if (all && key === 'machines') all.textContent = set.size === MACHINES.length ? '全部外す' : '全部ある';
      buzz(8);
      onChange('gym');
    } else if ('machineAll' in b.dataset) {
      const full = (s.machines || []).length === MACHINES.length;
      store.saveSettings({ machines: full ? [] : MACHINES.map((m) => m.id) });
      for (const x of $$('[data-machine]', root)) { x.classList.toggle('on', !full); x.setAttribute('aria-pressed', !full); }
      b.textContent = full ? '全部ある' : '全部外す';
      onChange('gym');
    } else if (b.dataset.wd) {
      const d = +b.dataset.wd;
      const set = new Set(s.gymDays || []);
      if (set.has(d)) set.delete(d); else set.add(d);
      store.saveSettings({ gymDays: [...set] });
      b.classList.toggle('on', set.has(d));
      b.setAttribute('aria-pressed', set.has(d));
      const c = $('[data-wd-count]', root);
      if (c) c.textContent = `週${set.size}回`;
      buzz(8);
      onChange('gym');
    } else if ('ruleAdd' in b.dataset) {
      addRule();
    } else if (b.dataset.ruleDel) {
      store.saveSettings({ rules: (s.rules || []).filter((r) => r.id !== b.dataset.ruleDel) });
      onChange('rules');
    }
  });
}

export const bodyOk = (s) => !!(s.height && s.weight && s.age);
