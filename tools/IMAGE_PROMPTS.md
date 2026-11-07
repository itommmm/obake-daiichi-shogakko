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

---

# 第3弾：4枚を一気に（結果画面2枚・ボスのキャラ絵・アイコン）

下の「まとめて頼む文」を **そのまま1回** Codex に貼れば、4枚を順に作って保存し、push まで進めます。
（キャラ絵は第2弾と同じ絵柄にするため、共通の文を中に入れてあります）

```bash
git fetch && git checkout feature/gen-images-2 && git pull && codex
```

まとめて頼む文:

```
Use your built-in image generation tool to create the following 4 images, one after another,
and save each one exactly at the given path (PNG). Do not edit any other file.
When all 4 are saved, run:
  git add assets/result_win.png assets/result_lose.png assets/chara_kousha.png assets/icon_app.png
  git commit -m "第3弾の生成画像4枚を追加（結果画面2枚・おばけこうしゃ・アイコン）"
  git push origin feature/gen-images-2
Then tell me the tool / model name shown (if any) and the date.

Rules for ALL images: kids' game, cute-spooky ("kowa-kawa"), no text, no letters, no logos, no blood, no violence,
no real people's faces.

[1] assets/result_win.png — 1920x1080
Painterly digital illustration in the same style as a rainy-night anime school background, but now it is DAWN after the
storm: a Japanese elementary school with a clock tower, seen from the schoolyard, sunrise sky in warm pink, orange
and light blue, the rain has stopped, puddles reflect the sunrise, a faint rainbow. Many small glowing friendly ghost
souls (teardrop-shaped white-blue lights with tiny happy faces) float up into the sky, waving goodbye.
Two jack-o'-lantern street lamps on both sides, now switched off. No people. Keep the center of the image calm and
not too busy (a score panel will be placed on top of the center).

[2] assets/result_lose.png — 1920x1080
Painterly digital illustration, same style: inside a Japanese elementary school classroom at night, dim purple-blue
moonlight through the windows, rain outside. Mischievous cute haunted school objects are throwing a victory party:
a red school backpack ghost, a wooden chair ghost, a school desk ghost and a grey locker ghost with a small crown,
dancing on the desks with paper streamers and a chalkboard full of doodles. Playful, funny, NOT scary.
No people. Keep the center of the image calm and slightly darker (a panel will be placed on top of the center).

[3] assets/chara_kousha.png — 1024x1024, TRANSPARENT background
Generate an image, 1024x1024 PNG with a TRANSPARENT background.
Cute-spooky ("kowa-kawa") mascot character for a kids' game about haunted school objects at night.
One character only, centered, full body, slightly floating, 3/4 front view.
Chibi proportions, big round eyes, mischievous but friendly smile, thick clean dark outline, soft cel shading,
a faint purple ghostly glow around the body. No text, no letters, no background scenery, no shadow on the ground.
The character: "Obake Kousha", the final boss, a haunted small Japanese school BUILDING with a clock tower on top.
Purple walls, dark navy roof, warm yellow-orange windows. Two big windows are its eyes (white with pink pupils),
the entrance door is a grinning mouth with white teeth, the clock hands spin wildly. Biggest and proudest of all.

[4] assets/icon_app.png — 1024x1024, NOT transparent (fill the whole square)
App icon for the game. A rounded, bold, simple design that still reads at 32x32 pixels:
a cute white ghost peeking out from behind a glowing jack-o'-lantern, in front of a tiny school clock tower
silhouette, deep purple night background with a soft violet glow. Thick outlines, few colors, no small details,
no text. Keep important parts inside the central 80% (corners will be rounded by the phone).
```

できたら、このチャット（Claude）に「push した」と伝えてください。
