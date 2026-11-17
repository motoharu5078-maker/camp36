// BOOK：知識カード。見出し＋要点＋「今日からやること」1行。

import * as store from '../store.js';
import { BOOK, BOOK_CATS, BOOK_FOOTER } from '../data.js';
import { esc, tape } from '../ui.js';

export default function render(el) {
  let cat = store.get('bookCat', BOOK_CATS[0].id);
  if (!BOOK_CATS.some((c) => c.id === cat)) cat = BOOK_CATS[0].id;

  function draw() {
    const cards = BOOK.filter((c) => c.cat === cat);
    const cur = BOOK_CATS.find((c) => c.id === cat);
    el.innerHTML = `
      <header class="page-top">${tape('BOOK')}<span class="sub-meta">${BOOK.length} PAGES</span></header>
      <h1 class="page-h">知っていることを、やれ。</h1>
      <div class="cats" role="tablist">
        ${BOOK_CATS.map((c) => `<button role="tab" aria-selected="${c.id === cat}" class="cat${c.id === cat ? ' on' : ''}${c.id === 'never' ? ' never' : ''}" data-cat="${c.id}">${esc(c.label)}<small>${BOOK.filter((b) => b.cat === c.id).length}</small></button>`).join('')}
      </div>
      <div class="pages${cat === 'never' ? ' never' : ''}">
        ${cards.map((c, i) => `
          <article class="page">
            <p class="page-n"><span>${esc(cur.label)}</span><b>${String(i + 1).padStart(2, '0')}</b></p>
            <h2>${cat === 'never' ? '<s>' + esc(c.title) + '</s>' : esc(c.title)}</h2>
            <ul>${c.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
            <p class="page-do"><span>今日からやること</span>${esc(c.todo)}</p>
          </article>`).join('')}
      </div>
      <p class="book-foot">${esc(BOOK_FOOTER)}</p>
    `;
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b || b.dataset.cat === cat) return;
    cat = b.dataset.cat;
    store.set('bookCat', cat);
    draw();
    window.scrollTo(0, 0);
  });

  draw();
}
