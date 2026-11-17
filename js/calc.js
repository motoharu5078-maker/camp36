// 計算ロジック：目標値、フェーズ、チェックリスト、スコア、ストリーク、むくみ予報、週次レビュー、ジムの提案。

import * as store from './store.js';
import { dayIndex, dateOfDay, addDays, weekday, TOTAL } from './dates.js';
import { PHASES, AFTER, TASKS, MENU, EXERCISES, SUBSTITUTE } from './data.js';

// --- 目標値（Mifflin-St Jeor） --------------------------------------------

export function targets(s = store.settings()) {
  const { height: h, weight: w, age: a } = s;
  if (!h || !w || !a) return null;
  const bmr = 10 * w + 6.25 * h - 5 * a + 5;            // 男性の式
  const tdee = bmr * (s.activity || 1.375);
  const wanted = tdee - 400 + (s.adjKcal || 0);
  const intake = Math.max(bmr, wanted);                  // 基礎代謝は下回らない
  const weeks = TOTAL / 7;
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    intake: Math.round(intake / 10) * 10,
    atFloor: wanted <= bmr,                              // これ以上は減らせない
    protein: Math.round(w * 2.0),
    water: Math.round((w * 35) / 50) * 50,               // ml
    paceLo: +(w * 0.005).toFixed(1),
    paceHi: +(w * 0.01).toFixed(1),
    totalLo: +(w * 0.005 * weeks).toFixed(1),
    totalHi: +(w * 0.01 * weeks).toFixed(1),
  };
}

// --- フェーズ ---------------------------------------------------------------

export function phaseOf(di) {
  if (di < 0) return null;
  if (di > TOTAL) return AFTER;
  return PHASES.find((p) => di >= p.from && di <= p.to);
}

export function stepsTarget(di, s = store.settings()) {
  const p = phaseOf(di);
  if (!p || !p.steps) return null;
  return p.steps + (s.adjSteps || 0);
}

export function tasksFor(phaseId, s = store.settings()) {
  return TASKS.filter((t) => t.phase === phaseId && (!t.needs || (s.extras || []).includes(t.needs)));
}

// --- ジムの日とメニュー -----------------------------------------------------

export function isGymDay(date, s = store.settings()) {
  const di = dayIndex(date);
  if (di < 1 || di === TOTAL) return false;             // DAY 0 と計量日はジムなし
  return (s.gymDays || []).includes(weekday(date));
}

/** A/B は「予定されたジムの日」を DAY 1 から数えて交互。記録があればそちらを優先。 */
export function gymType(date, s = store.settings()) {
  const saved = store.gym(date);
  if (saved && saved.type) return saved.type;
  const di = dayIndex(date);
  let n = 0;
  for (let i = 1; i <= di; i++) if (isGymDay(dateOfDay(i), s)) n++;
  if (!isGymDay(date, s)) n++;                           // オフの日に自主的にやる場合は「次の番」
  return n % 2 === 1 ? 'A' : 'B';
}

export function nextGymDay(date, s = store.settings()) {
  for (let i = 1; i <= 14; i++) {
    const d = addDays(date, i);
    if (isGymDay(d, s)) return d;
  }
  return null;
}

/** 店舗にあるマシンだけでメニューを組む。ないものは自重種目に置き換える（重複は1つにまとめる）。 */
export function buildMenu(type, s = store.settings()) {
  const has = (id) => (s.machines || []).includes(id);
  const menu = MENU[type];
  const list = [];
  const seen = new Set();
  for (const id of menu.main) {
    const use = has(id) ? id : SUBSTITUTE[id];
    if (!use || seen.has(use)) continue;
    seen.add(use);
    list.push({ id: use, ...EXERCISES[use], swapped: use !== id });
  }
  for (const id of menu.optional) {
    if (has(id) && !seen.has(id)) list.push({ id, ...EXERCISES[id], optional: true });
  }
  let cardio;
  if (has('treadmill')) cardio = { id: 'treadmill', name: 'トレッドミル 傾斜歩き', note: '15〜20分。傾斜をつけて、会話できる強度。走らなくていい。' };
  else if (has('bike')) cardio = { id: 'bike', name: 'クロスバイク', note: '15〜20分。会話できる強度でこぎ続ける。' };
  else cardio = { id: 'walk', name: '早歩き（外）', note: '15〜20分。帰り道を遠回りしろ。会話できる強度。' };
  return { type, title: menu.title, list, cardio };
}

