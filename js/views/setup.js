// 初回設定（DAY 0）。1ステップ1画面、ボタンは常に画面の下。

import * as store from '../store.js';
import * as io from '../io.js';
import { today, dayIndex, TOTAL } from '../dates.js';
import { targets } from '../calc.js';
import { bodyForm, targetsHtml, gymForm, rulesForm, whyForm, bind, bodyOk } from '../forms.js';
import { $, esc, icon, tape, toast, ask } from '../ui.js';

const STEPS = ['intro', 'body', 'targets', 'gym', 'why', 'rules', 'letter', 'done'];
const go = (i) => { location.hash = `#/setup/${i}`; };

export default function render(el, params) {
  let i = Math.min(STEPS.length - 1, Math.max(0, parseInt(params[0], 10) || 0));
  let s = store.settings();
  if (i > 1 && !bodyOk(s)) i = 1;       // 体の数値がないと先へ進めない
  const step = STEPS[i];
  const di = dayIndex(today());

  const head = (title, lead) => `
    <div class="wiz-top">
      <span class="wiz-n">STEP ${i} / ${STEPS.length - 2}</span>
      <div class="bar"><i style="width:${(i / (STEPS.length - 2)) * 100}%"></i></div>
    </div>
    <h1 class="wiz-h">${title}</h1>
    <p class="wiz-p">${lead}</p>`;

  const foot = (nextLabel = '次へ', { back = true, skip = '' } = {}) => `
    <footer class="wiz-foot">
      ${skip ? `<button class="wiz-skip" data-skip>${skip}</button>` : ''}
      <div class="wiz-btns">
        ${back ? `<a class="btn ghost back" href="#/setup/${i - 1}" aria-label="戻る">${icon.back}</a>` : ''}
        <button class="btn solid" data-next>${nextLabel}</button>
      </div>
    </footer>`;

  let body = '';
  if (step === 'intro') {
    const left = di < 0 ? `開始まで ${-di}日` : di <= TOTAL ? `計量まで ${TOTAL - di}日` : '';
    body = `
      <section class="poster">
        ${tape('12.23 WEIGH-IN')}
        <h1 class="poster-h"><span>CAMP</span><b>36</b></h1>
        <p class="poster-d">2026.11.18 — 12.23 ／ ${esc(left)}</p>
        <ul class="poster-l">
          <li>顔痩せ</li><li>減量</li><li>筋トレ</li><li>肌</li><li>仕上げ</li>
        </ul>
        <p class="poster-c">12月23日を、計量日だと思え。<br>36日で、顔と体を仕上げる。<br>毎日やることは決まっている。記録して、積むだけだ。</p>
      </section>
      <footer class="wiz-foot">
        <label class="wiz-skip">バックアップから復元する<input type="file" accept="application/json,.json" data-restore hidden></label>
        <div class="wiz-btns"><button class="btn red" data-next>設定を始める</button></div>
      </footer>`;
  } else if (step === 'body') {
    body = `${head('今の体を入れろ', '身長・体重・年齢・活動量から、1日に食べていい量を計算する。見栄を張るな。今の数字を入れろ。')}
      <div class="wiz-body">${bodyForm(s)}</div>${foot('計算する')}`;
  } else if (step === 'targets') {
    body = `${head('これが毎日の目標だ', 'Mifflin-St Jeor 式で計算した。極端なことはしない。この数字を36日守る。')}
      <div class="wiz-body">${targetsHtml(s)}</div>${foot()}`;
  } else if (step === 'gym') {
    body = `${head('chocoZAP の設備', '店舗ごとに置いてあるマシンが違う。自分の店舗にあるものだけ選べ。メニューはそこから組む。')}
      <div class="wiz-body">${gymForm(s)}</div>${foot()}`;
  } else if (step === 'why') {
    body = `${head('なぜ12/23か', '毎日、ホームの一番上に出す。きつい日に読むのは、この一文だ。')}
      <div class="wiz-body">${whyForm(s)}</div>${foot('次へ', { skip: 'あとで書く' })}`;
  } else if (step === 'rules') {
    body = `${head('自分ルール', '自分で決めた禁止事項。毎晩「守れたか」を1タップで付ける。なくてもいい。あとで足せる。')}
      <div class="wiz-body" data-rules>${rulesForm(s)}</div>${foot()}`;
  } else if (step === 'letter') {
    const sealed = store.letter();
    body = sealed ? `${head('手紙は封をした', '12/23 になるまで、中身は誰にも見られない。自分にもだ。')}
      <div class="wiz-body"><div class="sealed">${icon.lock}<b>SEALED</b><span>12/23 に開く</span></div></div>${foot()}`
      : `${head('未来の自分へ', '12/23 の自分に宛てて書け。封をしたら、当日まで開けられない。書き直しもできない。')}
      <div class="wiz-body"><textarea class="ta tall" data-letter rows="9" maxlength="2000" placeholder="36日後の自分へ。今、何が悔しいか。どうなっていたいか。"></textarea></div>
      ${foot('封をする', { skip: 'あとで書く' })}`;
  } else {
    const t = targets(s);
    body = `
      <section class="poster ready">
        ${tape('READY')}
        <h1 class="poster-h small"><span>設定</span><b>完了</b></h1>
        <dl class="nums compact">
          <div class="main"><dt>摂取目標</dt><dd>${t ? t.intake.toLocaleString('en-US') : '—'}<i>kcal</i></dd></div>
          <div><dt>タンパク質</dt><dd>${t ? t.protein : '—'}<i>g</i></dd></div>
          <div><dt>水分</dt><dd>${t ? (t.water / 1000).toFixed(1) : '—'}<i>L</i></dd></div>
          <div><dt>ジム</dt><dd>週${(s.gymDays || []).length}<i>回</i></dd></div>
        </dl>
        <p class="poster-c">${di === 0 ? '今日は DAY 0。体重を測り、顔写真を撮れ。ここがスタート地点だ。' : di < 0 ? 'キャンプは 11/18 から。11/17 が DAY 0 だ。' : `今日は DAY ${Math.min(di, TOTAL)}。もう始まっている。今日の分から積め。`}</p>
      </section>
      <footer class="wiz-foot"><div class="wiz-btns"><a class="btn ghost back" href="#/setup/${i - 1}" aria-label="戻る">${icon.back}</a><button class="btn red" data-next>キャンプに入る</button></div></footer>`;
  }

  el.innerHTML = `<div class="wiz wiz-${step}">${body}</div>`;

  const nextBtn = $('[data-next]', el);
  const sync = () => {
    s = store.settings();
    if (step === 'body') nextBtn.disabled = !bodyOk(s);
    if (step === 'gym') nextBtn.disabled = !(s.gymDays || []).length;
    if (step === 'why') nextBtn.disabled = !(s.why || '').trim();
    if (step === 'letter' && !store.letter()) nextBtn.disabled = !($('[data-letter]', el).value || '').trim();
  };

  bind(el, (what) => {
    if (what === 'rules') $('[data-rules]', el).innerHTML = rulesForm(store.settings());
    sync();
  });
  el.addEventListener('input', sync);
  sync();

  el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-skip]') && e.target.closest('button')) { go(i + 1); return; }
    if (!e.target.closest('[data-next]')) return;
    if (step === 'letter' && !store.letter()) {
      const text = $('[data-letter]', el).value.trim();
      const ok = await ask('封をする。12/23 まで開けられないし、書き直せない。いいか。', { ok: '封をする' });
      if (!ok) return;
      store.sealLetter(text, today());
      toast('封をした。12/23 に開く。');
      go(i + 1);
      return;
    }
    if (step === 'done') {
      store.saveSettings({ setupDone: true });
      const d = today();
      if (dayIndex(d) >= 0 && store.day(d).weight == null && s.weight) store.saveDay(d, { weight: s.weight });
      location.hash = '#/today';
      return;
    }
    go(i + 1);
  });

  el.addEventListener('change', async (e) => {
    if (!('restore' in e.target.dataset)) return;
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      const info = io.checkBackup(obj);
      const ok = await ask(`バックアップを読み込む。\n記録 ${info.days}日分・ジム ${info.gyms}回・写真 ${info.photos}枚。`, { ok: '読み込む' });
      if (!ok) return;
      await io.restoreBackup(obj);
      location.hash = '#/today';
      location.reload();
    } catch (err) {
      toast(err.message || '読み込めなかった。');
    }
  });
}
