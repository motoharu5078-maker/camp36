// 書き出し・読み込み：.ics（カレンダー用リマインダー）と JSON バックアップ。

import * as store from './store.js';
import * as photos from './photos.js';
import { today, dayIndex, dateOfDay, icsUTC, TOTAL } from './dates.js';
import { isGymDay, gymType } from './calc.js';
import { MENU } from './data.js';

// --- .ics ------------------------------------------------------------------

const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** RFC 5545 の行折り返し（75オクテット。UTF-8 の文字の途中では切らない） */
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function vevent({ uid, date, time, minutes, summary, desc }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@camp36`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsUTC(date, time)}`,
    `DTEND:${icsUTC(date, time, minutes)}`,
    `SUMMARY:${icsEsc(summary)}`,
    `DESCRIPTION:${icsEsc(desc)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEsc(summary)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
  ];
}

/** 今日から 12/23 までの「朝の計測」「顔トレ動画」「ジム」＋散髪・週次レビューの予定 */
export function buildICS(s = store.settings()) {
  const from = Math.max(0, dayIndex(today()));
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CAMP 36//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:CAMP 36', 'X-WR-TIMEZONE:Asia/Tokyo'];
  let count = 0;
  const add = (ev) => { lines.push(...vevent(ev)); count++; };
  for (let i = from; i <= TOTAL; i++) {
    const date = dateOfDay(i);
    const ymd = date.replace(/-/g, '');
    const left = TOTAL - i;
    add({
      uid: `morning-${ymd}`, date, time: s.times.morning, minutes: 10,
      summary: i === TOTAL ? 'CAMP 36 計量日：最終計量と顔写真' : `CAMP 36 朝の計測（DAY ${i}）`,
      desc: i === TOTAL ? '水→首・肩ストレッチ→顔痩せ動画→洗顔・保湿→髪のセット。最後に計量と写真。' : `体重（起床・トイレ後）と顔写真。計量まで${left}日。`,
    });
    if (i >= 1 && i < TOTAL) {
      add({ uid: `video-${ymd}`, date, time: s.times.video, minutes: 10, summary: 'CAMP 36 鬼の顔痩せ動画（7分）', desc: '今日の1回が12/23の顔を作る。' });
    }
    if (isGymDay(date, s)) {
      const type = gymType(date, s);
      add({ uid: `gym-${ymd}`, date, time: s.times.gym, minutes: 60, summary: `CAMP 36 ジム ${type}日（${MENU[type].title}）`, desc: i === TOTAL - 1 ? '今日は軽め。睡眠最優先。' : '前回の自分を1つ超える。' });
    }
    if (i >= 7 && i % 7 === 0 && i < TOTAL) {
      add({ uid: `review-${ymd}`, date, time: '21:00', minutes: 10, summary: `CAMP 36 週次レビュー（W${i / 7}）`, desc: '7日平均を見て、来週の調整を決める。' });
    }
  }
  const extra = [
    { di: 15, uid: 'haircut-book', summary: 'CAMP 36 散髪を予約する（12/19〜21）', desc: '年末は埋まる。今週中に枠を押さえる。' },
    { di: 32, uid: 'haircut', summary: 'CAMP 36 散髪（12/19〜21のどこかで）', desc: '切りたてより、少し馴染んだ状態で本番へ。' },
    { di: 34, uid: 'final-rules', summary: 'CAMP 36 今日からお酒なし・塩分控えめ・23時以降食べない', desc: '足すな。崩すな。運べ。' },
  ];
  for (const e of extra) {
    if (e.di >= from) add({ uid: e.uid, date: dateOfDay(e.di), time: '12:00', minutes: 10, summary: e.summary, desc: e.desc });
  }
  lines.push('END:VCALENDAR');
  return { text: lines.map(fold).join('\r\n') + '\r\n', count };
}

// --- JSON バックアップ -----------------------------------------------------

export async function buildBackup() {
  const data = {};
  for (const k of store.keys()) data[k] = store.get(k);
  const rows = await photos.all().catch(() => []);
  const pics = [];
  for (const r of rows) pics.push({ date: r.date, kind: r.kind, ts: r.ts, data: await photos.blobToDataURL(r.blob) });
  return { app: 'camp36', version: 1, exportedAt: new Date().toISOString(), data, photos: pics };
}

export function checkBackup(obj) {
  if (!obj || obj.app !== 'camp36' || typeof obj.data !== 'object' || obj.data === null) {
    throw new Error('CAMP 36 のバックアップファイルではない。');
  }
  return {
    days: Object.keys(obj.data).filter((k) => k.startsWith('day:')).length,
    gyms: Object.keys(obj.data).filter((k) => k.startsWith('gym:')).length,
    photos: Array.isArray(obj.photos) ? obj.photos.length : 0,
    exportedAt: obj.exportedAt || '',
  };
}

export async function restoreBackup(obj) {
  checkBackup(obj);
  store.wipeAll();
  for (const [k, v] of Object.entries(obj.data)) store.set(k, v);
  await photos.clear().catch(() => {});
  for (const p of obj.photos || []) {
    if (!p || !p.date || !p.kind || !p.data) continue;
    await photos.put(p.date, p.kind, await photos.dataURLToBlob(p.data));
  }
  await photos.syncIndex();
}
