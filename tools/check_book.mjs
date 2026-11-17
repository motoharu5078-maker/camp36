// BOOK のカードが 150〜250字（見出し＋要点＋今日からやること）に収まっているか確かめる。
//   node tools/check_book.mjs
import { BOOK, BOOK_CATS } from '../js/data.js';
let bad = 0;
for (const c of BOOK) {
  const n = [...(c.title + c.points.join('') + c.todo)].length;
  const ok = n >= 150 && n <= 250;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'NG '} ${String(n).padStart(3)}字  [${BOOK_CATS.find((x) => x.id === c.cat).label}] ${c.title}`);
}
console.log(`${BOOK.length}枚 / 範囲外 ${bad}枚`);
process.exit(bad ? 1 : 0);
