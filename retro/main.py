# おばけ第一小学校 レトロ版 ― こうていステージ（Pyxel 3.0）
# 夜の校庭を前へ進みながら、とんでくる おばけを みずでっぽうで たいじする。
# 最後は とりつかれた校舎（おばけこうしゃ）と対決。たおすと夜が明けて「あー よかった」。
#
# 操作：マウス／タッチで ねらう・おす（押しっぱなしで連射）、
#       キーボードは 矢印で ねらい移動・Z/スペースで うつ・Xで チャイム（わざ）
import math
import os
import random

import pyxel

W, H = 288, 162           # 16:9（テレビ向け）
FOV = 60
PITCH = 80                # 真下=0、水平=90
CAM_Z = 22                # 目の高さ（小学生の目線）
X0 = 1024                 # 校庭の中心（マップのピクセル座標）
FOCAL = (H / 2) / math.tan(math.radians(FOV) / 2)
PD = 40                   # 主人公が立っている位置（カメラの前方）
TOUCH_LIFT = 24           # スマホ：指で照準がかくれないよう、指より上に照準を出す


def is_touch_device():
    # ブラウザ（Pyodide）で動いているときだけ、タッチ画面かどうかを調べる
    try:
        import js  # noqa: Pyodide専用
        return bool(js.window.matchMedia("(pointer: coarse)").matches)
    except Exception:
        return False
BOSS_HP = 75
STAGE_LEN = 60 * 75       # ボスまでの道のり（中ボスの時間はふくまない、フレーム）
MID_AT = 60 * 38          # 中ボス「ランドセルだいおう」が出る地点
MID_HP = 18
AMMO_MAX = 30
RANKS = ((175000, "S"), (150000, "A"), (65000, "B"), (0, "C"))

# ---- パレット（16色）。夜と朝の2組を用意し、エンディングで夜→朝へ移り変わる ----
NIGHT = [0x0B0820, 0x1D1440, 0x3A2370, 0x6B3FB0, 0xA65CFF, 0x5FE3FF, 0xF4F1FF, 0xFFD23F,
         0xFF5FB8, 0xE8433A, 0x173A2A, 0x2F6A44, 0x3B2C3E, 0x5E4A5A, 0x8A8AA0, 0x2A2448,
         0xFF8A2A, 0xFFD27A, 0x7A3010, 0x6A78B8]   # 追加：あたたかい火の色3つ＋雨の色
DAY = [0x2A3A6A, 0x3A3A55, 0x6E7FD0, 0x8FA8FF, 0xC9D6FF, 0x8FE8FF, 0xFFFFFF, 0xFFD23F,
       0xFF8FC8, 0xE8433A, 0x3E8A4E, 0x6CC46A, 0xB98A5A, 0xE2C08C, 0xB8B8C8, 0x9FC8FF,
       0xFFA050, 0xFFE8B0, 0xA05020, 0x9FB0E0]
K, D1, PU, VI, LV, CY_, WH, GO, PK, RD, DG, GR, GD, SD, GY, DK = range(16)
OR, OY, OD, RN = 16, 17, 18, 19   # 火（オレンジ）・火（黄）・こげ茶・雨

# ---- ドット絵（1文字=1ドット）。'.' は とうめい ----
CMAP = {".": 0, "k": 1, "u": 2, "v": 3, "l": 4, "c": 5, "w": 6, "y": 7, "p": 8, "r": 9,
        "G": 10, "g": 11, "b": 12, "s": 13, "e": 14, "d": 15}


def art(img, x, y, rows, w=16):
    data = []
    for r in rows:
        r = r.ljust(w, ".")[:w]
        data.append("".join("%x" % CMAP[ch] for ch in r))
    img.set(x, y, data)


RANDOSERU = [
    "................",
    "....kkkkkkkk....",
    "...krrrrrrrrk...",
    "..krrrrrrrrrrk..",
    "..krwwwrrwwwrk..",
    "..krwkwrrwkwrk..",
    "..krrrrrrrrrrk..",
    "..kyyyyyyyyyyk..",
    "..krrrrrrrrrrk..",
    "..krrrkkkkrrrk..",
    "..krrrrrrrrrrk..",
    "..krrrrrrrrrrk..",
    "...kkkkkkkkkk...",
    "..l..ll..ll..l..",
    "...ll..ll..ll...",
    "................",
]
ISU = [
    "................",
    "...kkkkkkkkkk...",
    "...kbbbbbbbbk...",
    "...kbwwbbwwbk...",
    "...kbwkbbwkbk...",
    "...kbbbbbbbbk...",
    "...kbbpppbbbk...",
    "...kkkkkkkkkk...",
    "....ke....ek....",
    "..kkkkkkkkkkkk..",
    "..kbbbbbbbbbbk..",
    "..kkkkkkkkkkkk..",
    "...ke......ek...",
    "...ke......ek...",
    "..ll........ll..",
    "................",
]
BALL = [
    "................",
    ".....kkkkkk.....",
    "...kkwwwwwwkk...",
    "..kwwwwwwwwwwk..",
    "..kwwkwwwwkwwk..",
    ".kwwkkkwwkkkwwk.",
    ".kppppppppppppk.",
    ".kwwwwwppwwwwwk.",
    ".kwwwwppppwwwwk.",
    ".kppppppppppppk.",
    "..kwwwwwwwwwwk..",
    "..kwwwwwwwwwwk..",
    "...kkwwwwwwkk...",
    ".....kkkkkk.....",
    "...l..l..l..l...",
    "................",
]
UWABAKI = [
    "................",
    "................",
    "........kkkkk...",
    ".......kwwwwwk..",
    "......kwwkwkwk..",
    "......kwwwwwwk..",
    ".....kwwwppwwk..",
    "..kkkwwwwwwwwk..",
    ".kwwwwwwwwwwwk..",
    "kwwkwwkwwwwwwk..",
    "krrrrrwwwwwwwk..",
    "krrrrrrrrrrrrk..",
    ".kkkkkkkkkkkk...",
    "..l..l..l..l....",
    "................",
    "................",
]
PAPER = [
    "..kkkk..",
    ".kwwewk.",
    "kwewwwek",
    "kwwwewwk",
    "kewwwwwk",
    "kwwewewk",
    ".kwwwek.",
    "..kkkk..",
]
TREE = [
    "......kkkk......",
    "....kkGGGGkk....",
    "...kGGGgGGGGk...",
    "..kGGgGGGGgGGk..",
    "..kGGGGGGGGGGk..",
    ".kGGgGGGGGgGGGk.",
    ".kGGGGGgGGGGGGk.",
    ".kGGGGGGGGGGgGk.",
    "..kGGgGGGGGGGk..",
    "..kkGGGGGgGGkk..",
    "....kkkbbkkk....",
    "......kbbk......",
    "......kbbk......",
    "......kbbk......",
    ".....kbbbbk.....",
    "....kkkkkkkk....",
]
KID_BACK = [
    "................",
    ".....kkkkkk.....",
    "....kwwwwwwk....",
    "...kwwwwwwwwk...",
    "...krrrrrrrrk...",
    "..kkkkkkkkkkkk..",
    "....kddddddk....",
    "....kddddddk....",
    ".....kssssk.....",
    "...kkkkkkkkkk...",
    "..kwwkrrrrkwwk..",
    "..kwkrrrrrrkwk..",
    "..kwkrrrrrrkwk..",
    "..kwkryyyyrkwk..",
    "..ksk.krrk.ksk..",
    "..kk.kuuuuk.kk..",
    ".....kuuuuk.....",
    ".....kuuuuk.....",
    ".....ks..sk.....",
    ".....ks..sk.....",
    ".....ks..sk.....",
    "....kww..wwk....",
    "....kkk..kkk....",
    "................",
]
KID_FRONT = [
    "................",
    ".....kkkkkk.....",
    "....kwwwwwwk....",
    "...kwwwwwwwwk...",
    "...krrrrrrrrk...",
    "..kkkkkkkkkkkk..",
    "....kssssssk....",
    "....kskssksk....",
    "....kssssssk....",
    "....kspkkpsk....",
    ".....kssssk.....",
    "...kkkkkkkkkk...",
    "..kwwwwwwwwwwk..",
    "..kwwwkkkkwwwk..",
    "..kwwkwwwwkwwk..",
    "..kswwwwwwwwsk..",
    "..kk.kuuuuk.kk..",
    ".....kuuuuk.....",
    ".....kuuuuk.....",
    ".....ks..sk.....",
    ".....ks..sk.....",
    ".....ks..sk.....",
    "....kww..wwk....",
    "....kkk..kkk....",
]
GUN = [
    "....kkkk",
    "..kkyyyk",
    "kkccccck",
    "kcccccck",
    "kkkcckkk",
    "...kk...",
]
SOUL = [
    "..kk..",
    ".kwwk.",
    "kwwwwk",
    "kwkwkk",
    ".kwwk.",
    "..kk..",
]
BELL = [
    "......kk......",
    ".....kyyk.....",
    "....kyyyyk....",
    "...kyyyyyyk...",
    "...kyyywyyk...",
    "..kyyyywyyyk..",
    "..kyyyyyyyyk..",
    "..kyyyyyyyyk..",
    ".kyyyyyyyyyyk.",
    "kkkkkkkkkkkkkk",
    "......kk......",
]

