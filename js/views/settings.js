// 設定：体の数値、なぜ、ジム、自分ルール、リマインダー（.ics）、バックアップ。

import * as store from '../store.js';
import * as photos from '../photos.js';
import * as io from '../io.js';
import { today, dayIndex, debugDate, TOTAL } from '../dates.js';
import { bodyForm, targetsHtml, gymForm, rulesForm, whyForm, bind } from '../forms.js';
import { $, $$, esc, icon, tape, secHead, toast, ask, saveFile } from '../ui.js';

const VERSION = '1.0.0';

export default function render(el) {
  const s = store.settings();
  const di = dayIndex(today());
  const l = store.letter();
  const seg = (name, values, cur, fmt) => `
    <div class="seg">${values.map((v) => `<button data-${name}="${v}" class="${cur === v ? 'on' : ''}" aria-pressed="${cur === v}">${fmt(v)}</button>`).join('')}</div>`;

  el.innerHTML = `
    <header class="sub-head">
      <a class="icon-btn" href="#/today" aria-label="戻る">${icon.back}</a>
      ${tape('SETTINGS')}
    </header>

    <section class="sec">
      ${secHead('WHY 12.23', 'なぜ12/23か')}
      <p class="muted">毎日ホームに出す一文。いつでも書き換えていい。</p>
      ${whyForm(s)}
    </section>

    <section class="sec">
      ${secHead('BODY', '体と目標')}
      ${bodyForm(s)}
      <div data-targets>${targetsHtml(s)}</div>
    </section>

    <section class="sec">
      ${secHead('GYM', 'chocoZAP')}
      ${gymForm(s)}
      <p class="form-l">「重さ1段」の幅</p>
      ${seg('step', [2.5, 5, 10], s.step, (v) => `${v}kg`)}
      <p class="form-l">セット間の休憩</p>
      ${seg('rest', [60, 75, 90], s.rest, (v) => `${v}秒`)}
    </section>

    <section class="sec">
      ${secHead('MY RULES', '自分ルール（NGリスト）')}
      <p class="muted">自分で決めた禁止事項。毎晩、守れたかを付ける。</p>
      <div data-rules>${rulesForm(s)}</div>
    </section>

    <section class="sec">
      ${secHead('REMINDER', 'カレンダーで通知を受ける')}
      <p class="muted">iPhone のWebアプリは通知が不安定だ。予定をカレンダーに入れて、そっちで鳴らせ。</p>
      <div class="times">
        <label><span>朝の計測</span><input type="time" data-time="morning" value="${esc(s.times.morning)}"></label>
        <label><span>顔トレ動画</span><input type="time" data-time="video" value="${esc(s.times.video)}"></label>
        <label><span>ジム</span><input type="time" data-time="gym" value="${esc(s.times.gym)}"></label>
      </div>
      <button class="btn" data-ics>${icon.out}カレンダー用ファイル（.ics）を書き出す</button>
      <p class="muted">書き出したファイルを開く →「すべてを追加」。今日から12/23までの予定が入る。時刻を変えたら、もう一度書き出せ。</p>
    </section>

    <section class="sec">
      ${secHead('LETTER', '未来の自分への手紙')}
      <a class="notice" href="#/letter"><span class="en">${l ? (l.opened ? 'OPENED' : 'SEALED') : 'NOT YET'}</span><span>${l ? (l.opened ? '手紙を読み返す' : di >= TOTAL ? '開封できる' : `封をした。12/23 に開く（あと${TOTAL - di}日）`) : 'まだ書いていない。書いて封をしろ。'}</span>${icon.arrow}</a>
    </section>

    <section class="sec">
      ${secHead('DATA', 'データ')}
      <div class="privacy">
        <b>データはこの端末の中だけ。</b>
        <p>記録も顔写真も、このスマホのブラウザ内（localStorage と IndexedDB）にだけ保存する。<strong>顔写真をサーバーに送ることは一切ない。</strong>アカウントもない。ブラウザのデータを消すと全部消えるから、ときどきバックアップを書き出せ。</p>
      </div>
      <button class="btn" data-export>${icon.out}全データを書き出す（JSON・写真込み）</button>
      <label class="btn">${icon.copy}バックアップを読み込む<input type="file" accept="application/json,.json" data-import hidden></label>
      <button class="btn ghost danger" data-wipe>${icon.trash}全データを消す</button>
    </section>

    <section class="sec about">
      ${secHead('ABOUT', 'このアプリ')}
      <p class="muted">CAMP 36 — 12.23 計量日 ／ v${VERSION}<br>体調に異変があれば中止して医師に相談。<br>日付の確認用：URL の末尾に <code>?date=2026-12-23</code> を付けると、その日の画面になる。${debugDate() ? `<br><b>今は ${esc(debugDate())} として表示中。</b>` : ''}</p>
      <button class="btn ghost" data-update>最新版に更新する</button>
    </section>
  `;

  bind(el, (what) => {
    if (what === 'body') $('[data-targets]', el).innerHTML = targetsHtml(store.settings());
    if (what === 'rules') $('[data-rules]', el).innerHTML = rulesForm(store.settings());
  });

  el.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.time) {
      if (!/^\d{2}:\d{2}$/.test(t.value)) return;
      const cur = store.settings();
      store.saveSettings({ times: { ...cur.times, [t.dataset.time]: t.value } });
      toast('時刻を保存した。');
    } else if ('import' in t.dataset) {
      const file = t.files && t.files[0];
      t.value = '';
      if (!file) return;
      try {
        const obj = JSON.parse(await file.text());
        const info = io.checkBackup(obj);
        const ok = await ask(`今のデータを全部置き換える。\n記録 ${info.days}日分・ジム ${info.gyms}回・写真 ${info.photos}枚。`, { ok: '置き換える', danger: true });
        if (!ok) return;
        await io.restoreBackup(obj);
        toast('読み込んだ。');
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        toast(err.message || '読み込めなかった。');
      }
    }
  });

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.step || b.dataset.rest) {
      const key = b.dataset.step ? 'step' : 'rest';
      store.saveSettings({ [key]: +b.dataset[key] });
      for (const x of $$(`[data-${key}]`, el)) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }
    } else if ('ics' in b.dataset) {
      const { text, count } = io.buildICS(store.settings());
      const r = await saveFile('camp36.ics', 'text/calendar', text);
      if (r !== 'cancelled') toast(`予定 ${count}件を書き出した。`);
    } else if ('export' in b.dataset) {
      b.disabled = true;
      try {
        const data = await io.buildBackup();
        const name = `camp36-backup-${today().replace(/-/g, '')}.json`;
        const r = await saveFile(name, 'application/json', JSON.stringify(data));
        if (r !== 'cancelled') toast(`書き出した。写真 ${data.photos.length}枚込み。`);
      } catch {
        toast('書き出せなかった。');
      }
      b.disabled = false;
    } else if ('wipe' in b.dataset) {
      if (!(await ask('記録・写真・設定を全部消す。元には戻せない。', { ok: '消す', danger: true }))) return;
      if (!(await ask('本当に消すぞ。バックアップは取ったか。', { ok: '全部消す', danger: true }))) return;
      store.wipeAll();
      await photos.clear().catch(() => {});
      location.hash = '#/setup';
      location.reload();
    } else if ('update' in b.dataset) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      } catch { /* noop */ }
      location.reload();
    }
  });
}
