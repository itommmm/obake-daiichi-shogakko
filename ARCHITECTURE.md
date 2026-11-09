# ARCHITECTURE — 技術構成とデータフロー

更新：2026-11-09　根拠：`main` の実装ファイルとビルド用スクリプト

## 1. 全体像

GitHub Pagesで配信する**静的Webアプリ**。3D版・PS1版はブラウザのJavaScript／WebGL、レトロ版はPyxel 3.0（Python）を用いる。専用バックエンド、DB、フロントエンドビルド基盤は現状ない。

| エントリ | 主技術 | 配信・起動 |
|---|---|---|
| `index.html` | HTML/CSS/JavaScript、Three.js r147、Web Audio API | ブラウザで3Dシューティング |
| `ps1.html` | HTML/CSS、Three.js 0.147.0、WebGLレンダーターゲット320×240、Canvas HUD、Web Audio API | ブラウザでPS1風探索 |
| `retro/main.py` | Python、Pyxel 3.0.0、`retro/font.bdf` | `retro.pyxapp` と `retro.html` を生成 |
| `retro.html` | Pyxel 3.0.0 ブラウザランタイム、生成済みアプリのbase64埋込 | ブラウザでレトロ版 |
| `pad.html` | JavaScript、PeerJS 1.5.4／WebRTC、端末のモーション入力 | 3D版のiPhoneコントローラー（任意） |

CDNやGoogle Fontsの読み込みにはネット接続が必要。`pad.html` の接続にはPeerJSのシグナリングも関係する。

## 2. ディレクトリ

~~~text
/
├── index.html             # 3D版ゲーム
├── pad.html               # 外部コントローラー
├── ps1.html               # PS1版の画面とスクリプト読込順
├── ps1/
│   ├── engine.js          # 共有ゲーム状態G、WebGL/Canvas/素材/基本音響
│   ├── rooms.js           # 5エリアの形状・扉・アイテム・当たり判定・カメラ
│   ├── controls.js        # 左仮想スティック入力
│   ├── adventure-ui.js    # マーカー、簡単探索、自動経路、拡大UI
│   ├── comic-horror.js    # 無ダメージ驚かし・環境音
│   ├── logic.js           # 進行、移動、謎解き、保存、HUD、ゲームループ
│   └── style.css          # 固定カメラGUIの見た目
├── retro/
│   ├── main.py            # Pyxel版ソース
│   ├── font.bdf           # 日本語のサブセットフォント
│   └── *.png              # スプライト・背景素材
├── retro.pyxapp           # 生成物
├── retro.html             # 生成物を埋め込んだブラウザ版
├── assets/                # ゲーム画像・アイコン
├── tools/                 # 画像処理・ビルド・回帰テスト
├── docs/                  # ストーリー正本・過去のQA記録
├── STORY.md               # せりふ
└── PRD / ARCHITECTURE / DESIGN / RULES / TASKS / PROGRESS
~~~

※ ドキュメント6件の実ファイル名はすべて末尾`.md`。

## 3. PS1版のロード順とデータフロー

`ps1.html` は以下の順に通常の`<script>`を読み込む。

1. Three.js → 2. `engine.js` → 3. `comic-horror.js` → 4. `controls.js` → 5. `rooms.js` → 6. `adventure-ui.js` → 7. `logic.js`

ES Modulesやバンドラーではなく、**同一グローバルスコープの依存**があるため順序を維持する。

~~~text
キーボード／仮想スティック／タップ
  ↓
controls.js / adventure-ui.js
  ↓
logic.js の update(dt) → ゲーム状態 G / ROOMS
  ├─ 衝突判定、移動、部屋・鍵・アイテム、謎解き
  ├─ adventure-ui.js の格子経路探索とマーカー更新
  ├─ comic-horror.js の驚かし・Web Audio
  └─ セーブ（localStorage）
  ↓
engine.js / rooms.js → Three.js描画 + Canvas HUD + DOM/CSS
~~~

`adventure-ui.js` は扉や仕掛けの**近くの歩行可能な床**を格子BFSで探す。経路が見つからないときは無理にワープしない。調査・拡大画面中はゲーム状態を切り替える。

## 4. 保存データ

- PS1のゲーム進行：`localStorage["obake-daiichi-ps1-v2"]`（部屋・座標・所持品・修復した部屋・驚かし既視聴など）。既存形式は互換を維持する。
- PS1の操作方式：`obake-ps1-controls-v4`。画面効果：`obake-ps1-fx`。音の保存有無は実装を確認してから変更する。
- 3D版やレトロ版は別々の状態管理。**各版のセーブを混ぜない**。
- localStorageは端末／ブラウザごと。サーバーへの同期機能はない。

## 5. レトロ版の生成手順

`retro/main.py` を変更したら、Pyxel 3.0.0 がある開発環境で次を実行する。

~~~bash
python3 tools/build_retro.py
python3 tools/test_retro.py
~~~

生成スクリプトが `retro/font.bdf`・`retro.pyxapp`・`retro.html` の埋込ペイロードを更新する。**ソースだけ変更して生成物を放置しない**。必要に応じて `pyxel play retro.pyxapp` でも動作確認する。

## 6. 検証とデプロイ

- 3D版：`tools/test_3d.js`・`tools/simulate_3d.js` はブラウザに読み込んで呼び出す回帰試験。
- PS1版：`tools/test_ps1.js` をブラウザに読み込み `runPS1Tests()` を実行する。ゲーム状態やセーブを変更し得るため**本番・大切なセーブのあるブラウザでは実行しない**。
- レトロ版：`python3 tools/test_retro.py` のヘッドレス試験とPyxel起動確認。
- GitHub Pages配信は行われているが、GitHub Actions／配信成功と実機通しプレイは別に判定する。
- 構成変更前後の比較対象を固定し、変更範囲に応じたテストを先に決める。

関連：[RULES.md](RULES.md)／[docs/PS1_GUI_QA.md](docs/PS1_GUI_QA.md)。