TIRE = [
    "................",
    "................",
    "................",
    "....kkkkkkkk....",
    "..kkeeeeeeeekk..",
    ".keeekkkkkkeeek.",
    ".keek......keek.",
    "keek..dddd..keek",
    "keek..dddd..keek",
    ".keek......keek.",
    ".keeekkkkkkeeek.",
    "..kkeeeeeeeekk..",
    "....kkkkkkkk....",
    "................",
    "................",
    "................",
]
PUMPKIN = [
    "................",
    "........gg......",
    ".......gg.......",
    "....kkkkkkkk....",
    "..kkOOooooOOkk..",
    ".kOoooOooOoooOk.",
    ".kooYYoooYYooOk.",
    "kOooYYoooYYoooOk",
    "kOooooooooooooOk",
    "kOoYoYoYoYoYooOk",
    "kOooYYYYYYYooOk.",
    ".kOooooOooooOk..",
    "..kkOOooooOOkk..",
    "....kkkkkkkk....",
    "................",
    "................",
]
POST = ["..kddk.."] * 22 + ["kkddddkk", "kddddddk"]
XMAP = {".": 0, "k": 1, "g": 11, "o": 16, "Y": 17, "O": 18, "d": 15}


def art_any(img, x, y, rows, w):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r.ljust(w, ".")[:w]):
            img.pset(x + i, y + j, XMAP.get(ch, 0))


ENEMY_SPR = {"randoseru": (0, 0), "isu": (16, 0), "ball": (32, 0), "uwabaki": (48, 0)}
ENEMY_HP = {"randoseru": 3, "isu": 4, "ball": 2, "uwabaki": 2}
ENEMY_NAME = {"randoseru": "ランドセロ", "isu": "いすわらし", "ball": "ボールおばけ", "uwabaki": "うわばきゅん"}


def build_images():
    img = pyxel.images[1]
    img.cls(0)
    art(img, 0, 0, RANDOSERU)
    art(img, 16, 0, ISU)
    art(img, 32, 0, BALL)
    art(img, 48, 0, UWABAKI)
    art(img, 64, 0, PAPER, 8)
    art(img, 72, 0, SOUL, 6)
    art(img, 80, 0, GUN, 8)
    art(img, 96, 0, TREE)
    art(img, 112, 0, BELL, 14)
    art(img, 128, 0, TIRE)
    art_any(img, 144, 0, PUMPKIN, 16)
    art_any(img, 160, 0, POST, 8)
    art(img, 0, 16, KID_BACK)
    art(img, 16, 16, KID_FRONT)
    # 校舎（バンク2）：0,0 = おばけ校舎、0,64 = いかり、0,128 = もとに戻った校舎
    for i, mode in enumerate(("obake", "angry", "normal")):
        draw_school(pyxel.images[2], 0, i * 64, mode)
    load_boss_image(pyxel.images[2])
    # 地面のタイル（バンク0）
    g = pyxel.images[0]
    g.cls(0)
    g.rect(0, 0, 8, 8, GD)                  # 0: 校庭の土
    g.pset(2, 3, SD); g.pset(6, 6, SD); g.pset(5, 1, D1)
    g.rect(8, 0, 8, 8, GD); g.rect(11, 0, 2, 8, GY)   # 1: 白線（たて）
    g.rect(16, 0, 8, 8, DG); g.pset(18, 2, GR); g.pset(21, 5, GR); g.pset(17, 6, GR)  # 2: 芝生
    g.rect(24, 0, 8, 8, GD); g.rect(24, 3, 8, 2, GY)   # 3: 白線（よこ）
    g.rect(32, 0, 8, 8, GD); g.pset(33, 1, SD); g.pset(37, 4, SD); g.pset(35, 6, SD)  # 4: 土（変化）
    g.rect(40, 0, 8, 8, SD); g.pset(42, 2, GD); g.pset(45, 5, GD)  # 5: 砂場
    tm = pyxel.tilemaps[0]
    tm.imgsrc = 0
    rnd = random.Random(7)
    for ty in range(256):
        for tx in range(256):
            dx = tx - 128
            if abs(dx) > 17:
                t = (2, 0)
            elif dx in (-14, 13):
                t = (1, 0)
            elif dx == 0 and ty % 8 < 3:
                t = (1, 0)
            elif ty % 32 == 0 and abs(dx) < 14:
                t = (3, 0)
            elif ty % 64 in range(40, 48) and 5 < dx < 12:
                t = (5, 0)
            else:
                t = (4, 0) if rnd.random() < 0.3 else (0, 0)
            tm.pset(tx, ty, t)


# 生成画像のボス（96x64、NIGHT パレットに減色ずみ）。"obake" と "angry" をこれで置きかえる。
# 目（弱点）は boss_eye_pos と同じ位置：左 x20-29・右 x68-77、y29-38。
# "angry" は目の中のピンクを赤に置きかえる。画像が無いときは draw_school の絵のまま。
BOSS_PNG = "boss_school.png"
BOSS_EYES = ((20, 29, 10, 10), (68, 29, 10, 10))


def load_boss_image(img):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), BOSS_PNG)
    if not os.path.exists(path):
        return
    try:
        img.load(0, 0, path)
        img.load(0, 64, path)
    except Exception:
        for i, mode in enumerate(("obake", "angry")):
            draw_school(img, 0, i * 64, mode)
        return
    for ex, ey, ew, eh in BOSS_EYES:
        for y in range(ey, ey + eh):
            for x in range(ex, ex + ew):
                if img.pget(x, 64 + y) == PK:
                    img.pset(x, 64 + y, RD)


def draw_school(img, ox, oy, mode):
    body = GY if mode == "normal" else VI
    roof = PU if mode == "normal" else D1
    img.rect(ox, oy, 96, 64, 0)
    img.rect(ox + 2, oy + 24, 92, 38, body)                  # 校舎
    img.rectb(ox + 2, oy + 24, 92, 38, K + 1)
    img.rect(ox, oy + 20, 96, 5, roof)                        # 屋根
    img.rect(ox + 36, oy + 4, 24, 22, body)                   # 時計台
    img.rectb(ox + 36, oy + 4, 24, 22, K + 1)
    img.tri(ox + 34, oy + 5, ox + 48, oy, ox + 62, oy + 5, roof)
    img.circ(ox + 48, oy + 14, 7, WH if mode == "normal" else GO)
    img.circb(ox + 48, oy + 14, 7, K + 1)
    img.line(ox + 48, oy + 14, ox + 48, oy + 9, K + 1)
    img.line(ox + 48, oy + 14, ox + 52, oy + 14, K + 1)
    # まど
    for row in range(2):
        for col in range(8):
            if col in (3, 4) and row == 1:
                continue
            wx, wy = ox + 7 + col * 11, oy + 30 + row * 14
            img.rect(wx, wy, 7, 8, CY_ if mode == "normal" else (OY if (col * 3 + row) % 4 == 0 else D1))
            img.rectb(wx, wy, 7, 8, K + 1)
    if mode != "normal":
        eye = PK if mode == "obake" else RD
        for ex in (ox + 20, ox + 68):                         # 目（弱点）
            img.rect(ex, oy + 29, 10, 10, WH)
            img.rect(ex + 3, oy + 31, 5, 6, eye)
            img.rectb(ex, oy + 29, 10, 10, K + 1)
            img.line(ex - 2, oy + 27 - (2 if mode == "angry" else 0), ex + 11, oy + 27, K + 1)
        # 口（げんかん）
        img.rect(ox + 38, oy + 46, 20, 16, K + 1)
        for t in range(5):
            img.tri(ox + 38 + t * 4, oy + 46, ox + 42 + t * 4, oy + 46, ox + 40 + t * 4, oy + 51, WH)
    else:
        img.rect(ox + 40, oy + 46, 16, 16, GD)
        img.rectb(ox + 40, oy + 46, 16, 16, K + 1)
        img.line(ox + 48, oy + 46, ox + 48, oy + 61, K + 1)