/** その種目の、指定日より前の直近の記録 */
export function lastSets(exId, before) {
  const dates = store.gymDates().filter((d) => d < before).reverse();
  for (const d of dates) {
    const g = store.gym(d);
    const sets = ((g && g.sets && g.sets[exId]) || []).filter((x) => x && x.r > 0);
    if (sets.length) return { date: d, sets };
  }
  return null;
}

/** 漸進的過負荷の提案。全セット12回できた → 重さを1段上げる／そうでなければ回数を1回増やす。 */
export function suggest(exId, last, s = store.settings()) {
  const ex = EXERCISES[exId];
  if (!last) {
    return { text: ex.bw ? '初回。フォームを崩さずできる回数から。' : '初回。8〜12回できる重さを探せ。', sets: null };
  }
  const sets = last.sets;
  if (ex.bw) {
    const inc = ex.unit === '秒' ? 5 : 1;
    return {
      text: `前回より +${inc}${ex.unit}。`,
      sets: sets.map((x) => ({ w: null, r: x.r + inc })),
    };
  }
  const all12 = sets.every((x) => x.r >= 12);
  if (all12) {
    const w = Math.max(...sets.map((x) => x.w || 0)) + (s.step || 5);
    return { text: `全セット12回クリア。次は ${fmtKg(w)}kg（1段上げ）で8回から。`, sets: sets.map(() => ({ w, r: 8 })) };
  }
  return {
    text: '同じ重さで、各セット +1回。',
    sets: sets.map((x) => ({ w: x.w, r: Math.min(12, x.r + 1) })),
  };
}

export const fmtKg = (n) => (n == null ? '' : String(+(+n).toFixed(1)));

// --- チェックリスト ---------------------------------------------------------

