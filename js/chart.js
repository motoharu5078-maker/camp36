// 体重グラフ（SVG を自作。ライブラリなし）。点＝毎日の値、線＝7日移動平均。

import { weightSeries, movingAvg } from './calc.js';
import { dayIndex, TOTAL } from './dates.js';

export function weightChart(upto) {
  const pts = weightSeries(upto);
  if (!pts.length) return '';
  const ma = movingAvg(pts);
  const W = 343, H = 196, L = 36, R = 10, T = 12, B = 24;
  const ws = pts.map((p) => p.w);
  let lo = Math.floor((Math.min(...ws) - 0.3) * 2) / 2;
  let hi = Math.ceil((Math.max(...ws) + 0.3) * 2) / 2;
  hi = lo + Math.max(2, Math.ceil((hi - lo) / 2) * 2);            // 目盛りが 0.5kg 刻みになる幅にそろえる
  const x = (di) => L + (di / TOTAL) * (W - L - R);
  const y = (w) => T + (1 - (w - lo) / (hi - lo)) * (H - T - B);
  const f = (n) => n.toFixed(1);

  const grid = [];
  const stepY = (hi - lo) / 4;
  for (let i = 0; i <= 4; i++) {
    const v = lo + stepY * i;
    grid.push(`<line class="g" x1="${L}" x2="${W - R}" y1="${f(y(v))}" y2="${f(y(v))}"/><text class="t" x="${L - 6}" y="${f(y(v) + 3)}" text-anchor="end">${v.toFixed(1)}</text>`);
  }
  for (let d = 0; d <= TOTAL; d += 7) {
    grid.push(`<line class="g v" x1="${f(x(d))}" x2="${f(x(d))}" y1="${T}" y2="${H - B}"/>`);
    if (d < 35) grid.push(`<text class="t" x="${f(x(d))}" y="${H - 8}" text-anchor="middle">${d}</text>`);
  }
  grid.push(`<text class="t" x="${f(x(TOTAL))}" y="${H - 8}" text-anchor="end">DAY 36</text>`);

  const now = Math.min(TOTAL, Math.max(0, dayIndex(upto)));
  const line = ma.map((p) => `${f(x(p.di))},${f(y(p.w))}`).join(' ');
  const last = ma[ma.length - 1];
  return `
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="体重の推移。点が毎日の値、線が7日平均。">
    ${grid.join('')}
    <line class="today" x1="${f(x(now))}" x2="${f(x(now))}" y1="${T}" y2="${H - B}"/>
    ${pts.map((p) => `<circle class="pt" cx="${f(x(p.di))}" cy="${f(y(p.w))}" r="2.4"/>`).join('')}
    ${ma.length > 1 ? `<polyline class="ma" points="${line}"/>` : ''}
    <circle class="ma-end" cx="${f(x(last.di))}" cy="${f(y(last.w))}" r="4"/>
  </svg>
  <p class="chart-k"><span><i class="k-pt"></i>毎日の値</span><span><i class="k-ma"></i>7日平均</span><span><i class="k-now"></i>今日</span></p>`;
}
