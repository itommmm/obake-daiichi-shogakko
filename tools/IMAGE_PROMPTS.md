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

---

# 第2弾：キャラ絵4枚（3D版タイトルのおばけ紹介に使う）

4枚とも同じ絵柄にするため、下の「共通」を毎回プロンプトの先頭に付けてください。
保存先は `assets/chara_randoseru.png`・`assets/chara_isu.png`・`assets/chara_tsukue.png`・`assets/chara_locker.png`。
できたら次で push します。

```bash
git checkout feature/gen-images-2 && git pull && git add assets/chara_*.png && git commit -m "キャラ絵4枚を追加" && git push origin feature/gen-images-2
```

共通（毎回先頭に付ける）:

```
Generate an image, 1024x1024 PNG with a TRANSPARENT background.
Cute-spooky ("kowa-kawa") mascot character for a kids' game about haunted school objects at night.
One character only, centered, full body, slightly floating, 3/4 front view.
Chibi proportions, big round eyes, mischievous but friendly smile, thick clean dark outline, soft cel shading,
a faint purple ghostly glow around the body. No text, no letters, no background scenery, no shadow on the ground,
no blood, no violence.
```

## 4. assets/chara_randoseru.png（ランドセロ）

```
The character: "Randosero", a haunted RED Japanese school backpack (randoseru) that came alive.
The flap is its face with two big eyes and a grinning mouth, the shoulder straps wiggle like little arms,
a wispy white ghost tail comes out of the bottom. Glossy red leather with gold clasp.
```

## 5. assets/chara_isu.png（いすわらし）

```
The character: "Isuwarashi", a haunted small wooden school chair (light brown wood seat and backrest,
dark grey metal legs). The backrest is its face with big eyes and a cheeky smile; it hops on its legs.
A small wispy white ghost tail floats behind it.
```

## 6. assets/chara_tsukue.png（つくえんぼ）

```
The character: "Tsukuenbo", a haunted Japanese school desk (wooden top, grey-purple metal frame and drawer box).
The front of the drawer box is its face with big sleepy-mischievous eyes and a toothy grin,
pencils and an eraser float around it. A wispy white ghost tail below.
```

## 7. assets/chara_locker.png（ロッカーだいおう）

```
The character: "Locker Daiou" (the Locker King), a BIG haunted grey steel school locker, the mid-boss.
Its door vents form angry-but-cute eyebrows and big glowing eyes, the slightly open door is a mouth with
a long playful tongue. A small golden crown on top. Purple ghostly aura, a bit bigger and bolder than the others.
```
