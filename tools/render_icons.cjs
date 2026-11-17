// icons/icon.svg から PNG（512 / 192 / apple-touch 180）を作る。
// 実行: NODE_PATH=<playwright-core のある node_modules> node tools/render_icons.cjs
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

(async () => {
  const root = path.resolve(__dirname, '..');
  const svg = fs.readFileSync(path.join(root, 'icons/icon.svg'), 'utf8');
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>*{margin:0}html,body{background:#0F0F0E}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: path.join(root, 'icons', name), clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log(name);
  }
  await browser.close();
})();
