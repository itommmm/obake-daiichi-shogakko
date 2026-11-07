"""生成画像をゲーム用に変換する。

使い方（リポジトリの一番上で）:
    python3 tools/process_images.py

入力（assets/ に置く。Codex などで生成したもの）
    assets/title_bg.png     1920x1080  → assets/title_bg.webp（品質80）
    assets/board_face.png   1024x512   → assets/board_face.webp（品質80）
    assets/boss_school.png  384x256 透過 → retro/boss_school.png（96x64・NIGHT 20色）
    assets/title_bg.png     → retro/title_bg.png（288x162・NIGHT 20色、レトロ版タイトルの背景）
    assets/chara_*.png 透過  → assets/chara_*.webp（192x192、3D版タイトルのキャラ絵）
    assets/result_win.png・result_lose.png 1920x1080 → .webp（3D版の結果画面）、retro/over_bg.png（レトロ版ゲームオーバー）
    assets/icon_app.png 1024x1024 → assets/icon_512/192/180/32.png（アイコン）
    assets/enemy_*.png 透過（16x16 マスのドット絵）→ retro/enemies.png（64x16・NIGHT 20色、レトロ版の敵4体）
    （生成なし）title_bg.png＋chara_*.png → assets/og.jpg（リンクのプレビュー画像 1200x630）

ボスは最近傍で 96x64 に縮小し、retro/main.py の NIGHT パレットへ減色する。
とうめい部分は色0（blt で抜ける色）、それ以外は色1〜19 だけを使う。
目（弱点）は retro/main.py の BOSS_EYES と同じ位置に来る必要がある。
目の中の白以外の色はピンクにそろえる。--stamp-eyes を付けると、その位置に白目＋黒目＋黒ふちを描きこむ。
"""
import argparse
import os
import sys

from PIL import Image, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")

NIGHT = [0x0B0820, 0x1D1440, 0x3A2370, 0x6B3FB0, 0xA65CFF, 0x5FE3FF, 0xF4F1FF, 0xFFD23F,
         0xFF5FB8, 0xE8433A, 0x173A2A, 0x2F6A44, 0x3B2C3E, 0x5E4A5A, 0x8A8AA0, 0x2A2448,
         0xFF8A2A, 0xFFD27A, 0x7A3010, 0x6A78B8]
RGB = [((c >> 16) & 255, (c >> 8) & 255, c & 255) for c in NIGHT]
D1, WH, PK = 1, 6, 8
BOSS_EYES = ((19, 36, 9, 9), (68, 36, 9, 9))   # retro/main.py と同じ（生成画像の白い窓の内側）


