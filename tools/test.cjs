// 動作確認とスクリーンショット（ヘッドレス Chrome を playwright-core で操作）。
//
//   python3 -m http.server 8136          ← リポジトリのルートで
//   npm i playwright-core                ← どこか別のフォルダで
//   NODE_PATH=<その node_modules> node tools/test.cjs
//
// 1) 幅 320 / 375 / 390 / 430 で全画面を撮って screenshots/ に保存し、横スクロールとタップ領域を検査
// 2) 主要機能（保存・撮影・比較・動画タイマー・ジム・週次レビュー・書き出し・オフライン）を自動操作で確認
// 写真はテスト用に Canvas で描いた絵を使う（本物の顔写真は使わない）。

const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://localhost:8136';
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'screenshots');
const SIZES = [[320, 568], [375, 812], [390, 844], [430, 932]];
const ONLY = process.argv[2] || 'all';   // 'shots' | 'func' | 'all'

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const PROFILE = {
  setupDone: true, height: 172, weight: 70.4, age: 27, activity: 1.375,
  machines: ['treadmill', 'chest', 'lat', 'shoulder', 'legpress', 'adduction', 'abdominal', 'curl'],
  extras: ['whitening'], gymDays: [3, 5, 0, 2],
  why: '12/23、いちばんいい顔で会いに行く。言い訳のない体で立つ。',
  rules: [{ id: 'r1', text: '夜のラーメン' }, { id: 'r2', text: '寝る前のスマホ' }],
};

async function seed(page, N, { photos = true, todayPartial = true } = {}) {
  await page.goto(`${BASE}/?date=2026-11-17#/setup`);
  await page.evaluate(async ({ PROFILE, N, photos, todayPartial }) => {
    localStorage.clear();
    await (await import('./js/photos.js')).clear();
    const store = await import('./js/store.js');
    const calc = await import('./js/calc.js');
    const { dateOfDay } = await import('./js/dates.js');
    store.saveSettings(PROFILE);
    store.sealLetter('36日後の自分へ。\nあの写真の顔が嫌で始めた。\n最後までやり切ったなら、胸を張れ。', dateOfDay(0));
    const s = store.settings();
    let prev = {};
    for (let i = 0; i <= N; i++) {
      const d = dateOfDay(i);
      const rec = {
        weight: +(70.4 - i * 0.085 + Math.sin(i * 1.7) * 0.35).toFixed(1),
        fat: +(19.5 - i * 0.05).toFixed(1),
        sleep: [7, 6.5, 7.5, 5.5, 7, 8, 7][i % 7],
        steps: 7000 + ((i * 677) % 4200),
        bloat: Math.min(5, 1 + (prev.salt ? 1 : 0) + (prev.alcohol ? 2 : 0) + (prev.late ? 1 : 0)),
        skin: 2 + (i % 3),
      };
      if (i % 4 === 1) rec.salt = true;
      if (i % 6 === 2) rec.alcohol = true;
      if (i % 5 === 3) rec.late = true;
      const partial = todayPartial && i === N;
      const checks = {};
      for (const g of calc.checklist(d, s)) {
        for (const it of g.items) {
          if (partial ? g.id === 'am' : (i + it.id.length) % 6 !== 0) checks[it.id] = true;
        }
      }
      rec.checks = checks;
      if (i >= 1 && !partial) rec.rules = { r1: i % 5 ? 'kept' : 'broken', r2: i % 3 ? 'kept' : 'broken' };
      if (partial) { delete rec.steps; delete rec.skin; }
      store.saveDay(d, rec);
      prev = rec;
      if (calc.isGymDay(d, s) && !partial) {
        const type = calc.gymType(d, s);
        const menu = calc.buildMenu(type, s);
        const sets = {};
        for (const ex of menu.list) {
          sets[ex.id] = [0, 1, 2].map((k) => ({ w: ex.bw ? null : 30 + 5 * Math.floor(i / 9), r: ex.bw ? 12 + (i % 5) : Math.min(12, 10 + (i % 3) - k + 1), done: true }));
        }
        store.saveGym(d, { type, sets, cardio: { min: 15, done: true }, done: true });
      }
    }
    if (photos) {
      const ph = await import('./js/photos.js');
      for (let i = 0; i <= N; i++) {
        if (i % 9 === 5) continue;                      // 撮り忘れの日も作る
        for (const kind of ['front', 'side']) {
          if (todayPartial && i === N && kind === 'side') continue;
          const c = document.createElement('canvas');
          c.width = 810; c.height = 1080;
          const x = c.getContext('2d');
          const g = x.createLinearGradient(0, 0, 0, 1080);
          g.addColorStop(0, '#4a4844'); g.addColorStop(1, '#2b2a28');
          x.fillStyle = g; x.fillRect(0, 0, 810, 1080);
          const rx = 262 - i * 2.4;
          x.fillStyle = '#7c7873'; x.fillRect(0, 880, 810, 200);                 // 肩
          x.fillStyle = '#b9a690';
          x.beginPath();
          if (kind === 'front') x.ellipse(405, 500, rx, 330, 0, 0, Math.PI * 2);
          else { x.ellipse(430, 480, rx * 0.95, 320, 0, 0, Math.PI * 2); x.moveTo(250, 520); x.lineTo(190 + i, 600); x.lineTo(270, 640); }
          x.fill();
          x.fillStyle = '#34322f';
          if (kind === 'front') { x.fillRect(300, 440, 60, 14); x.fillRect(450, 440, 60, 14); x.fillRect(350, 640, 110, 12); }
          else { x.fillRect(270, 440, 50, 14); x.fillRect(250, 650, 70, 12); }
          x.fillStyle = '#ECE8DF'; x.font = 'bold 34px sans-serif';
          x.fillText(`TEST IMAGE  DAY ${i}`, 36, 1050);
          const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
          await ph.put(dateOfDay(i), kind, blob);
        }
      }
    }
  }, { PROFILE, N, photos, todayPartial });
}