export function checklist(date, s = store.settings()) {
  const di = dayIndex(date);
  const t = targets(s);
  if (di < 0) return [];

  if (di === 0) {
    return [{
      id: 'start', en: 'DAY 0', jp: 'スタート地点を刻む',
      items: [
        { id: 'setup', label: '初回設定を終える', type: 'auto' },
        { id: 'weigh', label: '体重・体脂肪を記録する', type: 'focus' },
        { id: 'photo', label: '顔写真を撮る（正面＋横顔）', type: 'link', link: '#/face' },
        { id: 'why', label: '「なぜ12/23か」を書く', type: 'link', link: '#/settings' },
        { id: 'letter', label: '未来の自分へ手紙を書いて封をする', type: 'link', link: '#/letter' },
      ],
    }];
  }

  if (di === TOTAL) {
    return [
      {
        id: 'final-am', en: 'MORNING ROUTINE', jp: '計量日の朝',
        items: [
          { id: 'water_am', label: '起きたら水を飲む', type: 'toggle' },
          { id: 'stretch', label: '首・肩ストレッチ', type: 'toggle' },
          { id: 'video', label: '鬼の顔痩せ動画（7分）', type: 'link', link: '#/video' },
          { id: 'skin_am', label: '冷たい水で洗顔 → しっかり保湿', type: 'toggle' },
          { id: 'hair', label: '髪のセット', type: 'toggle' },
        ],
      },
      {
        id: 'final-weigh', en: 'WEIGH-IN', jp: '計量',
        items: [
          { id: 'weigh', label: '最終計量（体重）', type: 'focus' },
          { id: 'photo', label: '最終の顔写真（正面＋横顔）', type: 'link', link: '#/face' },
        ],
      },
    ];
  }

  const steps = stepsTarget(di, s);
  const groups = [];
  groups.push({
    id: 'am', en: 'MORNING', jp: '朝',
    items: [
      { id: 'weigh', label: '体重測定', sub: '起床・トイレ後', type: 'focus' },
      { id: 'photo', label: '顔写真を撮る', sub: '正面＋横顔（左）', type: 'link', link: '#/face' },
      { id: 'skin_am', label: '洗顔 → 保湿 → 日焼け止め', type: 'toggle' },
      { id: 'water_am', label: '水を500ml', type: 'toggle' },
    ],
  });
  groups.push({
    id: 'day', en: 'DAYTIME', jp: '日中',
    items: [
      { id: 'steps', label: `歩数 ${steps.toLocaleString('en-US')}歩`, sub: '歩数を記録すると自動で付く', type: 'toggle' },
      { id: 'protein', label: `タンパク質 ${t ? t.protein : '—'}g`, sub: '毎食、手のひら1枚分', type: 'toggle' },
      { id: 'water', label: `水分 ${t ? (t.water / 1000).toFixed(1) : '—'}L`, type: 'toggle' },
    ],
  });
  if (isGymDay(date, s)) {
    const type = gymType(date, s);
    const light = di === TOTAL - 1;
    groups.push({
      id: 'gym', en: 'GYM', jp: 'chocoZAP',
      items: [
        { id: 'gym', label: `${type}日：${MENU[type].title}`, sub: light ? '今日は軽め。2セットまで。追い込むな。' : '今日のメニューを開く', type: 'link', link: '#/gym' },
      ],
    });
  }
  const night = [
    { id: 'video', label: '鬼の顔痩せ動画（7分）', type: 'link', link: '#/video' },
    { id: 'skin_pm', label: '洗顔 → 保湿', type: 'toggle' },
    { id: 'stretch', label: '首・肩ストレッチ', type: 'toggle' },
    { id: 'phone_off', label: '寝る1時間前にスマホを置く', type: 'toggle' },
  ];
  groups.push({ id: 'pm', en: 'NIGHT', jp: '夜', items: night });

  // 12/21（DAY 34）から本番前のルール
  if (di >= TOTAL - 2 && di < TOTAL) {
    const items = [
      { id: 'no_alcohol', label: 'お酒なし', type: 'toggle' },
      { id: 'low_salt', label: '塩分控えめ', type: 'toggle' },
      { id: 'no_late', label: '23時以降は食べない', type: 'toggle' },
    ];
    if (di === TOTAL - 1) items.push({ id: 'sleep_first', label: '睡眠最優先。早く布団に入る', type: 'toggle' });
    groups.push({ id: 'pre', en: 'FINAL RULES', jp: '本番前の決まり', items });
  }
  return groups;
}

export function isDone(id, date, s = store.settings(), rec = store.day(date)) {
  const c = rec.checks || {};
  switch (id) {
    case 'setup': return !!s.setupDone;
    case 'why': return !!(s.why && s.why.trim());
    case 'letter': return !!store.letter();
    case 'weigh': return rec.weight != null;
    case 'photo': return !!(rec.photos && rec.photos.front && rec.photos.side);
    case 'steps': {
      const t = stepsTarget(dayIndex(date), s);
      return !!c.steps || (rec.steps != null && t != null && rec.steps >= t);
    }
    case 'gym': { const g = store.gym(date); return !!(g && g.done); }
    default: return !!c[id];
  }
}

// --- スコア・ストリーク -----------------------------------------------------

export const RECORD_FIELDS = ['weight', 'sleep', 'steps', 'bloat', 'skin'];
export const PASS = 70; // この点数以上で「達成」

export function score(date, s = store.settings()) {
  const rec = store.day(date);
  const items = checklist(date, s).flatMap((g) => g.items);
  if (!items.length) return { score: 0, done: 0, total: 0, rec: 0 };
  let done = items.filter((it) => isDone(it.id, date, s, rec)).length;
  let total = items.length;
  // 自分ルールは「守れた」を1項目として数える（DAY 1 以降）
  const di = dayIndex(date);
  if (di >= 1 && di !== TOTAL) {
    for (const r of s.rules || []) {
      total++;
      if (rec.rules && rec.rules[r.id] === 'kept') done++;
    }
  }
  const recN = RECORD_FIELDS.filter((f) => rec[f] != null).length;
  const sc = Math.round(80 * (done / total) + 20 * (recN / RECORD_FIELDS.length));
  return { score: sc, done, total, rec: recN };
}