def fix_tilemap():
    tm = pyxel.tilemaps[0]
    base = [[tm.pget(tx, ty) for tx in range(256)] for ty in range(64)]
    for ty in range(64, 256):
        for tx in range(256):
            tm.pset(tx, ty, base[ty % 64][tx])


def setup_sound():
    # ホラーふう：こわれたオルゴール（ゆれる音）＋半音でせまる低音＋心臓の音。ボス戦は 不協和音で はげしく
    s = pyxel.sounds
    sp = lambda x: x.replace(" ", "")
    mel = "e4rrr d#4rrr e4rrr a#3rrr a3rrr c4rrr b3rrr rrrr"
    bas = "a1rrr a#1rrr a1rrr a#1rrr a1rrr a#1rrr a1ra#1r a1a#1a1a#1"
    drm = "c1c1rr rrrr c1c1rr rrrr c1c1rr rrrr c1c1rr c1c1rr"
    s[0].set(sp(mel), "t", "5", "v", 22)
    s[1].set(sp(bas), "t", "6", "n", 22)
    s[2].set(sp(drm), "n", "3", "f", 22)
    s[3].set("a4f4c4", "n", "543", "f", 2)              # うつ（シュッ）
    s[4].set("c2g2c3g3", "s", "5432", "sssf", 4)        # たおした（おばけが すうっと 消える）
    s[5].set("f2c2f1c1", "s", "7765", "nnsf", 6)        # かまれた
    s[6].set("e3c3d3g2rg2d3e3c3", "t", "7", "vvvvnvvvf", 12)  # チャイム（ゆれる 鐘）
    s[7].set("c1c1d#1c1", "n", "7776", "sssf", 16)     # ボスの ほえ声
    s[8].set("c4c#4", "p", "54", "nf", 2)              # カキン（ぶつかる音）
    s[9].set("c3e3g3c4e4g4c4r", "t", "6", "nnnnnnfn", 8)  # クリア
    s[10].set("e4c4", "s", "64", "nf", 3)               # パワー
    s[11].set("c3e3g3c4 g3e3f3d3 c3e3g3c4 c4rrr".replace(" ", ""), "t", "5", "nnnnnnnnnnnnfnnn", 14)  # 夜明け（長調）
    # ボス戦の曲
    riff = "a1a1ra#1 a1rd#2r a1a1ra#1 g#1rd#2d2"
    stab = "a2a#2rr rrrr d#3e3rr rrrr"
    beat = "c1rf1r c1c1f1r"
    s[12].set(sp(riff * 2), "s", "5", "n", 9)
    s[13].set(sp(stab * 2), "p", "3", "f", 9)
    s[14].set(sp(beat * 4), "n", "6", "f", 9)
    s[15].set("c1c1c1c1c1c1", "n", "776543", "nnffff", 26)   # かみなり
    pyxel.musics[0].set([0], [1], [2])
    pyxel.musics[1].set([12], [13], [14])


class Obj:
    pass