def webp(name, size):
    src = os.path.join(A, name + ".png")
    im = Image.open(src).convert("RGB")
    if im.size != size:
        im = im.resize(size, Image.LANCZOS)
    dst = os.path.join(A, name + ".webp")
    im.save(dst, "WEBP", quality=80, method=6)
    print("%s -> %s  %d KB" % (src, dst, os.path.getsize(dst) // 1024))


def nearest(rgb):
    r, g, b = rgb
    best, bi = None, 1
    for i in range(1, len(RGB)):          # 色0 はとうめい専用
        pr, pg, pb = RGB[i]
        d = (r - pr) ** 2 * 3 + (g - pg) ** 2 * 4 + (b - pb) ** 2 * 2
        if best is None or d < best:
            best, bi = d, i
    return bi


def boss(stamp_eyes, crop):
    src = Image.open(os.path.join(A, "boss_school.png")).convert("RGBA")
    if crop:
        src = src.crop(crop)
    small = src.resize((96, 64), Image.NEAREST)
    idx = [[0] * 96 for _ in range(64)]
    for y in range(64):
        for x in range(96):
            r, g, b, a = small.getpixel((x, y))
            idx[y][x] = nearest((r, g, b)) if a >= 128 else 0
    # 目の中の黒目（白以外の色）はピンクにそろえる。"angry" ではゲーム側でこれを赤にする
    for ex, ey, ew, eh in BOSS_EYES:
        for y in range(ey, ey + eh):
            for x in range(ex, ex + ew):
                if idx[y][x] not in (WH, 0):
                    idx[y][x] = PK
    if stamp_eyes:
        for ex, ey, ew, eh in BOSS_EYES:
            for y in range(ey, ey + eh):
                for x in range(ex, ex + ew):
                    edge = x in (ex, ex + ew - 1) or y in (ey, ey + eh - 1)
                    pupil = ex + 3 <= x < ex + 8 and ey + 2 <= y < ey + 8
                    idx[y][x] = D1 if edge else (PK if pupil else WH)
    out = Image.new("RGB", (96, 64))
    for y in range(64):
        for x in range(96):
            out.putpixel((x, y), RGB[idx[y][x]])
    dst = os.path.join(ROOT, "retro", "boss_school.png")
    out.save(dst, optimize=True)
    used = sorted({c for row in idx for c in row})
    print("%s  %d bytes  使った色: %s" % (dst, os.path.getsize(dst), used))
    for n, (ex, ey, ew, eh) in enumerate(BOSS_EYES):
        pk = sum(idx[y][x] == PK for y in range(ey, ey + eh) for x in range(ex, ex + ew))
        print("目%d（x%d-%d, y%d-%d）のピンクのドット数: %d" % (n, ex, ex + ew - 1, ey, ey + eh - 1, pk))
    return out


def retro_title():
    """タイトル背景を レトロ版の画面（288x162）に縮めて NIGHT パレットへ減色（ディザなし）"""
    src = Image.open(os.path.join(A, "title_bg.png")).convert("RGB").resize((288, 162), Image.LANCZOS)
    src = ImageEnhance.Contrast(src).enhance(1.15)
    # 下ほど暗く（3D版と同じく、上に重ねる文字を読みやすくする）
    px = src.load()
    for y in range(162):
        k = 1.0 if y < 96 else 1.0 - 0.5 * (y - 96) / 66
        for x in range(288):
            r, g, b = px[x, y]
            px[x, y] = (int(r * k), int(g * k), int(b * k))
    pal = Image.new("P", (1, 1))
    flat = [v for c in RGB for v in c]
    pal.putpalette(flat + list(RGB[0]) * (256 - len(RGB)))
    out = src.quantize(palette=pal, dither=Image.Dither.NONE).convert("RGB")
    dst = os.path.join(ROOT, "retro", "title_bg.png")
    out.save(dst, optimize=True)
    print("%s  %d KB" % (dst, os.path.getsize(dst) // 1024))


CHARAS = ("randoseru", "isu", "tsukue", "locker", "kousha")


def charas():
    """キャラ絵（透過 PNG）を 192x192 の透過 WebP に。無いものは飛ばす"""
    for n in CHARAS:
        src = os.path.join(A, "chara_%s.png" % n)
        if not os.path.exists(src):
            print("（なし）", src)
            continue
        im = Image.open(src).convert("RGBA")
        bb = im.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
        if bb:
            im = im.crop(bb)
        side = max(im.size)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
        sq = sq.resize((192, 192), Image.LANCZOS)
        dst = os.path.join(A, "chara_%s.webp" % n)
        sq.save(dst, "WEBP", quality=85, method=6)
        print("%s -> %s  %d KB" % (src, dst, os.path.getsize(dst) // 1024))


def to_night(im, size, dark_from=None, dark_k=0.5):
    """画像を NIGHT パレットへ減色（ディザなし）。dark_from より下を だんだん暗く"""
    src = ImageEnhance.Contrast(im.convert("RGB").resize(size, Image.LANCZOS)).enhance(1.15)
    if dark_from is not None:
        px = src.load()
        for y in range(dark_from, size[1]):
            k = 1.0 - dark_k * (y - dark_from) / (size[1] - dark_from)
            for x in range(size[0]):
                r, g, b = px[x, y]
                px[x, y] = (int(r * k), int(g * k), int(b * k))
    pal = Image.new("P", (1, 1))
    pal.putpalette([v for c in RGB for v in c] + list(RGB[0]) * (256 - len(RGB)))
    return src.quantize(palette=pal, dither=Image.Dither.NONE).convert("RGB")


def results():
    """結果画面の背景（3D版）と、レトロ版ゲームオーバーの背景"""
    for n in ("result_win", "result_lose"):
        if os.path.exists(os.path.join(A, n + ".png")):
            webp(n, (1920, 1080))
        else:
            print("（なし）", n)
    src = os.path.join(A, "result_lose.png")
    if os.path.exists(src):
        out = to_night(Image.open(src), (288, 162))
        dst = os.path.join(ROOT, "retro", "over_bg.png")
        out.save(dst, optimize=True)
        print("%s  %d KB" % (dst, os.path.getsize(dst) // 1024))


def icons():
    """アプリのアイコン（3D版・コントローラー）"""
    src = os.path.join(A, "icon_app.png")
    if not os.path.exists(src):
        print("（なし）", src)
        return
    im = Image.open(src).convert("RGB")
    for n in (512, 192, 180, 32):
        dst = os.path.join(A, "icon_%d.png" % n)
        im.resize((n, n), Image.LANCZOS).save(dst, optimize=True)
        print(dst, os.path.getsize(dst) // 1024, "KB")


def og():
    """リンクのプレビュー画像（1200x630）：タイトル背景＋キャラ絵を下にならべる。文字は og:title で出るので入れない"""
    bg = Image.open(os.path.join(A, "title_bg.png")).convert("RGB")
    w, h = 1200, 630
    s = max(w / bg.width, h / bg.height)
    bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
    top = int((bg.height - h) * 0.3)
    bg = bg.crop(((bg.width - w) // 2, top, (bg.width - w) // 2 + w, top + h)).convert("RGBA")
    shade = Image.new("RGBA", (w, h))
    for y in range(h):
        a = int(170 * max(0, (y - h * 0.45) / (h * 0.55)))
        for x in range(w):
            shade.putpixel((x, y), (6, 3, 16, a))
    bg.alpha_composite(shade)
    names = [n for n in CHARAS if os.path.exists(os.path.join(A, "chara_%s.png" % n))]
    size = 230 if len(names) <= 4 else 200
    gap = (w - size * len(names)) // (len(names) + 1)
    for i, n in enumerate(names):
        c = Image.open(os.path.join(A, "chara_%s.png" % n)).convert("RGBA")
        bb = c.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
        c = c.crop(bb)
        k = size / max(c.size)
        c = c.resize((round(c.width * k), round(c.height * k)), Image.LANCZOS)
        x = gap + i * (size + gap) + (size - c.width) // 2
        y = h - 28 - c.height - (14 if i % 2 else 0)
        bg.alpha_composite(c, (x, y))
    dst = os.path.join(A, "og.jpg")
    bg.convert("RGB").save(dst, quality=84, optimize=True)
    print(dst, os.path.getsize(dst) // 1024, "KB")


ENEMIES = ("randoseru", "isu", "ball", "uwabaki")   # retro/main.py の ENEMY_SPR の順（16x16 を横にならべる）


def _grid_1d(D, lo, hi):
    """色が変わる位置の強さ D（1次元）から、マスの大きさ c と ずれ o を推定。
    変わり目のうち マスのさかい目（±1px）に乗る割合が最大のものをえらび、ほぼ同じなら大きい c をとる
    （c/2 でも全部 乗ってしまうため。2c だと半分しか乗らないので えらばれない）"""
    import numpy as np
    total = D.sum() or 1
    cand = []
    for c in np.arange(lo, hi, 0.25):
        for o in np.arange(0, c, 0.5):
            pos = np.round(np.arange(o, len(D), c)).astype(int)
            pos = np.unique(pos[pos < len(D)])
            hit = sum(D[max(0, p - 1):p + 2].sum() for p in pos)   # さかい目の ±1px に乗った変わり目
            cand.append((min(1.0, hit / total), c, o))
    best = max(m for m, _, _ in cand)
    return max(((c, o) for m, c, o in cand if m >= best * 0.92), key=lambda t: t[0])


def pixel_sprite(path, cells=16):
    """ドット絵ふうの生成画像を 16x16 マスに。マスの大きさ・ずれを画像から推定し、
    各マスの内側で いちばん多い NIGHT の色をとる（とうめいが半分以上なら とうめい）"""
    import numpy as np
    im = Image.open(path).convert("RGBA")
    W, H = im.size
    a = np.array(im)
    lut = {}
    idx = np.zeros((H, W), dtype=np.int16)
    for y in range(H):
        for x in range(W):
            r, g, b, al = a[y, x]
            if al < 128:
                continue
            key = (int(r) >> 3, int(g) >> 3, int(b) >> 3)
            if key not in lut:
                lut[key] = nearest((int(r), int(g), int(b)))
            idx[y, x] = lut[key]
    cx, ox = _grid_1d((idx[:, 1:] != idx[:, :-1]).sum(0).astype(float), 8, 33)
    cy, oy = _grid_1d((idx[1:, :] != idx[:-1, :]).sum(1).astype(float), 8, 33)
    ox, oy = ox + 1, oy + 1          # D[x] は x と x+1 のあいだ
    gx0 = int(np.floor(-ox / cx))
    gy0 = int(np.floor(-oy / cy))
    nx, ny = int(np.ceil((W - ox) / cx)) - gx0, int(np.ceil((H - oy) / cy)) - gy0
    grid = np.zeros((ny, nx), dtype=np.int16)
    for j in range(ny):
        for i in range(nx):
            x0, x1 = ox + (gx0 + i) * cx, ox + (gx0 + i + 1) * cx
            y0, y1 = oy + (gy0 + j) * cy, oy + (gy0 + j + 1) * cy
            xs = slice(max(0, int(x0 + cx * .25)), min(W, int(x1 - cx * .25) + 1))
            ys = slice(max(0, int(y0 + cy * .25)), min(H, int(y1 - cy * .25) + 1))
            blk = idx[ys, xs].ravel()
            if blk.size and (blk > 0).sum() * 2 >= blk.size:
                v = np.bincount(blk[blk > 0])
                grid[j, i] = int(v.argmax())
    ys_, xs_ = np.nonzero(grid)
    grid = grid[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1]
    gh, gw = grid.shape
    if gw > cells or gh > cells:
        print("  注意：%s は %dx%d マスあったので 16x16 に収まるよう けずった" % (os.path.basename(path), gw, gh))
        grid = grid[max(0, gh - cells):, max(0, (gw - cells) // 2):max(0, (gw - cells) // 2) + cells]
        gh, gw = grid.shape
    out = [[0] * cells for _ in range(cells)]
    ox2, oy2 = (cells - gw) // 2, cells - gh - (1 if gh < cells else 0)   # 下ぞろえ（いちばん下は1マスあける）
    for y in range(gh):
        for x in range(gw):
            out[oy2 + y][ox2 + x] = int(grid[y, x])
    print("  %s：マス %.2fx%.2f px、%dx%d マス" % (os.path.basename(path), cx, cy, gw, gh))
    return out


def retro_enemies():
    """レトロ版の敵4体（assets/enemy_*.png）→ retro/enemies.png（64x16、NIGHT パレット、とうめい=色0）"""
    paths = [os.path.join(A, "enemy_%s.png" % n) for n in ENEMIES]
    if not all(os.path.exists(p) for p in paths):
        print("（なし）", [p for p in paths if not os.path.exists(p)])
        return
    sheet = Image.new("RGB", (16 * len(ENEMIES), 16), RGB[0])
    big = Image.new("RGB", (16 * len(ENEMIES) * 8 + 8 * (len(ENEMIES) - 1), 16 * 8), (40, 40, 60))
    for i, p in enumerate(paths):
        grid = pixel_sprite(p)
        for y in range(16):
            for x in range(16):
                c = grid[y][x]
                sheet.putpixel((i * 16 + x, y), RGB[c])
                if c:
                    for dy in range(8):
                        for dx in range(8):
                            big.putpixel((i * 136 + x * 8 + dx, y * 8 + dy), RGB[c])
    dst = os.path.join(ROOT, "retro", "enemies.png")
    sheet.save(dst, optimize=True)
    big.save(os.path.join(A, "enemies_preview.png"))
    print("%s  %d bytes（拡大の見本: assets/enemies_preview.png）" % (dst, os.path.getsize(dst)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stamp-eyes", action="store_true", help="目の位置に白目＋ピンクの黒目を描きこむ（画像の目がずれているとき用）")
    ap.add_argument("--crop", type=int, nargs=4, metavar=("L", "T", "R", "B"), help="縮小前に切り出す範囲（元画像の座標）")
    ap.add_argument("--only", choices=("title", "board", "boss", "retro_title", "chara", "results", "icons", "og", "enemies"))
    a = ap.parse_args()
    if a.only in (None, "title"):
        webp("title_bg", (1920, 1080))
    if a.only in (None, "board"):
        webp("board_face", (1024, 512))
    if a.only in (None, "boss"):
        boss(a.stamp_eyes, a.crop)
    if a.only in (None, "retro_title"):
        retro_title()
    if a.only in (None, "chara"):
        charas()
    if a.only in (None, "results"):
        results()
    if a.only in (None, "icons"):
        icons()
    if a.only in (None, "og"):
        og()
    if a.only in (None, "enemies"):
        retro_enemies()
    total = sum(os.path.getsize(os.path.join(A, f)) for f in ("title_bg.webp", "board_face.webp", "result_win.webp", "result_lose.webp")
                + tuple("chara_%s.webp" % n for n in CHARAS)
                if os.path.exists(os.path.join(A, f)))
    for f in ("boss_school.png", "title_bg.png", "over_bg.png", "enemies.png"):
        f = os.path.join(ROOT, "retro", f)
        total += os.path.getsize(f) if os.path.exists(f) else 0
    print("ゲームが読む画像の合計: %d KB（目標 1024 KB 以下）" % (total // 1024))
    if total > 1024 * 1024:
        sys.exit("1MB をこえています")


if __name__ == "__main__":
    main()