function runBack(date, ok) {
  let d = date, n = 0;
  if (!ok(d)) d = addDays(d, -1);            // 今日がまだなら昨日から数える
  while (dayIndex(d) >= 0 && ok(d)) { n++; d = addDays(d, -1); }
  return n;
}

export const streak = (date, s = store.settings()) => runBack(date, (d) => score(d, s).score >= PASS);
export const videoStreak = (date) => runBack(date, (d) => !!(store.day(d).checks || {}).video);

export function longestStreak(upto, s = store.settings()) {
  let best = 0, cur = 0;
  const last = Math.min(dayIndex(upto), TOTAL);
  for (let i = 0; i <= last; i++) {
    if (score(dateOfDay(i), s).score >= PASS) { cur++; best = Math.max(best, cur); } else cur = 0;
  }
  return best;
}

export function averageScore(fromDi, toDi, s = store.settings()) {
  let sum = 0, n = 0;
  for (let i = fromDi; i <= toDi; i++) { sum += score(dateOfDay(i), s).score; n++; }
  return n ? Math.round(sum / n) : 0;
}

// --- むくみ予報 -------------------------------------------------------------

export const BLOAT_FACTORS = [
  { id: 'salt', label: '塩分多め', test: (r) => !!r.salt },
  { id: 'alcohol', label: 'お酒', test: (r) => !!r.alcohol },
  { id: 'late', label: '23時以降の食事', test: (r) => !!r.late },
  { id: 'short', label: '睡眠6時間未満', test: (r) => r.sleep != null && r.sleep < 6 },
];

/** その日の記録から「翌朝のむくみリスク」を出す */
export function bloatRisk(rec) {
  const hit = BLOAT_FACTORS.filter((f) => f.test(rec));
  const level = hit.length >= 2 ? '高' : hit.length === 1 ? '中' : '低';
  return { level, n: hit.length, factors: hit.map((f) => f.label) };
}

/** 行動ごとに「やった翌朝」と「やらなかった翌朝」のむくみ評価の平均を比べる */
export function bloatInsights(upto) {
  const last = dayIndex(upto);
  const rows = BLOAT_FACTORS.map((f) => ({ ...f, yes: [], no: [] }));
  const log = [];
  for (let i = 1; i <= last; i++) {
    const prev = store.day(dateOfDay(i - 1));
    const cur = store.day(dateOfDay(i));
    if (cur.bloat == null) continue;
    const touched = Object.keys(prev).some((k) => ['salt', 'alcohol', 'late', 'sleep', 'weight', 'checks'].includes(k));
    if (!touched) continue;                  // 前日の記録が何もない日は比べない
    for (const row of rows) (row.test(prev) ? row.yes : row.no).push(cur.bloat);
    log.push({ date: dateOfDay(i), risk: bloatRisk(prev), actual: cur.bloat });
  }
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return {
    rows: rows.map((r) => ({ id: r.id, label: r.label, yes: avg(r.yes), no: avg(r.no), nYes: r.yes.length, nNo: r.no.length })),
    log,
  };
}

// --- 体重 -------------------------------------------------------------------

export function weightSeries(upto) {
  const last = Math.max(0, dayIndex(upto));
  const pts = [];
  for (let i = 0; i <= last; i++) {
    const w = store.day(dateOfDay(i)).weight;
    if (w != null) pts.push({ di: i, w });
  }
  return pts;
}

/** 7日移動平均（その日を含む直近7日のうち、記録のある日の平均） */
export function movingAvg(pts) {
  const out = [];
  for (const p of pts) {
    const win = pts.filter((q) => q.di <= p.di && q.di > p.di - 7);
    out.push({ di: p.di, w: win.reduce((a, b) => a + b.w, 0) / win.length, n: win.length });
  }
  return out;
}

export function latestWeight(upto, s = store.settings()) {
  const pts = weightSeries(upto);
  return pts.length ? pts[pts.length - 1].w : s.weight;
}

// --- 週次レビュー -----------------------------------------------------------

function weekAvg(k) {
  const ws = [];
  for (let i = 7 * k - 6; i <= 7 * k; i++) {
    const w = store.day(dateOfDay(i)).weight;
    if (w != null) ws.push(w);
  }
  return { avg: ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null, n: ws.length };
}

