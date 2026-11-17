// 日付はすべて Asia/Tokyo 基準の 'YYYY-MM-DD' 文字列で扱う。
// 日付同士の計算は Date.UTC を通すので、端末のタイムゾーンに左右されない。

export const START = '2026-11-17'; // DAY 0
export const END = '2026-12-23';   // DAY 36
export const TOTAL = 36;

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function jstParts(d = new Date()) {
  const o = {};
  for (const p of partsFmt.formatToParts(d)) o[p.type] = p.value;
  return o;
}

function query(name) {
  try { return new URLSearchParams(location.search).get(name); } catch { return null; }
}

/** デバッグ用: ?date=2026-12-23 で「今日」を差し替える */
export function debugDate() {
  const q = query('date');
  return q && /^\d{4}-\d{2}-\d{2}$/.test(q) && !Number.isNaN(toUTC(q)) ? q : null;
}

export function today() {
  const dbg = debugDate();
  if (dbg) return dbg;
  const p = jstParts();
  return `${p.year}-${p.month}-${p.day}`;
}

/** 日本時間の「時」(0-23)。デバッグ用に ?hour=21 で差し替え可 */
export function jstHour() {
  const q = query('hour');
  if (q != null && /^\d{1,2}$/.test(q)) return Math.min(23, +q);
  return +jstParts().hour;
}

export function toUTC(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export const diffDays = (a, b) => Math.round((toUTC(a) - toUTC(b)) / 864e5);
export const addDays = (s, n) => new Date(toUTC(s) + n * 864e5).toISOString().slice(0, 10);
export const dayIndex = (s) => diffDays(s, START);
export const dateOfDay = (n) => addDays(START, n);
export const weekday = (s) => new Date(toUTC(s)).getUTCDay();

export const WD = ['日', '月', '火', '水', '木', '金', '土'];
export const mmdd = (s) => { const [, m, d] = s.split('-'); return `${+m}/${+d}`; };
export const label = (s) => `${mmdd(s)}（${WD[weekday(s)]}）`;

/** 'HH:MM'（日本時間）とその日付から、UTC の iCalendar 形式 'YYYYMMDDTHHMMSSZ' を作る */
export function icsUTC(date, hhmm, addMin = 0) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = new Date(toUTC(date) + ((h - 9) * 60 + m + addMin) * 60000);
  return t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