async function audit(page, name) {
  // 横スクロール：body の overflow-x:clip を外した状態で測る（隠して誤魔化さない）
  const r = await page.evaluate(() => {
    document.body.style.overflowX = 'visible';
    const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const iw = window.innerWidth;
    document.body.style.overflowX = '';
    const small = [];
    const clipped = [];
    const vis = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    for (const el of document.querySelectorAll('button, a[href], select, input:not([type=hidden]):not([hidden]), label.btn, label.cam-alt')) {
      if (!vis(el) || el.closest('.lnk') || el.classList.contains('lnk')) continue;
      const b = el.getBoundingClientRect();
      const inLabel = el.matches('input') ? el.closest('label') : null;
      const box = inLabel ? inLabel.getBoundingClientRect() : b;
      if (box.height < 43.5 || box.width < 43.5) small.push(`${el.tagName.toLowerCase()}.${el.className || ''}[${Math.round(box.width)}x${Math.round(box.height)}] ${(el.textContent || '').trim().slice(0, 12)}`);
    }
    for (const el of document.querySelectorAll('.tape, .btn, .seg > *, .cat, .flag, .mini, .sec-h .en, #tabs a span, .hero-day, .hero-sub, .nums dd, .fin-w dd')) {
      if (!vis(el)) continue;
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') clipped.push(`${el.className}: ${(el.textContent || '').trim().slice(0, 16)}`);
      const b = el.getBoundingClientRect();
      if (b.right > iw + 0.5 || b.left < -0.5) clipped.push(`out of screen ${el.className}: ${(el.textContent || '').trim().slice(0, 16)}`);
    }
    const fontBad = [...document.querySelectorAll('input:not([type=range]):not([type=file]), select, textarea')].filter((el) => vis(el) && parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => el.className || el.outerHTML.slice(0, 40));
    return { sw, iw, small, clipped, fontBad };
  });
  check(`${name}: 横スクロールなし`, r.sw <= r.iw, r.sw > r.iw ? `${r.sw} > ${r.iw}` : '');
  if (r.small.length) check(`${name}: タップ領域 44px 以上`, false, r.small.join(' | '));
  if (r.clipped.length) check(`${name}: 文字・ボタンが切れていない`, false, r.clipped.join(' | '));
  if (r.fontBad.length) check(`${name}: 入力欄 16px 以上`, false, r.fontBad.join(' | '));
}

