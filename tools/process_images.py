"""生成画像をゲーム用に変換する。

使い方（リポジトリの一番上で）:
    python3 tools/process_images.py

入力（assets/ に置く。Codex などで生成したもの）
    assets/title_bg.png     1920x1080  → assets/title_bg.webp（品質80）
    assets/board_face.png   1024x512   → assets/board_face.webp（品質80）
    assets/boss_school.png  384x256 透過 → retro/boss_school.png（96x64・NIGHT 20色）

ボスは最近傍で 96x64 に縮小し、retro/main.py の NIGHT パレットへ減色する。
とうめい部分は色0（blt で抜ける色）、それ以外は色1〜19 だけを使う。
目（弱点）は retro/main.py の BOSS_EYES と同じ位置に来る必要がある。
目の中の白以外の色はピンクにそろえる。--stamp-eyes を付けると、その位置に白目＋黒目＋黒ふちを描きこむ。
"""
import argparse
import os
import sys

from PIL import Image

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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stamp-eyes", action="store_true", help="目の位置に白目＋ピンクの黒目を描きこむ（画像の目がずれているとき用）")
    ap.add_argument("--crop", type=int, nargs=4, metavar=("L", "T", "R", "B"), help="縮小前に切り出す範囲（元画像の座標）")
    ap.add_argument("--only", choices=("title", "board", "boss"))
    a = ap.parse_args()
    if a.only in (None, "title"):
        webp("title_bg", (1920, 1080))
    if a.only in (None, "board"):
        webp("board_face", (1024, 512))
    if a.only in (None, "boss"):
        boss(a.stamp_eyes, a.crop)
    total = sum(os.path.getsize(os.path.join(A, f)) for f in ("title_bg.webp", "board_face.webp")
                if os.path.exists(os.path.join(A, f)))
    total += os.path.getsize(os.path.join(ROOT, "retro", "boss_school.png")) if os.path.exists(
        os.path.join(ROOT, "retro", "boss_school.png")) else 0
    print("ゲームが読む画像の合計: %d KB（目標 1024 KB 以下）" % (total // 1024))
    if total > 1024 * 1024:
        sys.exit("1MB をこえています")


if __name__ == "__main__":
    main()
