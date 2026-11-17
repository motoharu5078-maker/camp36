// 顔写真は IndexedDB に Blob で保存する。サーバーには一切送らない。
// 「その日に写真があるか」だけは、スコア計算用に localStorage の1日記録にも写しておく。

import * as store from './store.js';

const DB = 'camp36';
const STORE = 'photos';
export const KINDS = ['front', 'side'];
export const KIND_LABEL = { front: '正面', side: '横顔（左）' };

let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const d = req.result;
      d.onversionchange = () => { d.close(); dbp = null; };
      resolve(d);
    };
    req.onerror = () => { dbp = null; reject(req.error); };
  });
  return dbp;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const os = t.objectStore(STORE);
    let result;
    const r = fn(os);
    if (r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const key = (date, kind) => `${date}|${kind}`;
const urls = new Map();
function dropUrl(id) {
  if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
}

function mirror(date) {
  // localStorage 側の「写真あり」印を IndexedDB の中身に合わせる
  return index().then((idx) => {
    const p = idx[date] || {};
    const rec = store.day(date);
    if (!p.front && !p.side) { if (rec.photos) store.saveDay(date, { photos: null }); } else store.saveDay(date, { photos: p });
  });
}

export async function put(date, kind, blob) {
  const id = key(date, kind);
  await tx('readwrite', (os) => os.put({ id, date, kind, blob, ts: Date.now() }));
  dropUrl(id);
  await mirror(date);
}

export async function get(date, kind) {
  const row = await tx('readonly', (os) => os.get(key(date, kind)));
  return row ? row.blob : null;
}

export async function remove(date, kind) {
  const id = key(date, kind);
  await tx('readwrite', (os) => os.delete(id));
  dropUrl(id);
  await mirror(date);
}

export async function all() {
  return (await tx('readonly', (os) => os.getAll())) || [];
}

export async function clear() {
  await tx('readwrite', (os) => os.clear());
  for (const id of [...urls.keys()]) dropUrl(id);
}

/** {date: {front:true, side:true}} */
export async function index() {
  const keys = (await tx('readonly', (os) => os.getAllKeys())) || [];
  const idx = {};
  for (const k of keys) {
    const [date, kind] = String(k).split('|');
    (idx[date] = idx[date] || {})[kind] = true;
  }
  return idx;
}

/** 表示用の URL（同じ写真は使い回す） */
export async function url(date, kind) {
  const id = key(date, kind);
  if (urls.has(id)) return urls.get(id);
  const blob = await get(date, kind);
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(id, u);
  return u;
}

/** 起動時に呼ぶ。localStorage 側の印を IndexedDB の実物に合わせ直す。 */
export async function syncIndex() {
  try {
    const idx = await index();
    const dates = new Set([...Object.keys(idx), ...store.dayDates().filter((d) => store.day(d).photos)]);
    for (const d of dates) {
      const want = idx[d] || null;
      const have = store.day(d).photos || null;
      if (JSON.stringify(want) !== JSON.stringify(have)) store.saveDay(d, { photos: want });
    }
  } catch { /* IndexedDB が使えない環境では写真機能だけ止まる */ }
}

// --- 画像の縮小 -------------------------------------------------------------

const LONG = 1080;
const QUALITY = 0.8;

const toBlob = (canvas) => new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', QUALITY));

/** ライブ映像の今のコマを、画面に見えている通り（3:4・左右反転）に切り出して保存用 JPEG にする */
export async function fromVideo(video, mirrored = true) {
  const W = 810, H = 1080;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = Math.max(W / vw, H / vh);
  const dw = vw * scale, dh = vh * scale;
  if (mirrored) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return toBlob(c);
}

/** 選んだ画像ファイルを、長辺 1080px・JPEG 0.8 に縮小する */
export async function fromFile(file) {
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    await img.decode();
    const k = Math.min(1, LONG / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await toBlob(c);
  } finally {
    URL.revokeObjectURL(src);
  }
}

export const blobToDataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

export async function dataURLToBlob(dataUrl) {
  const [head, body] = dataUrl.split(',');
  const mime = (head.match(/data:(.*?);/) || [])[1] || 'image/jpeg';
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
