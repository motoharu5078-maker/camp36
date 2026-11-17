// 未来の自分への手紙。封をすると 12/23 まで開けられない。

import * as store from '../store.js';
import { today, dayIndex, mmdd, TOTAL } from '../dates.js';
import { $, esc, icon, tape, toast, ask, buzz } from '../ui.js';

export default function render(el) {
  const di = dayIndex(today());
  const l = store.letter();
  const head = `
    <header class="sub-head">
      <a class="icon-btn" href="#/today" aria-label="戻る">${icon.back}</a>
      ${tape('LETTER')}
    </header>`;

  if (!l) {
    el.innerHTML = `${head}
      <h1 class="page-h">未来の自分へ</h1>
      <p class="muted">12/23 の自分に宛てて書け。封をしたら、当日まで開けられない。書き直しもできない。</p>
      <textarea class="ta tall" data-letter rows="10" maxlength="2000" placeholder="36日後の自分へ。今、何が悔しいか。どうなっていたいか。"></textarea>
      <div class="dock"><button class="btn red" data-seal disabled>${icon.lock}封をする</button></div>`;
    const ta = $('[data-letter]', el);
    const btn = $('[data-seal]', el);
    ta.addEventListener('input', () => { btn.disabled = !ta.value.trim(); });
    btn.addEventListener('click', async () => {
      if (!(await ask('封をする。12/23 まで開けられないし、書き直せない。いいか。', { ok: '封をする' }))) return;
      store.sealLetter(ta.value.trim(), today());
      buzz(30);
      toast('封をした。');
      render(el);
    });
    return;
  }

  if (di < TOTAL && !l.opened) {
    el.innerHTML = `${head}
      <div class="envelope">
        <div class="sealed big">${icon.lock}<b>SEALED</b><span>${esc(mmdd(l.sealedAt))} に封をした</span></div>
        <p class="env-n"><b>${TOTAL - di}</b>日後に開く</p>
        <p class="muted">12/23 まで、中身は見られない。その日の自分が読むに値する36日にしろ。</p>
      </div>`;
    return;
  }

  if (!l.opened) {
    el.innerHTML = `${head}
      <div class="envelope">
        <div class="sealed big">${icon.lock}<b>SEALED</b><span>${esc(mmdd(l.sealedAt))} の自分から</span></div>
        <p class="muted">36日前の自分が書いた手紙だ。今の顔で読め。</p>
      </div>
      <div class="dock"><button class="btn red" data-open>開封する</button></div>`;
    $('[data-open]', el).addEventListener('click', () => { buzz([20, 40, 20]); store.openLetter(); render(el); });
    return;
  }

  const text = store.openLetter();
  el.innerHTML = `${head}
    <article class="letter">
      <p class="letter-from">${esc(mmdd(l.sealedAt))} — DAY ${Math.max(0, dayIndex(l.sealedAt))} の自分から</p>
      <div class="letter-body">${esc(text).replace(/\n/g, '<br>')}</div>
      <p class="letter-to">12/23 の自分へ</p>
    </article>`;
}
