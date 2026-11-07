# 生成画像のプロンプト（Mac の Codex CLI 用）

このクラウド環境では Codex CLI が使えないため、画像3枚は Mac で生成して
`feature/gen-images` ブランチの `assets/` に入れてください。
（ファイル名はこのとおりに。サイズが少し違っても `tools/process_images.py` が合わせます）

## 手順（Mac のターミナル）

```bash
git clone https://github.com/itommmm/obake-daiichi-shogakko.git
```

```bash
cd obake-daiichi-shogakko && git checkout feature/gen-images
```

```bash
codex
```

Codex に下の3つを1つずつ頼み、`assets/` に PNG で保存してもらいます。
できたら次で push します。

```bash
git add assets/title_bg.png assets/board_face.png assets/boss_school.png && git commit -m "生成画像3枚を追加" && git push origin feature/gen-images
```

※ 生成に使ったサービス名・モデル名・日付も教えてください（README の利用条件欄に書きます）。

---

## 1. assets/title_bg.png（1920x1080）

```
Generate an image and save it as assets/title_bg.png, 1920x1080 PNG.
A cute-spooky ("kowa-kawa") children's game title background, Japanese elementary school at night in the rain,
seen from the schoolyard looking up at the building. Cool blue-violet night, warm glowing orange windows.
In the foreground, two street lamps whose lamp heads are jack-o'-lanterns, with sparks and soft smoke.
In some windows, silhouettes of friendly ghosts shaped like a school backpack (randoseru), a chair and a desk.
A clock tower on the roof showing 12 o'clock. Distant lightning in the sky.
Keep the top third of the image mostly empty sky (title text will be placed there).
No people, no text, no letters, no logos, no blood, no violence. Painterly digital illustration, for kids.
```

## 2. assets/board_face.png（1024x512）

```
Generate an image and save it as assets/board_face.png, 1024x512 PNG.
Only the surface of a green school chalkboard, filling the whole frame (no frame, no wall, no classroom).
On it, a big mischievous grinning ghost face drawn in white chalk lines: two big eyes and a wide toothy grin,
playful not scary. Smudgy chalk texture, faint eraser marks. No text, no letters, no blood.
```

## 3. assets/boss_school.png（384x256・背景とうめい）

```
Generate an image and save it as assets/boss_school.png, 384x256 PNG with a transparent background.
NES / Famicom style pixel art of a haunted school building boss "Obake Kousha", front view, centered,
filling the canvas. Big blocky pixels (it will be reduced to 96x64, so 1 art pixel = 4x4 image pixels),
about 6 colors (purple walls, dark navy roof, yellow-orange windows, white, pink), thick black outlines,
no anti-aliasing, no gradients. A small clock tower in the center top.
Two windows are its EYES: white squares with pink pupils, placed at left x=80..120, y=116..156
and right x=272..312, y=116..156. The entrance door at the bottom center is its MOUTH with white teeth.
No text.
```