function weekBase(k, s) {
  if (k >= 2) return weekAvg(k - 1).avg;
  const d0 = store.day(dateOfDay(0)).weight;        // W1 は DAY 0 の体重と比べる
  return d0 != null ? d0 : s.weight;
}

/** k 週目（1〜5）。レビュー日は 7k 日目（火曜）。 */
export function weeklyReview(k, s = store.settings()) {
  const cur = weekAvg(k);
  const prev = weekBase(k, s);
  const diff = cur.avg != null && prev != null ? prev - cur.avg : null;   // 正の数＝減った
  const rate = averageScore(7 * k - 6, 7 * k, s);
  const applied = (s.reviews || {})[k] || null;
  const t = targets(s);

  let verdict, kind, options = [];
  if (cur.n < 3 || diff == null) {
    kind = 'nodata';
    verdict = `体重の記録が${cur.n}日分しかない。判断できない。毎朝測れ。`;
  } else if (diff > 1.0) {
    const prevCur = k >= 2 ? weekAvg(k - 1).avg : null;
    const prevBase = k >= 2 ? weekBase(k - 1, s) : null;
    const prevDiff = prevCur != null && prevBase != null ? prevBase - prevCur : null;
    if (prevDiff != null && prevDiff > 1.0) {
      kind = 'fast';
      verdict = '落とすペースが速すぎ。摂取を150kcal戻す。筋肉と肌のハリを守れ。';
      options = [{ id: 'kcal+', label: '摂取を150kcal戻す' }];
    } else {
      kind = 'fastish';
      verdict = '今週は1.0kg超の減少。来週も続いたら150kcal戻す。今は継続。';
    }
  } else if (diff >= 0.3) {
    kind = 'keep';
    verdict = '今のまま継続。やり方は合っている。';
  } else {
    kind = 'slow';
    verdict = '減りが0.3kg未満。どちらか1つを選んで来週から足す。';
    if (t && !t.atFloor) options.push({ id: 'kcal-', label: '摂取を150kcal減らす' });
    options.push({ id: 'steps+', label: '歩数を+2,000' });
  }
  return { k, day: 7 * k, date: dateOfDay(7 * k), avg: cur.avg, n: cur.n, prev, diff, rate, verdict, kind, options, applied };
}

export function applyReview(k, optionId) {
  const s = store.settings();
  const reviews = { ...(s.reviews || {}) };
  let { adjKcal = 0, adjSteps = 0 } = s;
  const undo = (id) => {
    if (id === 'kcal-') adjKcal += 150;
    if (id === 'kcal+') adjKcal -= 150;
    if (id === 'steps+') adjSteps -= 2000;
  };
  if (reviews[k]) undo(reviews[k]);
  if (optionId) {
    if (optionId === 'kcal-') adjKcal -= 150;
    if (optionId === 'kcal+') adjKcal += 150;
    if (optionId === 'steps+') adjSteps += 2000;
    reviews[k] = optionId;
  } else delete reviews[k];
  return store.saveSettings({ reviews, adjKcal, adjSteps });
}

// --- ジムの伸び（DAY 36 のまとめ用） ---------------------------------------

export function gymProgress() {
  const first = {}, best = {};
  let sessions = 0;
  for (const d of store.gymDates()) {
    const g = store.gym(d);
    if (!g || !g.sets) continue;
    if (g.done) sessions++;
    for (const [id, sets] of Object.entries(g.sets)) {
      const ex = EXERCISES[id];
      if (!ex) continue;
      const vals = sets.filter((x) => x && x.r > 0).map((x) => (ex.bw ? x.r : x.w || 0));
      if (!vals.length) continue;
      const top = Math.max(...vals);
      if (!(id in first)) first[id] = top;
      best[id] = Math.max(best[id] ?? 0, top);
    }
  }
  const rows = Object.keys(first).map((id) => ({
    id, name: EXERCISES[id].name, unit: EXERCISES[id].bw ? EXERCISES[id].unit : 'kg',
    first: first[id], best: best[id], gain: best[id] - first[id],
  }));
  return { rows, sessions };
}
