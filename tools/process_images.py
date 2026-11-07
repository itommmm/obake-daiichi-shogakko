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
    names = [n for n in CHARAS + ("kousha",) if os.path.exists(os.path.join(A, "chara_%s.png" % n))]
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stamp-eyes", action="store_true", help="目の位置に白目＋ピンクの黒目を描きこむ（画像の目がずれているとき用）")
    ap.add_argument("--crop", type=int, nargs=4, metavar=("L", "T", "R", "B"), help="縮小前に切り出す範囲（元画像の座標）")
    ap.add_argument("--only", choices=("title", "board", "boss", "retro_title", "chara", "results", "icons", "og"))
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
    total = sum(os.path.getsize(os.path.join(A, f)) for f in ("title_bg.webp", "board_face.webp", "result_win.webp", "result_lose.webp")
                + tuple("chara_%s.webp" % n for n in CHARAS)
                if os.path.exists(os.path.join(A, f)))
    for f in ("boss_school.png", "title_bg.png", "over_bg.png"):
        f = os.path.join(ROOT, "retro", f)
        total += os.path.getsize(f) if os.path.exists(f) else 0
    print("ゲームが読む画像の合計: %d KB（目標 1024 KB 以下）" % (total // 1024))
    if total > 1024 * 1024:
        sys.exit("1MB をこえています")


if __name__ == "__main__":
    main()
