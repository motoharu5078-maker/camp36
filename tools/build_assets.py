#!/usr/bin/env python3
"""フォントのサブセット化とアイコン SVG の生成。

使い方:
    python3 -m venv .venv && .venv/bin/pip install fonttools brotli
    .venv/bin/python tools/build_assets.py <元フォント(TTF)のあるフォルダ>

元フォントは Google Fonts（github.com/google/fonts の ofl/ 以下）から取得したもの:
    Anton-Regular.ttf / ZenKaku-Bold.ttf / ZenKaku-Black.ttf / Plex-Regular.ttf / Plex-SemiBold.ttf

- Anton・IBM Plex Mono は英数字と記号だけに絞る。
- Zen Kaku Gothic New は「JIS 第1水準の漢字＋かな＋記号」と「アプリ内で実際に使っている文字」に絞る。
  （自由入力でそれ以外の漢字を打った場合は、端末の標準フォントで表示される）
- アイコンは Anton の字形をパスに変換して SVG にする（フォントなしでも同じ形で表示できる）。
"""
import pathlib
import sys

from fontTools import subset
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'fontsrc'
OUT = ROOT / 'fonts'
ICONS = ROOT / 'icons'

LATIN = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100)) | {
    0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x2212, 0x2190, 0x2192, 0x00D7, 0x30FB,
}


def app_chars():
    chars = set()
    for pattern in ('index.html', 'js/**/*.js', 'css/*.css', 'manifest.webmanifest'):
        for p in ROOT.glob(pattern):
            chars |= {ord(c) for c in p.read_text(encoding='utf-8')}
    return {c for c in chars if c >= 0x20}


def jis_level1():
    chars = set()
    for row in list(range(1, 9)) + list(range(16, 48)):       # 記号・かな・第1水準漢字
        for col in range(1, 95):
            try:
                chars.add(ord(bytes([0xA0 + row, 0xA0 + col]).decode('euc_jp')))
            except (UnicodeDecodeError, TypeError):
                pass
    return chars


def make(src, dst, unicodes):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.notdef_outline = True
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]              # 著作権・ライセンス表記は残す
    font = subset.load_font(str(SRC / src), opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=sorted(unicodes))
    sub.subset(font)
    subset.save_font(font, str(OUT / dst), opts)
    print(f'{dst}: {(OUT / dst).stat().st_size / 1024:.0f} KB')


def text_path(font, text, size, x, baseline):
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font['head'].unitsPerEm
    cx = x
    parts = []
    for ch in text:
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cx, baseline)))
        parts.append(pen.getCommands())
        cx += glyphs[name].width * scale
    return ' '.join(parts), cx - x


def icon():
    font = TTFont(str(SRC / 'Anton-Regular.ttf'))
    cap = font['OS/2'].sCapHeight / font['head'].unitsPerEm
    size = 236 / cap
    _, w = text_path(font, '36', size, 0, 0)
    d36, _ = text_path(font, '36', size, (512 - w) / 2, 384)
    tsize = 30 / cap
    _, tw = text_path(font, 'CAMP', tsize, 0, 0)
    dcamp, _ = text_path(font, 'CAMP', tsize, 100 + (150 - tw) / 2, 128)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0F0F0E"/>
  <g transform="rotate(-4 175 113)">
    <path fill="#D8CFB8" d="M100 90h150l-6 7 6 8-6 8 6 8-6 8 6 7H100l6-7-6-8 6-8-6-8 6-8z"/>
    <path fill="#0F0F0E" d="{dcamp}"/>
  </g>
  <path fill="#ECE8DF" d="{d36}"/>
  <rect x="{(512 - w) / 2:.1f}" y="402" width="{w:.1f}" height="18" fill="#E2492B"/>
</svg>
'''
    (ICONS / 'icon.svg').write_text(svg, encoding='utf-8')
    print('icons/icon.svg')


def main():
    OUT.mkdir(exist_ok=True)
    ICONS.mkdir(exist_ok=True)
    used = app_chars()
    make('Anton-Regular.ttf', 'anton.woff2', LATIN)
    make('Plex-Regular.ttf', 'plexmono-400.woff2', LATIN)
    make('Plex-SemiBold.ttf', 'plexmono-600.woff2', LATIN)
    jp = jis_level1() | used | LATIN
    make('ZenKaku-Bold.ttf', 'zenkaku-700.woff2', jp)
    make('ZenKaku-Black.ttf', 'zenkaku-900.woff2', jp)
    icon()


if __name__ == '__main__':
    main()