class Game:
    def __init__(self):
        pyxel.init(W, H, title="おばけ第一小学校 レトロ", fps=60, display_scale=3)
        pyxel.colors[:] = NIGHT
        here = os.path.dirname(os.path.abspath(__file__))
        self.font = pyxel.Font(os.path.join(here, "font.bdf"))
        build_images()
        fix_tilemap()
        setup_sound()
        pyxel.mouse(False)
        self.best = 0
        self.stars = [(random.randrange(W), random.randrange(40), random.choice((WH, LV, GY))) for _ in range(40)]
        self.auto = os.environ.get("OBAKE_AUTO")  # 動作確認用の自動プレイ
        self.touch = is_touch_device() or bool(os.environ.get("OBAKE_TOUCH"))
        self.title()
        pyxel.run(self.update, self.draw)

    # ---------- 状態 ----------
    def title(self):
        self.state = "title"
        self.t = 0
        self.cx, self.cy = X0, 1900.0
        self.px = X0
        self.objs = []
        self.scenery = []
        self.fx = []
        self.reset_scenery()
        pyxel.colors[:] = NIGHT
        pyxel.stop()

    def start(self):
        self.state = "play"
        self.t = 0
        self.score = 0
        self.hearts = 5
        self.ammo = float(AMMO_MAX)
        self.kills = 0
        self.run = 0          # 進んだ道のり（中ボス中は止まる）
        self.phase = "road"   # road → mid → road2 → boss
        self.mid = None
        self.pw = 1           # みずでっぽうのレベル（1〜3）
        self.gold_next = 14   # 何体たおしたら光るおばけが出るか
        self.dda = 0.0        # やられたら上がる「やさしさ」（ボスと弾がゆるくなる）
        self.form_t = 120
        self.dmg_taken = 0
        self.combo = 0
        self.combo_t = 0
        self.chime = 0
        self.inv = 0
        self.cool = 0
        self.rest = 0
        self.shake = 0
        self.flash = 0
        self.msg = ("こうていステージ", 120)
        self.boss = None
        self.enemies = []
        self.shots = []
        self.bullets = []
        self.fx = []
        self.aim = [W / 2, H / 2 - 10]
        self.cx, self.cy, self.px = X0, 1900.0, X0
        self.reset_scenery()
        pyxel.colors[:] = NIGHT
        pyxel.playm(0, loop=True)

    def reset_scenery(self):
        self.scenery = []
        for i in range(14):
            for side in (-1, 1):
                o = Obj()
                o.x = X0 + side * random.uniform(150, 175)
                o.y = self.cy - i * 48 - (24 if side > 0 else 0)
                o.kind = "lamp" if (i + (side > 0)) % 3 == 0 else "tree"
                o.ph = random.uniform(0, 6)
                self.scenery.append(o)
        self.rain = [[random.uniform(0, W), random.uniform(0, H), random.uniform(5, 8), random.randint(5, 9)] for _ in range(150)]
        self.sparks = []
        self.thunder_t = random.randint(300, 600)
        self.bolt = None
        self.lflash = 0

    # ---------- 投影（bltm3d と同じ計算。テストで一致を確認済み） ----------
    def proj(self, x, y, z):
        th = math.radians(PITCH)
        dx, dy, dz = x - self.cx, y - self.cy, z - CAM_Z
        h = -dy
        zc = h * math.sin(th) - dz * math.cos(th)
        yc = h * math.cos(th) + dz * math.sin(th)
        if zc <= 1:
            return None
        return (W / 2 + dx / zc * FOCAL, H / 2 - yc / zc * FOCAL, zc)

    # ---------- 更新 ----------
    def update(self):
        self.t += 1
        if self.state == "title":
            self.cy -= 0.6
            self.scroll_world()
            if self.pressed():
                self.start()
            return
        if self.state == "ending":
            self.update_ending()
            return
        if self.state == "over":
            if self.t > 60 and self.pressed():
                self.title()
            return
        self.update_play()

    def pressed(self):
        return (pyxel.btnp(pyxel.MOUSE_BUTTON_LEFT) or pyxel.btnp(pyxel.KEY_SPACE)
                or pyxel.btnp(pyxel.KEY_Z) or pyxel.btnp(pyxel.KEY_RETURN)
                or pyxel.btnp(pyxel.GAMEPAD1_BUTTON_A) or (self.auto and self.t > 30))

    def scroll_world(self):
        if self.cy < 400:
            shift = 1024
            self.cy += shift
            for lst in (self.scenery, getattr(self, "enemies", []), getattr(self, "bullets", [])):
                for o in lst:
                    o.y += shift
            if getattr(self, "boss", None):
                self.boss.y += shift
        for o in self.scenery:
            if o.y > self.cy - 10:
                o.y -= 14 * 48

    def update_play(self):
        spd = 0.5 if self.boss else 0.9 if self.phase == "mid" else 1.4
        self.cy -= spd
        self.scroll_world()
        # ねらい：マウス／タッチ、または矢印キー
        if self.auto:
            self.auto_aim()
        elif pyxel.mouse_x != getattr(self, "_mx", None) or pyxel.mouse_y != getattr(self, "_my", None):
            self._mx, self._my = pyxel.mouse_x, pyxel.mouse_y
            self.aim = [float(pyxel.mouse_x), float(pyxel.mouse_y - (TOUCH_LIFT if self.touch else 0))]
        k = 3
        if pyxel.btn(pyxel.KEY_LEFT) or pyxel.btn(pyxel.GAMEPAD1_BUTTON_DPAD_LEFT): self.aim[0] -= k
        if pyxel.btn(pyxel.KEY_RIGHT) or pyxel.btn(pyxel.GAMEPAD1_BUTTON_DPAD_RIGHT): self.aim[0] += k
        if pyxel.btn(pyxel.KEY_UP) or pyxel.btn(pyxel.GAMEPAD1_BUTTON_DPAD_UP): self.aim[1] -= k
        if pyxel.btn(pyxel.KEY_DOWN) or pyxel.btn(pyxel.GAMEPAD1_BUTTON_DPAD_DOWN): self.aim[1] += k
        self.aim[0] = max(4, min(W - 4, self.aim[0]))
        self.aim[1] = max(4, min(H - 30, self.aim[1]))
        # 主人公は ねらいの方へ よこに動く（スペースハリアーふう）
        self.px += (self.aim[0] - W / 2) / W * 3.0
        self.px = max(X0 - 100, min(X0 + 100, self.px))
        self.cx += (self.px - self.cx) * 0.08
        # うつ
        firing = (pyxel.btn(pyxel.MOUSE_BUTTON_LEFT) or pyxel.btn(pyxel.KEY_SPACE) or pyxel.btn(pyxel.KEY_Z)
                  or pyxel.btn(pyxel.GAMEPAD1_BUTTON_A) or (self.auto and self.t % 7 == 0))
        if self.cool > 0:
            self.cool -= 1
        if firing and self.cool <= 0 and self.ammo >= 1:
            self.fire()
            self.cool = 8
            self.rest = 0
        elif firing and self.ammo < 1 and self.cool <= 0:
            self.cool = 12
            self.say("みずぎれ！ はなすと はやく たまるよ", 50)
        self.ammo = min(AMMO_MAX, self.ammo + 0.115)   # うちながらでも たまる（おしっぱなしでも 尽きにくい）
        if not firing:
            self.rest += 1
            if self.rest > 10:
                self.ammo = min(AMMO_MAX, self.ammo + 0.6)
        # チャイム（わざ）
        if (pyxel.btnp(pyxel.KEY_X) or pyxel.btnp(pyxel.GAMEPAD1_BUTTON_B) or self.tap_bell()
                or (self.auto and self.chime >= 100)) and self.chime >= 100:
            self.use_chime()
        # てき
        self.director()
        if self.dda > 0:
            self.dda = max(0, self.dda - 0.0006)
        for e in self.enemies:
            self.move_enemy(e)
        self.enemies = [e for e in self.enemies if not e.gone]
        for b in self.bullets:
            b.t += 1
            f = b.t / b.dur
            b.x = b.sx + (b.tx - b.sx) * f
            b.y = b.sy + (b.ty - b.sy) * f
            b.z = b.sz + (b.tz - b.sz) * f + math.sin(f * math.pi) * 12
            if f >= 1:
                b.gone = True
                if abs(b.x - self.px) < 12:
                    self.hurt()
        self.bullets = [b for b in self.bullets if not b.gone]
        for b in self.bullets:  # 弾はカメラといっしょに進む（主人公に向かってとぶ）
            b.sy -= spd
            b.ty -= spd
        if self.boss:
            self.update_boss()
        self.update_fx()
        if self.combo_t > 0:
            self.combo_t -= 1
        else:
            self.combo = 0
        if self.inv > 0:
            self.inv -= 1
        if self.shake > 0:
            self.shake -= 1
        if self.flash > 0:
            self.flash -= 1

    def auto_aim(self):
        best = None
        for e in self.enemies:
            if e.mode == "tire":
                continue
            p = self.proj(e.x, e.y, e.z + e.s / 2)
            if p and (best is None or p[2] < best[2]):
                best = p
        if self.boss and self.boss.state == "fight":
            best = self.boss_eye_pos(int(self.t / 90) % 2)
        if best:
            self.aim[0] += (best[0] - self.aim[0]) * 0.25
            self.aim[1] += (best[1] - self.aim[1]) * 0.25

    def tap_bell(self):
        return (pyxel.btnp(pyxel.MOUSE_BUTTON_LEFT) and pyxel.mouse_x < 30 and pyxel.mouse_y > H - 30)

    def say(self, s, d=90):
        self.msg = (s, d)

    # ---------- てきの出し方（ディレクター） ----------
    def director(self):
        if self.boss:
            return
        if self.phase in ("road", "road2"):
            self.run += 1
            if self.phase == "road" and self.run >= MID_AT:
                self.start_mid()
                return
            if self.run >= STAGE_LEN:
                if not [e for e in self.enemies if e.mode != "tire"]:
                    self.start_boss()
                return
            prog = self.run / STAGE_LEN
            self.form_t -= 1
            alive = len([e for e in self.enemies if e.mode != "tire"])
            if self.form_t <= 0 and alive < 5:   # 隊列は最大6体なので、同時に10体前後までにおさえる
                self.formation(prog)
                self.form_t = int(random.uniform(95, 125) - prog * 45)
            elif alive == 0 and self.form_t > 20:
                self.form_t = 20          # 画面が からっぽの時間を つくらない
            elif alive <= 2 and self.form_t > 50:
                self.form_t = 50          # のこりが少なくなったら 次を早めに
        elif self.phase == "mid":
            self.update_mid()

    def formation(self, prog):
        r = random.random()
        cx = self.px + random.uniform(-40, 40)
        far = self.cy - 300
        if prog < 0.25:
            pats = ("single", "pair", "line")
        elif prog < 0.6:
            pats = ("line", "v", "circle", "dive", "tire", "pair")
        else:
            pats = ("line", "v", "circle", "dive", "dive", "tire", "mix")
        pat = random.choice(pats)
        if pat == "single":
            self.spawn(random.choice(list(ENEMY_SPR)), cx, far)
        elif pat == "pair":
            for dx in (-30, 30):
                self.spawn(random.choice(("randoseru", "isu")), cx + dx, far)
        elif pat == "line":
            n = 4 if prog < 0.5 else 5
            k = random.choice(("randoseru", "isu", "ball"))
            for i in range(n):
                self.spawn(k, cx + (i - (n - 1) / 2) * 26, far, mode="line")
        elif pat == "v":
            for i in range(5):
                d = abs(i - 2)
                self.spawn("randoseru", cx + (i - 2) * 24, far - d * 30, mode="line")
        elif pat == "circle":
            for i in range(6):
                e = self.spawn("ball", cx, far, mode="circle")
                e.ang = i * math.pi / 3
        elif pat == "dive":
            for dx in (-50, 50):
                self.spawn("uwabaki", cx + dx, far, mode="dive")
        elif pat == "tire":
            for i in range(random.randint(2, 3)):
                self.spawn("tire", self.px + random.uniform(-70, 70), far - i * 50, mode="tire")
            self.spawn(random.choice(("randoseru", "ball")), cx, far - 40)
        else:
            self.formation(0.4)
            self.spawn("uwabaki", cx, far - 60, mode="dive")

    def spawn(self, kind=None, x=None, y=None, mode="sway"):
        e = Obj()
        e.kind = kind or random.choices(list(ENEMY_SPR), weights=(4, 2, 3, 3))[0]
        e.mode = mode
        e.hp = 999 if mode == "tire" else ENEMY_HP.get(e.kind, 1)
        e.x = self.cx + random.uniform(-90, 90) if x is None else x
        e.y = self.cy - random.uniform(260, 320) if y is None else y
        e.z = 0 if mode == "tire" else random.uniform(4, 26) if mode == "sway" else 14
        e.s = 16
        e.vy = 0 if mode == "tire" else random.uniform(0.3, 0.9) if mode == "sway" else 0.6
        e.ph = random.uniform(0, 6.28)
        e.wob = random.uniform(10, 26) if mode == "sway" else 6
        e.base_x = e.x
        e.ang = 0
        e.hit = 0
        e.dive = 0
        e.throw = random.randint(30, 100)
        e.gold = False
        e.big = False
        e.gone = False
        if mode not in ("tire",) and self.kills >= self.gold_next and not any(o.gold for o in self.enemies):
            e.gold = True             # 光るおばけ：たおすと パワーアップ
            e.hp += 1
            self.gold_next = self.kills + 18
        self.enemies.append(e)
        return e

    def move_enemy(self, e):
        e.y += e.vy
        e.ph += 0.05
        if e.mode == "sway":
            e.x = e.base_x + math.sin(e.ph) * e.wob
        elif e.mode == "line":
            e.x = e.base_x + math.sin(e.ph) * e.wob
        elif e.mode == "circle":
            e.ang += 0.045
            e.x = e.base_x + math.cos(e.ang) * 34
            e.z = 16 + math.sin(e.ang) * 12
        elif e.mode == "dive":
            dist = self.cy - e.y
            if not e.dive and dist < 170:
                e.dive = 1
                e.tx = self.px          # その時の主人公の位置へ つっこむ（よこに よければ かわせる）
                e.vy = 2.0
            if e.dive:
                e.dive += 1
                e.x += max(-1.6, min(1.6, e.tx - e.x))
                e.z = max(5, e.z - 0.25)
        if e.mode == "mid":
            e.x = e.base_x
            e.z = 6 + abs(math.sin(e.ph * 1.5)) * 10
            if e.hit > 0:
                e.hit -= 1
            return
        if e.kind == "ball" and e.mode == "sway":
            e.z = 4 + abs(math.sin(e.ph * 2)) * 20
        if e.hit > 0:
            e.hit -= 1
        dist = self.cy - e.y
        if e.mode not in ("tire", "dive"):
            e.throw -= 1
            if e.throw <= 0 and 70 < dist < 270:
                self.throw(e.x, e.y, e.z + 8)
                prog = self.run / STAGE_LEN
                e.throw = int(random.randint(110, 200) * (1 + self.dda * 0.8) - prog * 40)
        if dist < PD:
            e.gone = True
            # ぶつかって いたいのは「つっこむ うわばき」と「タイヤ」だけ（見てわかる危険）。
            # ふつうの おばけは 頭の上を とびこえて にげる（コンボが きれる）
            if e.mode in ("tire", "dive"):
                if abs(e.x - self.px) < (13 if e.mode == "tire" else 14):
                    self.hurt()
            elif e.mode != "mid":
                if self.combo >= 3:
                    self.fx.append(("txt", W / 2, H / 2 + 20, "にげられた！", 0, 30))
                self.combo = 0

    # ---------- 中ボス：ランドセルだいおう ----------
    def start_mid(self):
        self.phase = "mid"
        m = self.spawn("randoseru", self.px, self.cy - 260, mode="mid")
        m.big = True
        m.gold = True
        m.hp = MID_HP
        m.s = 44
        m.z = 6
        m.vy = 0
        m.dist = 260.0
        m.atk = 90
        self.mid = m
        pyxel.playm(1, loop=True)
        pyxel.play(3, 7)
        self.say("ランドセルだいおう が きた！", 140)

    def update_mid(self):
        m = self.mid
        if m.gone:
            self.mid = None
            self.phase = "road2"
            pyxel.playm(0, loop=True)
            self.say("ランドセルだいおうを たおした！", 120)
            return
        m.dist = max(140, m.dist - 1.2)
        m.y = self.cy - m.dist
        goal = self.cx + math.sin(self.t * 0.015) * 55   # 画面の中を 左右に ゆれる
        m.base_x += (goal - m.base_x) * 0.03
        m.atk -= 1
        if m.atk <= 0:
            if random.random() < 0.5:
                for dx in (-30, 0, 30):
                    self.throw(m.x + dx, m.y, 24)
            else:
                for dx in (-36, 36):
                    self.spawn("randoseru", m.x + dx, m.y + 5)
            m.atk = int(110 * (1 + self.dda * 0.8))

    def throw(self, x, y, z, dur=None):
        if dur is None:
            dur = 70 - 18 * min(1, self.run / STAGE_LEN)
        dur = int(dur * (1 + self.dda * 0.45))
        b = Obj()
        b.sx, b.sy, b.sz = x, y, z
        b.tx, b.ty, b.tz = self.px + random.uniform(-6, 6), self.cy - PD, 6
        b.x, b.y, b.z = x, y, z
        b.t, b.dur, b.gone = 0, dur, False
        self.bullets.append(b)

    def fire(self):
        self.ammo -= 1
        pyxel.play(3, 3)
        ax, ay = self.aim
        hx, hy = self.kid_screen()[0] + 11, H - 16
        self.fx.append(("water", hx, hy, ax, ay, 8, self.pw))
        dmg = 2 if self.pw >= 3 else 1
        assist = (1.3, 1.5, 1.8)[self.pw - 1]
        cands = []
        for e in self.enemies:
            if e.mode == "tire":
                continue
            p = self.proj(e.x, e.y, e.z + e.s / 2)
            if not p:
                continue
            r = FOCAL * e.s / p[2] / 2
            d = math.hypot(p[0] - ax, p[1] - ay)
            if d < r * assist + 4:
                cands.append((p[2], e))
        # 紙くずは 撃ち落としやすく（当たり判定を大きく）
        for b in self.bullets:
            p = self.proj(b.x, b.y, b.z)
            if p and math.hypot(p[0] - ax, p[1] - ay) < FOCAL * 12 / p[2] + 7:
                b.gone = True
                self.fx.append(("pop", p[0], p[1], 0, 0, 10))
                self.fx.append(("txt", p[0], p[1] - 8, "はじいた！", 0, 20))
                self.score += 80
                pyxel.play(3, 8)
                return
        if cands:
            cands.sort(key=lambda c: c[0])
            targets = [cands[0][1]]
            if self.pw >= 2:          # ダブル：となりの おばけにも 当たる
                for _, e in cands[1:2]:
                    targets.append(e)
                if len(targets) == 1:
                    near = None
                    for e in self.enemies:
                        if e is targets[0] or e.mode == "tire":
                            continue
                        p = self.proj(e.x, e.y, e.z + e.s / 2)
                        if p and math.hypot(p[0] - ax, p[1] - ay) < 40:
                            near = e
                            break
                    if near:
                        targets.append(near)
            for e in targets:
                e.hp -= dmg
                e.hit = 6
                if e.hp <= 0:
                    self.kill(e)
                else:
                    pyxel.play(3, 8)
            return
        if self.boss and self.boss.state == "fight":
            for i in (0, 1):
                ex, ey, er = self.boss_eye_pos(i)
                if math.hypot(ex - ax, ey - ay) < er * (1.2 if self.pw < 3 else 1.5) + 4:
                    self.hit_boss(1, ex, ey)   # ボスへは パワーに かかわらず 1
                    return
            bx, by, bw, bh = self.boss_rect()
            if bx <= ax <= bx + bw and by <= ay <= by + bh:
                pyxel.play(3, 8)
                self.fx.append(("txt", ax, ay, "カキン", 0, 20))
                return
        # からぶり：コンボが切れる（ねらって うつ 意味を つくる）
        if self.combo >= 3:
            self.fx.append(("txt", ax, ay - 8, "コンボ きれた", 0, 24))
        self.combo = 0
        self.fx.append(("splash", ax, ay, 0, 0, 10))

    def kill(self, e):
        e.gone = True
        self.kills += 1
        self.combo += 1
        self.combo_t = 100
        pts = 100 * min(5, self.combo)
        self.score += pts
        if not getattr(self, "chiming", False):
            self.chime = min(100, self.chime + 4)
        if e.big:
            self.score += 3000
            self.flash = 10
        if e.gold and self.pw < 3:
            self.pw += 1
            pyxel.play(3, 10)
            self.say(("", "パワーアップ！ ダブル みずでっぽう", "パワーアップ！ ふとい みず（2ばい）")[self.pw - 1], 110)
        elif e.gold:
            self.score += 1000
            self.chime = min(100, self.chime + 25)
        p = self.proj(e.x, e.y, e.z + e.s / 2)
        if p:
            self.fx.append(("pop", p[0], p[1], 0, 0, 14))
            self.fx.append(("txt", p[0], p[1] - 8, "ポン！" if self.combo < 2 else "%dコンボ" % self.combo, 0, 30))
            self.fx.append(("soul", p[0], p[1], 0, 0, 50))
        pyxel.play(3, 4)

    def hurt(self):
        if self.inv > 0 or self.state != "play":
            return
        self.hearts -= 1
        self.dmg_taken += 1
        self.dda = min(1.0, self.dda + 0.34)   # やられたら しばらく やさしく
        if self.pw > 1:
            self.pw -= 1
            self.say("みずでっぽうの パワーが さがった…", 80)
        self.inv = 70
        self.shake = 12
        self.combo = 0
        pyxel.play(3, 5)
        if self.hearts <= 0:
            self.state = "over"
            self.rank = self.get_rank()
            self.t = 0
            self.best = max(self.best, self.score)
            pyxel.stop()

    def use_chime(self):
        self.chime = 0
        self.flash = 20
        pyxel.play(3, 6)
        self.say("キーンコーンカーンコーン♪", 90)
        self.chiming = True     # チャイムで たおした分では ゲージが たまらない
        for e in list(self.enemies):
            if self.cy - e.y < 330 and e.mode != "tire":
                if e.big:
                    e.hp -= 6
                    e.hit = 8
                    if e.hp <= 0:
                        self.kill(e)
                else:
                    self.kill(e)
        self.bullets = []
        if self.boss and self.boss.state == "fight":
            self.hit_boss(6, W / 2, H / 3)
        self.chiming = False

    # ---------- ボス：おばけこうしゃ ----------
    def start_boss(self):
        b = Obj()
        b.dist = 520.0
        b.y = self.cy - b.dist
        b.x = X0
        b.hp = BOSS_HP
        b.state = "come"
        b.t = 0
        b.atk = 120
        b.hit = 0
        self.boss = b
        pyxel.playm(1, loop=True)
        pyxel.play(3, 7)
        self.say("おばけこうしゃ が あらわれた！", 150)

    def boss_scale(self):
        p = self.proj(self.boss.x, self.boss.y, 0)
        return (FOCAL * 150 / p[2]) / 96 if p else 1

    def boss_rect(self):
        b = self.boss
        sc = self.boss_scale()
        p = self.proj(b.x, b.y, 0)
        bw, bh = 96 * sc, 64 * sc
        bob = math.sin(b.t * 0.05) * 2 * sc
        return p[0] - bw / 2, p[1] - bh + bob, bw, bh

    def boss_eye_pos(self, i):
        bx, by, bw, bh = self.boss_rect()
        sc = bw / 96
        ex = bx + (25 if i == 0 else 73) * sc
        ey = by + 34 * sc
        return ex, ey, 6 * sc

    def update_boss(self):
        b = self.boss
        b.t += 1
        if b.hit > 0:
            b.hit -= 1
        if b.state == "come":
            b.dist = max(265, b.dist - 1.2)
            if b.dist <= 265:
                b.state = "fight"
                pyxel.play(3, 7)
        elif b.state == "fight":
            b.atk -= 1
            rage = b.hp < BOSS_HP / 2
            if b.atk <= 0:
                kind = random.choice(("paper", "paper", "minion"))
                if kind == "paper":
                    n = (5 if rage else 3) - int(self.dda * 2)
                    for i in range(max(1, n)):
                        self.throw(b.x + random.uniform(-40, 40), b.y + 5, 30, dur=90)
                else:
                    for i in range(2):
                        self.spawn(None, b.x + random.uniform(-50, 50), b.y + 10)
                b.atk = int((70 if rage else 110) * (1 + self.dda * 0.8))
            if rage and b.t % 240 == 0:
                self.say("おこった！ めが まっかだ！", 90)
        elif b.state == "die":
            b.dist += 0.3
            if b.t % 6 == 0:
                bx, by, bw, bh = self.boss_rect()
                self.fx.append(("pop", bx + random.uniform(0, bw), by + random.uniform(0, bh), 0, 0, 16))
                pyxel.play(3, 4)
            if b.t > 150:
                self.start_ending()
        b.y = self.cy - b.dist

    def hit_boss(self, dmg, x, y):
        b = self.boss
        b.hp -= dmg
        b.hit = 6
        self.score += 200 * dmg
        self.fx.append(("pop", x, y, 0, 0, 12))
        if self.t - getattr(self, "last_hit_txt", -99) > 30:
            self.last_hit_txt = self.t
            self.fx.append(("txt", x, y - 10, "めに めいちゅう！", 0, 24))
        pyxel.play(3, 4)
        if b.hp <= 0:
            b.state = "die"
            b.t = 0
            self.score += 5000 + self.hearts * 1000
            self.enemies = []
            self.bullets = []
            pyxel.stop()
            pyxel.play(3, 7)
            self.say("やった！ おばけこうしゃを たいじ！", 150)

    def get_rank(self):
        for th, r in RANKS:
            if self.score >= th:
                return r
        return "C"

    # ---------- エンディング：夜明け→学校がもとにもどる→「あー よかった」 ----------
    def start_ending(self):
        self.state = "ending"
        self.t = 0
        self.best = max(self.best, self.score)
        self.rank = self.get_rank()
        self.souls = [[random.uniform(40, W - 40), random.uniform(60, 110), random.uniform(0.2, 0.6)] for _ in range(14)]
        pyxel.play(3, 9)

    def update_ending(self):
        f = min(1, self.t / 200)
        cols = []
        for a, b in zip(NIGHT, DAY):
            c = 0
            for sh in (16, 8, 0):
                va, vb = (a >> sh) & 255, (b >> sh) & 255
                c |= int(va + (vb - va) * f) << sh
            cols.append(c)
        pyxel.colors[:] = cols
        self.cy -= 0.3
        self.scroll_world()
        for s in self.souls:
            s[1] -= s[2]
        if self.t == 230:
            pyxel.play(3, 11)
        if self.t > 320 and self.pressed():
            self.title()

    def update_fx(self):
        out = []
        for f in self.fx:
            f = list(f)
            f[5] -= 1
            if f[0] == "soul":
                f[2] -= 0.8
            if f[0] == "txt":
                f[2] -= 0.4
            if f[5] > 0:
                out.append(tuple(f))
        self.fx = out

    # ---------- 描画 ----------
    def kid_screen(self):
        return W / 2 - 8 + (self.px - self.cx) * 1.6, H - 26

    def draw(self):
        sx = random.randint(-2, 2) if getattr(self, "shake", 0) else 0
        pyxel.camera(sx, 0)
        self.draw_world()
        if self.state == "title":
            self.draw_title()
        elif self.state in ("play", "over"):
            self.draw_play()
            if self.state == "over":
                self.draw_over()
        elif self.state == "ending":
            self.draw_ending()
        pyxel.camera()
        self.debug_capture()

    def debug_capture(self):
        # 動作確認用：OBAKE_SHOT="フレーム,フレーム…" の時点で画面を保存（ふだんは何もしない）
        if not self.auto:
            return
        self.frame = getattr(self, "frame", 0) + 1
        shots = os.environ.get("OBAKE_SHOT", "")
        if str(self.frame) in shots.split(","):
            pyxel.screen.save(os.environ.get("OBAKE_OUT", ".") + "/f%05d_%s" % (self.frame, self.state), 3)
            print("SHOT", self.frame, self.state, "score", getattr(self, "score", 0), "kills", getattr(self, "kills", 0),
                  "hearts", getattr(self, "hearts", 0), "boss", self.boss.hp if getattr(self, "boss", None) else None, flush=True)
        if self.frame >= int(os.environ.get("OBAKE_END", "999999")):
            pyxel.quit()

    def draw_world(self):
        pyxel.cls(K)
        hz = H / 2 - math.tan(math.radians(90 - PITCH)) * FOCAL
        # 空（グラデーションを横線で）
        for i, c in enumerate((K, D1, D1, PU)):
            y0 = int(hz * i / 4)
            pyxel.rect(0, y0, W, int(hz / 4) + 1, c)
        if self.state != "ending" or self.t < 140:
            for x, y, c in self.stars:
                if (x + self.t // 20) % 7:
                    pyxel.pset(x, y, c)
        # 月（エンディングでは おひさま）
        mx, my = W - 46, 18 if self.state != "ending" else 18 - min(10, self.t / 20)
        pyxel.circ(mx, my, 9, GO)
        if self.state != "ending":
            pyxel.circ(mx + 4, my - 3, 8, D1)
        # 遠くの 山なみ
        for x in range(0, W, 4):
            h = 6 + 4 * math.sin((x + self.cx * 0.2) * 0.03) + 3 * math.sin(x * 0.11)
            pyxel.rect(x, hz - h, 4, h + 1, DK)
        # 遠くの校舎（ボスが来るまで・タイトル）
        if not getattr(self, "boss", None) and self.state in ("title", "play", "over"):
            pyxel.blt(W / 2 - 48 - (self.cx - X0) * 0.1, hz - 40, 2, 0, 0, 96, 64, 0, scale=0.5)
        # 地面（Pyxel 3.0 の bltm3d）
        pyxel.bltm3d(0, 0, W, H, 0, (self.cx, self.cy, CAM_Z), (PITCH, 0, 0), fov=FOV, colkey=None)
        # 遠くを くらく（きりの代わりに 横線を ちらす）
        for y in range(int(hz), int(hz) + 10, 2):
            pyxel.line(0, y, W, y, K if self.state != "ending" else GY)

    def sprites(self):
        items = []
        for o in self.scenery:
            p = self.proj(o.x, o.y, 0)
            if p:
                items.append((p[2], o.kind, o, p))
        for e in getattr(self, "enemies", []):
            p = self.proj(e.x, e.y, e.z)
            if p:
                items.append((p[2], "enemy", e, p))
        for b in getattr(self, "bullets", []):
            p = self.proj(b.x, b.y, b.z)
            if p:
                items.append((p[2], "bullet", b, p))
        items.sort(key=lambda i: -i[0])
        return items

    def draw_sprite(self, u, v, w, h, sx, sy_bottom, size, zc, flash=False):
        sc = FOCAL * size / zc / w
        if sc < 0.08:
            return
        cx = sx
        cy = sy_bottom - h * sc / 2
        if flash:
            for c in range(1, 16):
                pyxel.pal(c, WH)
        pyxel.blt(cx - w / 2, cy - h / 2, 1, u, v, w, h, 0, scale=sc)
        if flash:
            pyxel.pal()

    def draw_play(self):
        # ボス
        if self.boss:
            b = self.boss
            bx, by, bw, bh = self.boss_rect()
            sc = bw / 96
            row = 64 if b.hp < BOSS_HP / 2 else 0
            if b.state == "die" and b.t % 8 < 4:
                for c in range(1, 16):
                    pyxel.pal(c, WH)
            if b.hit and b.hit % 2:
                for c in range(1, 16):
                    pyxel.pal(c, PK)
            pyxel.blt(bx + bw / 2 - 48, by + bh / 2 - 32, 2, 0, row, 96, 64, 0, scale=sc)
            pyxel.pal()
            if b.state == "fight":
                for i in (0, 1):
                    ex, ey, er = self.boss_eye_pos(i)
                    if self.t % 30 < 15:
                        pyxel.circb(ex, ey, er + 3, GO)
        # 木・おばけ・紙くず（奥から順に）
        for zc, kind, o, p in self.sprites():
            if kind == "tree":
                self.draw_sprite(96, 0, 16, 16, p[0], p[1], 34, zc)
            elif kind == "lamp":
                self.draw_lamp(o, p, zc)
            elif kind == "enemy":
                if o.mode == "tire":
                    self.draw_sprite(128, 0, 16, 16, p[0], p[1] + FOCAL * 4 / zc, 16, zc)
                    continue
                u, v = ENEMY_SPR[o.kind]
                # かげ
                g = self.proj(o.x, o.y, 0)
                if g:
                    r = max(1, FOCAL * o.s * 0.38 / g[2])
                    pyxel.elli(g[0] - r, g[1] - r / 3, r * 2, r * 2 / 3, K)
                if o.gold and self.t % 10 < 6:   # 光るおばけ（たおすと パワーアップ）
                    rr = FOCAL * o.s / zc * 0.65 + 2
                    pyxel.circb(p[0], p[1] - FOCAL * o.s / zc / 2, rr, GO)
                self.draw_sprite(u, v, 16, 16, p[0], p[1], o.s, zc, o.hit > 0)
                if o.mode == "dive" and 0 < o.dive < 40 and self.t % 8 < 5:
                    self.otext(p[0] - 3, p[1] - FOCAL * o.s / zc - 12, "!", RD, WH)
            else:
                self.draw_sprite(64, 0, 8, 8, p[0], p[1], 7, zc)
        # みずでっぽうの水・エフェクト
        for f in self.fx:
            kind = f[0]
            if kind == "water":
                hx, hy, ax, ay, life = f[1:6]
                pw = f[6] if len(f) > 6 else 1
                offs = (0,) if pw == 1 else (-3, 3)
                for off in offs:
                    for i in range(12):
                        t = i / 11
                        x = hx + off + (ax - hx - off) * t
                        y = hy + (ay - hy) * t - math.sin(t * math.pi) * (10 + off)
                        pyxel.circ(x, y, (3 if pw >= 3 else 2) - t, CY_ if i % 2 else WH)
            elif kind == "splash":
                _, x, y, _, _, life = f
                for i in range(6):
                    a = i * 1.05 + life
                    pyxel.pset(x + math.cos(a) * (12 - life), y + math.sin(a) * (12 - life) * 0.6, CY_)
            elif kind == "pop":
                _, x, y, _, _, life = f
                r = (16 - life) * 1.5
                pyxel.circb(x, y, r, WH if life % 4 < 2 else PK)
                pyxel.circ(x, y, max(0, life / 3), GO)
            elif kind == "soul":
                _, x, y, _, _, life = f
                pyxel.blt(x - 3, y - 3, 1, 72, 0, 6, 6, 0)
            elif kind == "txt":
                _, x, y, s, _, life = f
                self.otext(x - self.font.text_width(s) / 2, y, s, GO, K)
        # 主人公（うしろすがた）＋ みずでっぽう
        kx, ky = self.kid_screen()
        if not (self.inv and self.t % 6 < 3):
            pyxel.blt(kx, ky, 1, 0, 16, 16, 24, 0)
            pyxel.blt(kx + 11, ky + 9, 1, 80, 0, 8, 6, 0)
        # 照準
        ax, ay = self.aim
        c = PK if self.t % 20 < 10 else CY_
        pyxel.circb(ax, ay, 7, K)
        pyxel.circb(ax, ay, 6, c)
        pyxel.line(ax - 10, ay, ax - 4, ay, c)
        pyxel.line(ax + 4, ay, ax + 10, ay, c)
        pyxel.line(ax, ay - 10, ax, ay - 4, c)
        pyxel.line(ax, ay + 4, ax, ay + 10, c)
        pyxel.pset(ax, ay, WH)
        if self.flash:
            if self.flash % 4 < 2:
                pyxel.dither(0.5)
                pyxel.rect(0, 0, W, H, WH)
                pyxel.dither(1)
        self.draw_weather()
        self.draw_hud()

    def draw_hud(self):
        # ハート
        for i in range(5):
            x = 4 + i * 11
            col = PK if i < self.hearts else D1
            pyxel.circ(x + 2, 6, 2, col); pyxel.circ(x + 6, 6, 2, col)
            pyxel.tri(x, 7, x + 8, 7, x + 4, 12, col)
        # みずタンク
        pyxel.rect(4, 16, 52, 6, K)
        pyxel.rect(5, 17, int(50 * self.ammo / AMMO_MAX), 4, CY_ if self.ammo >= 6 else PK)
        pyxel.rectb(4, 16, 52, 6, LV)
        # みずでっぽうのレベル・コンボ
        self.otext(60, 14, "Lv%d" % self.pw, GO if self.pw > 1 else LV, K)
        if self.combo >= 2:
            s = "%dコンボ ×%d" % (self.combo, min(5, self.combo))
            self.otext(W - 4 - self.font.text_width(s), 14, s, GO, K)
        # スコア
        s = "%07d" % self.score
        self.otext(W - 4 - self.font.text_width(s), 3, s, WH, K)
        # のこり／ボス体力
        if self.boss and self.boss.state != "die":
            w = 140
            x = W / 2 - w / 2
            pyxel.rect(x, 4, w, 6, K)
            pyxel.rect(x + 1, 5, int((w - 2) * max(0, self.boss.hp) / BOSS_HP), 4, RD)
            pyxel.rectb(x, 4, w, 6, GO)
            self.otext(W / 2 - self.font.text_width("おばけこうしゃ") / 2, 12, "おばけこうしゃ", GO, K)
        elif self.phase == "mid" and self.mid:
            w = 110
            x = W / 2 - w / 2
            pyxel.rect(x, 4, w, 6, K)
            pyxel.rect(x + 1, 5, int((w - 2) * max(0, self.mid.hp) / MID_HP), 4, PK)
            pyxel.rectb(x, 4, w, 6, GO)
            s = "ランドセルだいおう"
            self.otext(W / 2 - self.font.text_width(s) / 2, 12, s, GO, K)
        else:
            # こうしゃまでの道のり（中ボスの位置に しるし）
            w = 120
            x = W / 2 - w / 2
            pyxel.rect(x, 5, w, 4, K)
            pyxel.rect(x, 5, int(w * min(1, self.run / STAGE_LEN)), 4, LV)
            pyxel.rectb(x - 1, 4, w + 2, 6, PU)
            mx = x + w * MID_AT / STAGE_LEN
            pyxel.line(mx, 3, mx, 10, PK)
            pyxel.blt(x + w - 4, 1, 1, 72, 0, 6, 6, 0)
            s = "こうしゃまで"
            self.otext(W / 2 - self.font.text_width(s) / 2, 11, s, LV, K)
        # チャイム（左下）
        ready = self.chime >= 100
        pyxel.rect(3, H - 27, 24, 24, K)
        pyxel.rectb(3, H - 27, 24, 24, GO if ready and self.t % 20 < 10 else PU)
        h = int(22 * self.chime / 100)
        pyxel.rect(4, H - 4 - h, 22, h, VI if not ready else LV)
        pyxel.blt(8, H - 22, 1, 112, 0, 14, 11, 0)
        if ready:
            self.otext(4, H - 12, "タップ" if self.touch else "X/タップ", WH, K)
        # メッセージ
        if self.msg and self.msg[1] > 0:
            s, d = self.msg
            self.msg = (s, d - 1)
            tw = self.font.text_width(s)
            my = 66 if (self.boss or self.phase == "mid") else 36   # ボスに かぶらない位置
            pyxel.rect(W / 2 - tw / 2 - 6, my, tw + 12, 16, K)
            pyxel.rectb(W / 2 - tw / 2 - 6, my, tw + 12, 16, VI)
            self.otext(W / 2 - tw / 2, my + 3, s, WH, K)

    def draw_lamp(self, o, p, zc):
        # 外灯の柱＋かぼちゃランタン。まわりに あたたかい光のまる（ディザで半とうめい）と火の粉
        sc = FOCAL * 30 / zc / 24
        if sc < 0.08:
            return
        top = p[1] - 24 * sc
        f = 0.8 + 0.15 * math.sin(self.t * 0.31 + o.ph) + 0.08 * math.sin(self.t * 0.83 + o.ph * 2)
        r = 26 * sc * f
        pyxel.dither(0.18)
        pyxel.elli(p[0] - r * 1.4, p[1] - r * 0.25, r * 2.8, r * 0.5, OD)   # 地面の 光だまり
        pyxel.circ(p[0], top, r * 1.25, OD)
        pyxel.dither(0.35)
        pyxel.circ(p[0], top, r * 0.75, OR)
        pyxel.dither(1)
        pyxel.blt(p[0] - 4, p[1] - 24 * sc / 2 - 12, 1, 160, 0, 8, 24, 0, scale=sc)
        pyxel.blt(p[0] - 8, top - 10, 1, 144, 0, 16, 16, 0, scale=sc * 0.9)
        if zc < 220 and random.random() < 0.25:
            self.sparks.append([p[0] + random.uniform(-3, 3) * sc, top - 4 * sc, random.uniform(-0.3, 0.3), random.uniform(-1.0, -0.5), random.randint(20, 40)])

    def draw_weather(self):
        # 火の粉
        out = []
        for sp in self.sparks:
            sp[0] += sp[2] + math.sin(sp[4] * 0.3) * 0.2
            sp[1] += sp[3]
            sp[4] -= 1
            if sp[4] > 0:
                pyxel.pset(sp[0], sp[1], OY if sp[4] > 12 else OR)
                out.append(sp)
        self.sparks = out[-80:]
        # 雨（エンディングの 夜明けで やむ）
        if self.state == "ending" and self.t > 120:
            return
        for d in self.rain:
            d[1] += d[2]
            d[0] -= d[2] * 0.3
            if d[1] > H or d[0] < 0:
                d[1] = random.uniform(-20, 0)
                d[0] = random.uniform(0, W + 40)
            pyxel.line(d[0], d[1], d[0] + d[3] * 0.3, d[1] - d[3], RN)
        hz = H / 2 - math.tan(math.radians(90 - PITCH)) * FOCAL
        for _ in range(5):   # 地面の しぶき
            x, y = random.uniform(0, W), random.uniform(hz + 8, H)
            pyxel.pset(x - 1, y, RN)
            pyxel.pset(x + 1, y, RN)
        # 稲妻
        if self.state in ("play", "title"):
            self.thunder_t -= 1
            if self.thunder_t <= 0:
                self.thunder_t = random.randint(420, 900)
                self.lflash = 8
                x = random.uniform(40, W - 40)
                self.bolt = [(x, 0)]
                for i in range(1, 8):
                    x += random.uniform(-14, 14)
                    self.bolt.append((x, hz * i / 7))
                pyxel.play(3, 15)
        if self.lflash > 0:
            self.lflash -= 1
            if self.lflash in (7, 6, 3):
                pyxel.dither(0.45)
                pyxel.rect(0, 0, W, H, WH)
                pyxel.dither(1)
            if self.bolt and self.lflash > 3:
                for (x1, y1), (x2, y2) in zip(self.bolt, self.bolt[1:]):
                    pyxel.line(x1, y1, x2, y2, WH)
                    pyxel.line(x1 + 1, y1, x2 + 1, y2, LV)

    def draw_title(self):
        t = self.t
        self.draw_weather()
        pyxel.rect(0, 16, W, 66, K)
        pyxel.line(0, 16, W, 16, VI)
        pyxel.line(0, 81, W, 81, VI)
        s1 = "よるの がっこう レトロ"
        self.otext(W / 2 - self.font.text_width(s1) / 2, 20, s1, LV, K)
        # 大きなタイトル：画像バンク2の下に文字を書き、2倍で表示
        s2 = "おばけ第一小学校"
        tw = self.font.text_width(s2)
        img = pyxel.images[2]
        img.rect(0, 200, 120, 14, 0)
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (1, 1)):
            img.text(2 + dx, 202 + dy, s2, PU, self.font)
        img.text(2, 202, s2, GO, self.font)
        pyxel.blt(W / 2 - 60, 44, 2, 0, 200, 120, 14, 0, scale=2)
        s3 = "こうていステージ ＋ ボス"
        self.otext(W / 2 - self.font.text_width(s3) / 2, 67, s3, CY_, K)
        # おばけたち
        for i, (u, v) in enumerate(ENEMY_SPR.values()):
            x = 40 + i * 62
            y = 88 + math.sin(t * 0.06 + i) * 4
            pyxel.blt(x, y, 1, u, v, 16, 16, 0, scale=1.5)
        pyxel.blt(W - 40, H - 30, 1, 0, 16, 16, 24, 0)
        if t % 60 < 40:
            s = "タップで スタート" if self.touch else "クリック／タップで スタート"
            self.otext(W / 2 - self.font.text_width(s) / 2, 112, s, WH, K)
        if self.touch:
            s = "ゆびで ねらう・うつ（しょうじゅんは ゆびの上）"
            self.otext(8, H - 24, s, GY, K)
            s = "チャイム：ひだり下の ベルを タップ"
        else:
            s = "ねらう：マウス・タッチ・やじるし"
            self.otext(8, H - 24, s, GY, K)
            s = "うつ：おす・Z   チャイム：X"
        self.otext(8, H - 12, s, GY, K)
        if self.best:
            s = "ハイスコア %d" % self.best
            self.otext(4, 4, s, GO, K)

    def draw_over(self):
        pyxel.rect(0, 50, W, 50, K)
        s = "やられた… がっこうは おばけの もの…"
        self.otext(W / 2 - self.font.text_width(s) / 2, 58, s, PK, K)
        s = "スコア %d   ランク %s" % (self.score, self.rank)
        self.otext(W / 2 - self.font.text_width(s) / 2, 72, s, WH, K)
        if self.t > 60 and self.t % 60 < 40:
            s = "おして タイトルへ"
            self.otext(W / 2 - self.font.text_width(s) / 2, 86, s, GY, K)

    def draw_ending(self):
        t = self.t
        self.draw_weather()
        hz = H / 2 - math.tan(math.radians(90 - PITCH)) * FOCAL
        # もとにもどった校舎
        pyxel.blt(W / 2 - 48, hz - 52, 2, 0, 128, 96, 64, 0, scale=0.9)
        for s in self.souls:
            if s[1] > -6:
                pyxel.blt(s[0], s[1], 1, 72, 0, 6, 6, 0)
        # 主人公がふりむいて「あー よかった」
        kx, ky = W / 2 - 8, H - 34
        if t < 150:
            pyxel.blt(kx, ky, 1, 0, 16, 16, 24, 0)
        else:
            pyxel.blt(kx, ky, 1, 16, 16, 16, 24, 0)
        if t > 170:
            s = "あー よかった"
            tw = self.font.text_width(s)
            bx, by = W / 2 - tw / 2 - 6, ky - 22
            pyxel.rect(bx, by, tw + 12, 15, WH)
            pyxel.rectb(bx, by, tw + 12, 15, K + 1)
            pyxel.tri(W / 2 - 3, by + 14, W / 2 + 3, by + 14, W / 2, by + 19, WH)
            pyxel.text(bx + 6, by + 3, s, K + 1, self.font)
        if t > 240:
            s = "がっこうが もとに もどった！"
            self.otext(W / 2 - self.font.text_width(s) / 2, 12, s, K + 1, WH)
            s = "スコア %d   ランク %s" % (self.score, self.rank)
            self.otext(W / 2 - self.font.text_width(s) / 2, 26, s, K + 1, WH)
        if t > 320 and t % 60 < 40:
            s = "おして タイトルへ"
            self.otext(W / 2 - self.font.text_width(s) / 2, 40, s, K + 1, WH)

    def otext(self, x, y, s, col, bcol):
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            pyxel.text(x + dx, y + dy, s, bcol, self.font)
        pyxel.text(x, y, s, col, self.font)


Game()