async function shots(browser) {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block', permissions: ['camera'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/youtube|ERR_|Failed to load resource|doubleclick|googleads/i.test(m.text())) errors.push(m.text()); });
    const snap = async (name, { sel, y } = {}) => {
      if (sel) await page.evaluate((s) => { const el = document.querySelector(s); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70); }, sel);
      if (y != null) await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(220);
      await page.screenshot({ path: path.join(SHOTS, `${w}-${name}.png`) });
      await audit(page, `${w}px ${name}`);
    };
    const go = async (date, hash, wait) => {
      await page.goto(`${BASE}/?date=${date}&hour=21#/${hash}`);
      await page.reload();
      if (wait) await page.waitForSelector(wait);
    };

    // 初回設定
    await page.goto(`${BASE}/?date=2026-11-17`);
    await page.waitForSelector('.poster');
    await snap('01-setup-intro');
    await page.click('[data-next]');
    await page.waitForSelector('[data-body="height"]');
    await page.fill('[data-body="height"]', '172'); await page.fill('[data-body="weight"]', '70.4'); await page.fill('[data-body="age"]', '27');
    await snap('02-setup-body');
    await page.click('[data-next]'); await page.waitForSelector('.nums');
    await snap('03-setup-targets');
    await page.click('[data-next]'); await page.waitForSelector('[data-machine]');
    await page.click('[data-machine-all]');
    await snap('04-setup-gym');

    // DAY 14（12/1 火）：ジムの日・週次レビューの日
    await seed(page, 14);
    const D = '2026-12-01';
    await go(D, 'today', '.hero');
    await snap('05-today');
    await snap('06-today-checklist', { sel: '[data-group="am"]' });
    await snap('07-today-record', { sel: '#record' });
    await go(D, 'face', '.cal');
    await page.waitForFunction(() => [...document.querySelectorAll('.cal-c.has img')].every((i) => i.complete && i.naturalWidth > 0));
    await snap('08-face-log');
    await snap('09-face-calendar', { sel: '.cal-h' });
    await go(D, 'face/cam/side', '.cam-stage');
    await page.waitForFunction(() => { const v = document.querySelector('video'); return v && v.videoWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
    await snap('10-face-camera');
    await go(D, 'face/compare', '.cmp');
    await snap('11-face-compare');
    await go(D, 'face/lapse', '.lapse');
    await snap('12-face-timelapse');
    await go(D, 'gym', '.ex');
    await snap('13-gym');
    await page.click('.ex [data-ok]');
    await snap('14-gym-rest', { sel: '.ex' });
    await go(D, 'roadmap', '.tl');
    await snap('15-roadmap');
    await snap('16-roadmap-review', { sel: '.rv' });
    await snap('17-roadmap-timeline', { sel: '.tl-i.now' });
    await snap('18-roadmap-bloat', { sel: '.bl' });
    await go(D, 'book', '.page');
    await snap('19-book');
    await page.click('[data-cat="never"]');
    await snap('20-book-never');
    await go(D, 'video', '.yt');
    await snap('21-video');
    await go(D, 'settings', '.privacy');
    await snap('22-settings');
    await snap('23-settings-data', { sel: '.privacy' });
    await go(D, 'letter', '.sealed');
    await snap('24-letter-sealed');

    // DAY 36（12/23）
    await seed(page, 36, { todayPartial: false });
    await go('2026-12-23', 'today', '.hero');
    await snap('25-day36-today');
    await go('2026-12-23', 'final', '.fin');
    await page.waitForFunction(() => [...document.querySelectorAll('.fin img')].every((i) => i.complete && i.naturalWidth > 0));
    await snap('26-day36-result');
    await snap('27-day36-result-numbers', { sel: '.fin-w' });
    await go('2026-12-23', 'letter', '[data-open]');
    await page.click('[data-open]');
    await page.waitForSelector('.letter');
    await snap('28-letter-opened');

    check(`${w}px: JavaScript エラーなし`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
}

async function func(browser) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'camp36-'));
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, acceptDownloads: true, permissions: ['camera'], serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const open = async (date, hash, wait, extra = '') => {
    await page.goto(`${BASE}/?date=${date}${extra}#/${hash}`);
    await page.reload();
    if (wait) await page.waitForSelector(wait);
  };

  // --- 初回設定を通しで ---
  await page.goto(`${BASE}/?date=2026-11-17`);
  await page.waitForSelector('.poster');
  check('初回設定: 未設定なら設定画面に入る', page.url().includes('#/setup'));
  await page.click('[data-next]');
  await page.waitForSelector('[data-body="height"]');
  check('初回設定: 数値が空だと進めない', await page.isDisabled('[data-next]'));
  await page.fill('[data-body="height"]', '172'); await page.fill('[data-body="weight"]', '70.4'); await page.fill('[data-body="age"]', '27');
  await page.click('[data-act="1.55"]');
  await page.click('[data-next]'); await page.waitForSelector('.nums');
  const nums = await page.$$eval('.nums dd', (els) => els.map((e) => e.textContent));
  // BMR = 10*70.4 + 6.25*172 - 5*27 + 5 = 1649 / TDEE = 1649*1.55 = 2556 / 摂取 = 2156 → 2160
  check('初回設定: Mifflin-St Jeor の計算', nums[0].startsWith('1,649') && nums[1].startsWith('2,556') && nums[2].startsWith('2,160') && nums[3].startsWith('141') && nums[4].startsWith('2.5'), nums.join(' / '));
  await page.click('[data-next]'); await page.waitForSelector('[data-machine]');
  for (const m of ['treadmill', 'chest', 'lat', 'legpress', 'abdominal']) await page.click(`[data-machine="${m}"]`);
  await page.click('[data-extra="whitening"]');
  await page.click('[data-wd="2"]'); await page.click('[data-wd="6"]');   // 火→土 に変更
  await page.click('[data-next]'); await page.waitForSelector('[data-why]');
  await page.fill('[data-why]', 'テスト用のなぜ');
  await page.click('[data-next]'); await page.waitForSelector('[data-rule-new]');
  await page.fill('[data-rule-new]', '夜のラーメン'); await page.click('[data-rule-add]');
  await page.waitForSelector('.rules li:not(.empty)');
  await page.click('[data-next]'); await page.waitForSelector('[data-letter]');
  await page.fill('[data-letter]', '未来の自分へのテスト');
  await page.click('[data-next]'); await page.click('.sheet [data-ok]');
  await page.waitForSelector('.poster.ready');
  await page.click('[data-next]'); await page.waitForSelector('.hero');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('camp36:settings')));
  check('初回設定: 通しで完了し保存される', st.setupDone && st.height === 172 && st.activity === 1.55 && st.machines.length === 5 && st.gymDays.includes(6) && !st.gymDays.includes(2) && st.why === 'テスト用のなぜ' && st.rules.length === 1);
  check('初回設定: 手紙は封をされ、平文では保存されない', await page.evaluate(() => { const l = localStorage.getItem('camp36:letter'); return !!l && !l.includes('未来の自分') && JSON.parse(l).opened === false; }));
  await page.goto(`${BASE}/?date=2026-11-17#/letter`); await page.reload(); await page.waitForSelector('.sealed');
  check('手紙: 12/23 までは中身が出ない', !(await page.content()).includes('未来の自分へのテスト'));

  // --- TODAY の保存 ---
  await seed(page, 11, { todayPartial: false });
  await open('2026-11-29', 'today', '.hero');
  check('TODAY: カウントダウン', (await page.textContent('.hero-day')).replace(/\s+/g, ' ').trim() === 'DAY 12' && (await page.textContent('.hero-sub')).includes('24'));
  await page.click('[data-check="skin_am"]');
  await page.fill('[data-rec="weight"]', '69.3');
  await page.fill('[data-rec="steps"]', '9000');
  await page.click('[data-rate="bloat"][data-v="2"]');
  await page.click('[data-flag="salt"]');
  await page.click('[data-rule="r1"]');
  const sc1 = await page.textContent('[data-sc]');
  await page.reload(); await page.waitForSelector('.hero');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('camp36:day:2026-11-29')));
  check('TODAY: チェックと数値が再読み込み後も残る', after.checks.skin_am && after.weight === 69.3 && after.steps === 9000 && after.bloat === 2 && after.salt === true && after.rules.r1 === 'kept'
    && await page.$eval('[data-check="skin_am"]', (e) => e.classList.contains('is-done')) && (await page.inputValue('[data-rec="weight"]')) === '69.3' && (await page.textContent('[data-sc]')) === sc1, `score ${sc1}`);
  check('TODAY: 歩数を記録すると歩数目標が自動で付く', await page.$eval('[data-check="steps"]', (e) => e.classList.contains('is-done')));
  check('TODAY: 体重を記録すると体重測定が付く', await page.$eval('[data-check="weigh"]', (e) => e.classList.contains('is-done')));
  await page.goto(`${BASE}/?date=2026-11-29&hour=21#/today`); await page.reload(); await page.waitForSelector('.fc');
  check('むくみ予報: 夜に翌朝のリスクが出る', (await page.textContent('.fc')).includes('明日の朝') && /[低中高]/.test(await page.textContent('.fc-v')), (await page.textContent('.fc')).replace(/\s+/g, ' ').trim());

  // --- 全日程のフェーズ・チェックリスト・ジムメニュー ---
  const table = await page.evaluate(async () => {
    const calc = await import('./js/calc.js');
    const store = await import('./js/store.js');
    const { dateOfDay, weekday, WD } = await import('./js/dates.js');
    const s = { ...store.settings(), gymDays: [3, 5, 0, 2] };
    const out = [];
    for (let i = 0; i <= 36; i++) {
      const d = dateOfDay(i);
      const p = calc.phaseOf(i);
      const groups = calc.checklist(d, s);
      const gym = calc.isGymDay(d, s) ? calc.gymType(d, s) : '-';
      out.push({ i, d, wd: WD[weekday(d)], phase: p.code, steps: calc.stepsTarget(i, s), groups: groups.map((g) => g.id).join(','), n: groups.reduce((a, g) => a + g.items.length, 0), gym, menu: gym === '-' ? '' : calc.buildMenu(gym, s).list.map((x) => x.id).join('>') });
    }
    return out;
  });
  const exp = (i) => (i === 0 ? 'DAY 0' : i <= 7 ? 'ROUND 1' : i <= 14 ? 'ROUND 2' : i <= 21 ? 'ROUND 3' : i <= 28 ? 'ROUND 4' : i <= 35 ? 'ROUND 5' : 'DAY 36');
  check('全日程: DAY 0〜36 のフェーズが指示書どおり', table.every((r) => r.phase === exp(r.i)) && table[0].d === '2026-11-17' && table[36].d === '2026-12-23' && table[1].wd === '水' && table[36].wd === '水');
  check('全日程: 歩数目標 7,000 → 8,000 → 10,000', table[1].steps === 7000 && table[7].steps === 7000 && table[8].steps === 8000 && table[14].steps === 8000 && table[15].steps === 10000 && table[35].steps === 10000);
  const gymDays = table.filter((r) => r.gym !== '-');
  check('全日程: ジムは水・金・日・火、A/B が交互', gymDays.every((r) => '水金日火'.includes(r.wd)) && gymDays.every((r, k) => r.gym === (k % 2 === 0 ? 'A' : 'B')) && table[0].gym === '-' && table[36].gym === '-', `${gymDays.length}回: ${gymDays.slice(0, 6).map((r) => r.d.slice(5) + r.wd + r.gym).join(' ')}`);
  check('全日程: どの日もチェックリストが出る', table.every((r) => r.n >= 5), table.map((r) => r.n).join(''));
  check('全日程: 12/21 から本番前ルール、12/23 は朝のルーティン', table[34].groups.includes('pre') && table[35].groups.includes('pre') && !table[33].groups.includes('pre') && table[36].groups === 'final-am,final-weigh');
  check('ジム: 店舗のマシンだけで組み、ないもの（アブダクション）は自重に置き換わる', gymDays[0].menu === 'chest>lat>shoulder>abdominal>curl' && gymDays[1].menu === 'legpress>adduction>squat>abdominal', `${gymDays[0].menu} / ${gymDays[1].menu}`);
  for (const d of ['2026-11-17', '2026-11-18', '2026-12-09', '2026-12-21', '2026-12-23', '2026-12-25', '2026-11-10']) {
    await open(d, 'today', '.hero');
    const txt = (await page.textContent('.hero')).replace(/\s+/g, ' ');
    check(`?date=${d} で TODAY が出る`, txt.length > 10 && (await page.$$('.chk')).length >= (d === '2026-11-10' ? 0 : 5), txt.slice(0, 60));
  }

  // --- 顔写真：ライブ撮影＋ゴースト ---
  await open('2026-11-29', 'face/cam/front', '.cam-stage');
  await page.waitForFunction(() => { const v = document.querySelector('video'); return v && v.videoWidth > 0; }, null, { timeout: 10000 });
  check('FACE: ライブ映像が出る（getUserMedia）', true);
  check('FACE: 前回の写真が30%で重なる（ゴースト）', await page.$eval('.cam-ghost', (e) => e.complete && e.naturalWidth > 0 && getComputedStyle(e).opacity === '0.3'));
  check('FACE: 輪郭ガイドが出る', await page.isVisible('.cam-guide'));
  await page.click('[data-ghost]');
  check('FACE: ゴーストを切り替えられる', await page.$eval('.cam-ghost', (e) => getComputedStyle(e).display === 'none'));
  await page.click('[data-ghost]');
  await page.click('[data-shoot]');
  await page.waitForSelector('[data-save]:visible');
  await page.click('[data-save]');
  await page.waitForFunction(() => location.hash.includes('#/face/cam/side') || location.hash === '#/face');
  const saved = await page.evaluate(async () => {
    const ph = await import('./js/photos.js');
    const b = await ph.get('2026-11-29', 'front');
    const bmp = await createImageBitmap(b);
    return { type: b.type, size: b.size, w: bmp.width, h: bmp.height, mirror: JSON.parse(localStorage.getItem('camp36:day:2026-11-29')).photos };
  });
  check('FACE: 撮影した写真が IndexedDB に JPEG・長辺1080pxで保存される', saved.type === 'image/jpeg' && Math.max(saved.w, saved.h) === 1080 && saved.mirror.front === true, `${saved.w}x${saved.h} ${Math.round(saved.size / 1024)}KB`);

  // --- フォールバック撮影（カメラが使えない環境） ---
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }); });
  await p2.goto(`${BASE}/?date=2026-11-29#/face/cam/side`);
  await p2.waitForSelector('.cam-msg:not([hidden])');
  check('FACE: カメラが使えない時はファイル撮影に切り替わる', await p2.$eval('.cam-msg input[type=file]', (e) => e.accept === 'image/*' && e.getAttribute('capture') === 'user'));
  const big = path.join(tmp, 'big.jpg');
  const jpg = await p2.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 4000;
    const x = c.getContext('2d'); x.fillStyle = '#665'; x.fillRect(0, 0, 3000, 4000); x.fillStyle = '#cba'; x.fillRect(900, 1000, 1200, 1800);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  fs.writeFileSync(big, Buffer.from(jpg, 'base64'));
  await p2.setInputFiles('.cam-msg input[type=file]', big);
  await p2.waitForSelector('[data-save]:visible');
  await p2.click('[data-save]');
  await p2.waitForFunction(() => location.hash === '#/face');
  const fb = await p2.evaluate(async () => {
    const ph = await import('./js/photos.js');
    const b = await ph.get('2026-11-29', 'side');
    const bmp = await createImageBitmap(b);
    return { w: bmp.width, h: bmp.height, type: b.type };
  });
  check('FACE: フォールバックの写真も長辺1080px・JPEGに縮小される', fb.w === 810 && fb.h === 1080 && fb.type === 'image/jpeg', `${fb.w}x${fb.h}`);
  await p2.close();

  // --- 比較スライダー・タイムラプス・削除 ---
  await open('2026-11-29', 'face/compare', '.cmp');
  const sel = await page.$$eval('[data-sel]', (els) => els.map((e) => e.value));
  check('比較: 既定は DAY 0 と最新', sel[0] === '2026-11-17' && sel[1] === '2026-11-29', sel.join(' vs '));
  await page.$eval('[data-pos]', (e) => { e.value = 20; e.dispatchEvent(new Event('input', { bubbles: true })); });
  check('比較: スライダーで境目が動く', await page.$eval('.cmp', (e) => e.style.getPropertyValue('--p') === '20%') && await page.$eval('.cmp-b', (e) => getComputedStyle(e).clipPath.includes('20%')));
  const box = await page.$eval('.cmp', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(box.x + box.w * 0.2, box.y + box.h / 2); await page.mouse.down(); await page.mouse.move(box.x + box.w * 0.75, box.y + box.h / 2, { steps: 4 }); await page.mouse.up();
  check('比較: 写真の上をドラッグしても動く', Math.abs(parseFloat(await page.$eval('.cmp', (e) => e.style.getPropertyValue('--p'))) - 75) < 2);
  await page.selectOption('[data-sel="a"]', '2026-11-20');
  await page.waitForFunction(() => document.querySelector('.cmp-l.a small').textContent === 'DAY 3');
  check('比較: 日付を選び直せる', true);

  await open('2026-11-29', 'face/lapse', '.lapse');
  const f0 = await page.textContent('[data-tag]');
  await page.$eval('[data-speed]', (e) => { e.value = 10; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('[data-play]');
  await page.waitForFunction((t) => document.querySelector('[data-tag]').textContent !== t, f0, { timeout: 3000 });
  check('タイムラプス: 再生でコマが進む・速度を変えられる', (await page.textContent('[data-fps]')) === '10枚/秒');
  await page.click('[data-play]');
  const f1 = await page.textContent('[data-tag]');
  await page.waitForTimeout(400);
  check('タイムラプス: 止められる', (await page.textContent('[data-tag]')) === f1);

  await open('2026-11-29', 'face', '.cal');
  check('一覧: カレンダーに撮った日が出る', (await page.$$('.cal-c.has')).length === 12, `${(await page.$$('.cal-c.has')).length}日`);
  await page.click('.cal-c[data-day="3"]');
  await page.click('.sheet [data-del="front"]');
  await page.click('.sheet [data-ok]');
  await page.waitForFunction(async () => { const ph = await import('./js/photos.js'); return !(await ph.get('2026-11-20', 'front')); });
  check('一覧: 写真を削除できる', true);

  // --- 動画 ---
  await open('2026-11-29', 'video', '.yt', '&timer=2');
  check('動画: youtube-nocookie の埋め込み（playsinline）', (await page.getAttribute('.yt iframe', 'src')) === 'https://www.youtube-nocookie.com/embed/1TJsmqiBEpo?playsinline=1');
  check('動画: YouTube で開くボタン', (await page.getAttribute('a[href^="https://youtu.be"]', 'href')) === 'https://youtu.be/1TJsmqiBEpo');
  check('動画: タイマーが終わるまで完了は押せない', await page.isDisabled('[data-done]'));
  await page.click('[data-toggle]');
  await page.waitForFunction(() => !document.querySelector('[data-done]').disabled, null, { timeout: 5000 });
  await page.click('[data-done]');
  check('動画: 完了でチェックが付き連続日数が出る', await page.evaluate(() => JSON.parse(localStorage.getItem('camp36:day:2026-11-29')).checks.video === true) && +(await page.textContent('[data-streak]')) >= 1, `連続 ${await page.textContent('[data-streak]')}日`);
  await page.fill('[data-memo]', '後半の首がきつい');
  await open('2026-11-29', 'video', '.yt');
  check('動画: メモが残る・既定は 07:00', (await page.inputValue('[data-memo]')) === '後半の首がきつい' && (await page.textContent('[data-time]')) === '07:00');
  // 回線越しだと読み込みに時間がかかるので、プレーヤーの中身が出るまで待つ
  const yt = await page.frameLocator('.yt iframe').locator('body').waitFor({ state: 'attached', timeout: 15000 }).then(() => true).catch(() => false);
  check('動画: iframe が読み込まれる', yt);

  // --- ジム ---
  await open('2026-11-29', 'gym', '.ex');           // DAY 12（日）
  const lastTxt = await page.textContent('.ex .ex-last');
  const sugTxt = await page.textContent('.ex .ex-sug');
  check('ジム: 前回の重量×回数が出る', /kg × \d+/.test(lastTxt), lastTxt.replace(/\s+/g, ' ').trim());
  check('ジム: 次回の提案が出る', /1段上げ|\+1回/.test(sugTxt), sugTxt.trim());
  const ph0 = await page.getAttribute('.ex .set [data-r]', 'placeholder');
  await page.click('.ex .set [data-ok]');
  check('ジム: 1タップで提案値が入りセット完了になる', (await page.inputValue('.ex .set [data-r]')) === ph0 && await page.$eval('.ex .set', (e) => e.classList.contains('is-done')));
  check('ジム: セット完了で休憩タイマーが動く', await page.$eval('.rest', (e) => e.classList.contains('run')) && /^0[01]:\d\d$/.test(await page.textContent('[data-rest-time]')), await page.textContent('[data-rest-time]'));
  const t1 = await page.textContent('[data-rest-time]');
  await page.waitForTimeout(1300);
  check('ジム: 休憩タイマーが減っていく', (await page.textContent('[data-rest-time]')) !== t1);
  await page.click('[data-rest-go]');
  await page.click('.ex:nth-of-type(2) [data-fill]');
  await page.waitForSelector('.ex');
  const filled = await page.$$eval('.ex:nth-of-type(2) [data-r]', (els) => els.map((e) => e.value));
  check('ジム: 「前回＋提案を入れる」で全セットに入る', filled.every((v) => v !== ''), filled.join(','));
  await page.fill('.ex:nth-of-type(2) .set [data-w]', '42.5');
  await page.fill('[data-rec="fat"]', '18.4');
  await page.click('[data-finish]');
  await page.reload(); await page.waitForSelector('.ex');
  const g = await page.evaluate(() => ({ g: JSON.parse(localStorage.getItem('camp36:gym:2026-11-29')), d: JSON.parse(localStorage.getItem('camp36:day:2026-11-29')) }));
  const second = Object.keys(g.g.sets)[1];
  check('ジム: 記録・完了・体組成が保存され TODAY に入る', g.g.done === true && g.g.sets[second][0].w === 42.5 && g.d.fat === 18.4, `${second}: ${JSON.stringify(g.g.sets[second][0])}`);
  await open('2026-11-29', 'today', '.hero');
  check('ジム: 完了すると TODAY のジム項目が付く', await page.$eval('[data-check="gym"]', (e) => e.classList.contains('is-done')));
  await open('2026-11-30', 'gym', '.page-h');       // 月曜＝オフ
  check('ジム: オフの日はオフ表示と次回の予定', (await page.textContent('#view')).includes('NEXT') && (await page.$$('.ex')).length === 0);

  // --- 週次レビュー・体重グラフ ---
  await seed(page, 21, { todayPartial: false, photos: false });
  await open('2026-12-08', 'roadmap', '.rv');
  check('ROADMAP: 体重グラフ（点＋7日平均の線）', (await page.$$('.chart .pt')).length === 22 && (await page.$$('.chart .ma')).length === 1);
  const rv = await page.$$eval('.rv', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  check('ROADMAP: 週次レビューが3週分出る（平均・前週比・達成率・調整）', rv.length === 3 && rv.every((t) => /7日平均/.test(t) && /来週の調整/.test(t)), rv[0].slice(0, 110));
  const wk = await page.evaluate(async () => {
    const calc = await import('./js/calc.js'); const store = await import('./js/store.js'); const { dateOfDay } = await import('./js/dates.js');
    const out = {};
    const set = (k, v) => { for (let i = 7 * k - 6; i <= 7 * k; i++) store.saveDay(dateOfDay(i), { weight: v }); };
    set(1, 70.0); set(2, 69.5); out.keep = calc.weeklyReview(2).kind;
    set(2, 69.9); const slow = calc.weeklyReview(2); out.slow = slow.kind; out.slowOpts = slow.options.map((o) => o.id).join(',');
    set(2, 68.7); out.fastOnce = calc.weeklyReview(2).kind;
    set(3, 67.5); out.fastTwice = calc.weeklyReview(3).kind;
    const t0 = calc.targets().intake; calc.applyReview(2, 'kcal-'); out.cut = t0 - calc.targets().intake;
    calc.applyReview(2, 'steps+'); out.back = t0 - calc.targets().intake; out.steps = calc.stepsTarget(15);
    calc.applyReview(2, null); out.undo = calc.stepsTarget(15);
    return out;
  });
  check('週次レビュー: 調整ルール（継続／0.3kg未満／1.0kg超が続く）', wk.keep === 'keep' && wk.slow === 'slow' && wk.slowOpts === 'kcal-,steps+' && wk.fastOnce === 'fastish' && wk.fastTwice === 'fast', JSON.stringify(wk));
  check('週次レビュー: 選んだ調整が目標に反映され、取り消せる', wk.cut === 150 && wk.back === 0 && wk.steps === 12000 && wk.undo === 10000);
  check('ROADMAP: むくみの答え合わせ表', (await page.$$('.bl tbody tr')).length === 4);

  // --- .ics / バックアップ ---
  await seed(page, 5, { todayPartial: false });
  await open('2026-11-22', 'settings', '[data-ics]');
  const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('[data-ics]')]);
  const ics = fs.readFileSync(await dl1.path(), 'utf8');
  const nEv = (ics.match(/BEGIN:VEVENT/g) || []).length;
  check('.ics: 書き出せる（朝の計測・顔トレ・ジム＋通知）', dl1.suggestedFilename() === 'camp36.ics' && ics.startsWith('BEGIN:VCALENDAR') && ics.trim().endsWith('END:VCALENDAR') && nEv > 80 && (ics.match(/BEGIN:VALARM/g) || []).length === nEv && ics.includes('DTSTART:20261122T220000Z') && /SUMMARY:CAMP 36 ジム/.test(ics) && ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), `${nEv}件`);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-export]')]);
  const bpath = path.join(tmp, 'backup.json');
  await dl2.saveAs(bpath);
  const backup = JSON.parse(fs.readFileSync(bpath, 'utf8'));
  check('バックアップ: JSON に記録と写真（Base64）が入る', backup.app === 'camp36' && Object.keys(backup.data).some((k) => k.startsWith('day:')) && backup.photos.length === 10 && backup.photos[0].data.startsWith('data:image/jpeg;base64,'), `${Math.round(fs.statSync(bpath).size / 1024)}KB / 写真${backup.photos.length}枚`);
  await page.evaluate(async () => { localStorage.clear(); const ph = await import('./js/photos.js'); await ph.clear(); });
  await page.goto(`${BASE}/?date=2026-11-22`); await page.reload(); await page.waitForSelector('.poster');
  await page.setInputFiles('[data-restore]', bpath);
  await page.click('.sheet [data-ok]');
  await page.waitForSelector('.hero', { timeout: 10000 });
  const restored = await page.evaluate(async () => { const ph = await import('./js/photos.js'); return { n: (await ph.all()).length, w: JSON.parse(localStorage.getItem('camp36:day:2026-11-20')).weight, why: JSON.parse(localStorage.getItem('camp36:settings')).why }; });
  check('バックアップ: 読み込みで記録と写真が戻る', restored.n === 10 && restored.w === backup.data['day:2026-11-20'].weight && restored.why === PROFILE.why, JSON.stringify(restored));

  // --- DAY 36 ---
  await seed(page, 36, { todayPartial: false });
  await open('2026-12-23', 'today', '.hero');
  check('DAY 36: まとめと手紙の入口が TODAY に出る', (await page.$$('a.notice.hot')).length === 2);
  await open('2026-12-23', 'final', '.fin');
  check('DAY 36: まとめ画面（写真比較・体重・ジムの伸び・達成率・ストリーク）', (await page.$$('.fin-ph img')).length === 4 && (await page.$$('.fin-g li')).length >= 4 && /達成率/.test(await page.textContent('.fin')) && /最長ストリーク/.test(await page.textContent('.fin')));
  await open('2026-12-23', 'letter', '[data-open]');
  await page.click('[data-open]'); await page.waitForSelector('.letter');
  check('DAY 36: 手紙を開封できる', (await page.textContent('.letter-body')).includes('胸を張れ'));

  check('機能テスト中の JavaScript エラーなし', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();

  // --- PWA・オフライン ---
  const pctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const pp = await pctx.newPage();
  await pp.goto(`${BASE}/`);
  await pp.evaluate(async () => { await navigator.serviceWorker.ready; });
  await pp.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).length >= 30, null, { timeout: 15000 });
  const man = await pp.evaluate(async () => {
    const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
    const icons = await Promise.all(m.icons.map(async (i) => { const r = await fetch(i.src); const b = await createImageBitmap(await r.blob()); return `${b.width}x${b.height}`; }));
    return { name: m.name, display: m.display, theme: m.theme_color, icons, apple: !!document.querySelector('link[rel=apple-touch-icon]'), capable: document.querySelector('meta[name=apple-mobile-web-app-capable]').content };
  });
  check('PWA: manifest（CAMP 36 / standalone / 黒 / 192・512 アイコン）', man.name === 'CAMP 36' && man.display === 'standalone' && man.theme === '#0F0F0E' && man.icons.includes('192x192') && man.icons.includes('512x512') && man.apple && man.capable === 'yes', JSON.stringify(man));
  await pp.evaluate(() => { localStorage.setItem('camp36:settings', JSON.stringify({ setupDone: true, height: 172, weight: 70, age: 27, activity: 1.375, machines: ['chest'], gymDays: [3, 5, 0, 2], why: 'offline', rules: [] })); });
  await pctx.setOffline(true);
  await pp.goto(`${BASE}/?date=2026-12-01#/today`).catch(() => {});
  await pp.reload().catch(() => {});
  const off = await pp.waitForSelector('.hero', { timeout: 8000 }).then(() => true).catch(() => false);
  check('PWA: オフラインで起動できる', off);
  if (off) {
    for (const h of ['gym', 'roadmap', 'book', 'face', 'settings']) {
      await pp.evaluate((x) => { location.hash = '#/' + x; }, h);
      await pp.waitForTimeout(300);
    }
    const fonts = await pp.evaluate(async () => { await document.fonts.ready; return ['400 20px Anton', '700 16px "Zen Kaku Gothic New"', '900 16px "Zen Kaku Gothic New"', '600 16px "IBM Plex Mono"'].map((f) => document.fonts.check(f, 'DAY 36 計量日')); });
    check('PWA: オフラインでも全タブとフォントが出る', (await pp.textContent('#view')).length > 50 && fonts.every(Boolean), fonts.join(','));
  }
  await pctx.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    if (ONLY === 'all' || ONLY === 'func') await func(browser);
    if (ONLY === 'all' || ONLY === 'shots') await shots(browser);
  } finally {
    await browser.close();
  }
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length} passed / ${fail.length} failed`);
  if (fail.length) { console.log(fail.map((f) => ` - ${f.name}  ${f.detail}`).join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
