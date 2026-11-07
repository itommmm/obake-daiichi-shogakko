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
GOAL = 25                 # ボスが来るまでに たおす数
BOSS_HP = 60

# ---- パレット（16色）。夜と朝の2組を用意し、エンディングで夜→朝へ移り変わる ----
NIGHT = [0x0B0820, 0x1D1440, 0x3A2370, 0x6B3FB0, 0xA65CFF, 0x5FE3FF, 0xF4F1FF, 0xFFD23F,
         0xFF5FB8, 0xE8433A, 0x173A2A, 0x2F6A44, 0x3B2C3E, 0x5E4A5A, 0x8A8AA0, 0x2A2448]
DAY = [0x2A3A6A, 0x3A3A55, 0x6E7FD0, 0x8FA8FF, 0xC9D6FF, 0x8FE8FF, 0xFFFFFF, 0xFFD23F,
       0xFF8FC8, 0xE8433A, 0x3E8A4E, 0x6CC46A, 0xB98A5A, 0xE2C08C, 0xB8B8C8, 0x9FC8FF]
K, D1, PU, VI, LV, CY_, WH, GO, PK, RD, DG, GR, GD, SD, GY, DK = range(16)

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

ENEMY_SPR = {"randoseru": (0, 0), "isu": (16, 0), "ball": (32, 0), "uwabaki": (48, 0)}
ENEMY_HP = {"randoseru": 2, "isu": 3, "ball": 1, "uwabaki": 1}
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
    art(img, 0, 16, KID_BACK)
    art(img, 16, 16, KID_FRONT)
    # 校舎（バンク2）：0,0 = おばけ校舎、0,64 = いかり、0,128 = もとに戻った校舎
    for i, mode in enumerate(("obake", "angry", "normal")):
        draw_school(pyxel.images[2], 0, i * 64, mode)
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
            img.rect(wx, wy, 7, 8, CY_ if mode == "normal" else D1)
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
    s = pyxel.sounds
    # BGM：ぶきみだけど かわいい ハ短調ふう
    mel = "a2c3e3a3 g3e3c3e3 f3a3c4a3 g#3b3e3r a2c3e3a3 b3c4b3a3 g#3e3f3d3 e3rrr"
    bas = "a1ra1r a1ra1r f1rf1r e1re1r a1ra1r a1ra1r d2rd2r e1re1r"
    drm = "c1ra3r c1ra3r c1ra3r c1ra3r c1ra3r c1ra3r c1ra3r c1a3a3a3"
    s[0].set(mel.replace(" ", ""), "p", "4", "nnnv", 14)
    s[1].set(bas.replace(" ", ""), "t", "5", "n", 14)
    s[2].set(drm.replace(" ", ""), "n", "52", "f", 14)
    s[3].set("a4f4c4", "n", "543", "f", 2)            # うつ（シュッ）
    s[4].set("c3g3c4", "p", "665", "nnf", 3)          # たおした（ポン）
    s[5].set("c2a1f1c1", "s", "7654", "f", 6)        # くらった
    s[6].set("e3c3d3g2rg2d3e3c3", "t", "7", "nnnnnnnnf", 9)  # チャイム
    s[7].set("c1c1d#1c1", "n", "7776", "sssf", 16)   # ボスのほえ声
    s[8].set("c4e4", "p", "54", "nf", 2)             # カキン
    s[9].set("c3e3g3c4e4g4c4r", "p", "6", "nnnnnnfn", 8)  # クリア
    s[10].set("e4c4", "s", "64", "nf", 3)             # パワー
    s[11].set("g2c3e3g3", "t", "5", "nnnf", 18)       # エンディング
    pyxel.musics[0].set([0], [1], [2])


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
        self.ammo = 30.0
        self.kills = 0
        self.combo = 0
        self.combo_t = 0
        self.chime = 0
        self.inv = 0
        self.cool = 0
        self.rest = 0
        self.spawn_t = 60
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
                o.kind = "tree"
                self.scenery.append(o)

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
        spd = 1.4 if not self.boss else 0.5
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
            self.cool = 7
            self.rest = 0
        elif firing and self.ammo < 1 and self.cool <= 0:
            self.cool = 20
            self.say("みずぎれ！ ちょっと まってね", 40)
        self.ammo = min(30, self.ammo + 0.09)   # うちながらでも少しずつたまる
        if not firing:
            self.rest += 1
            if self.rest > 12:
                self.ammo = min(30, self.ammo + 0.5)
        # チャイム（わざ）
        if (pyxel.btnp(pyxel.KEY_X) or pyxel.btnp(pyxel.GAMEPAD1_BUTTON_B) or self.tap_bell()
                or (self.auto and self.chime >= 100)) and self.chime >= 100:
            self.use_chime()
        # てき
        if not self.boss:
            self.spawn_t -= 1
            if self.spawn_t <= 0 and self.kills + len(self.enemies) < GOAL + 3:
                self.spawn()
                self.spawn_t = max(28, 70 - self.kills * 2)
            if self.kills >= GOAL and not self.enemies:
                self.start_boss()
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
                if abs(b.x - self.px) < 13:
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

    def spawn(self):
        e = Obj()
        e.kind = random.choices(list(ENEMY_SPR), weights=(4, 2, 3, 3))[0]
        e.hp = ENEMY_HP[e.kind]
        e.x = self.cx + random.uniform(-90, 90)
        e.y = self.cy - random.uniform(260, 320)
        e.z = random.uniform(4, 26)
        e.s = 16
        e.vy = random.uniform(0.3, 0.9)
        e.ph = random.uniform(0, 6.28)
        e.wob = random.uniform(10, 26)
        e.base_x = e.x
        e.hit = 0
        e.throw = random.randint(60, 160)
        e.gone = False
        self.enemies.append(e)

    def move_enemy(self, e):
        e.y += e.vy
        e.ph += 0.05
        e.x = e.base_x + math.sin(e.ph) * e.wob
        if e.kind == "ball":
            e.z = 4 + abs(math.sin(e.ph * 2)) * 20
        if e.hit > 0:
            e.hit -= 1
        e.throw -= 1
        dist = self.cy - e.y
        if e.throw <= 0 and 60 < dist < 240:
            self.throw(e.x, e.y, e.z + 8)
            e.throw = random.randint(120, 220)
        if dist < PD:
            e.gone = True
            if abs(e.x - self.px) < 14:
                self.hurt()

    def throw(self, x, y, z, dur=70):
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
        self.fx.append(("water", hx, hy, ax, ay, 8))
        best, bz = None, 1e9
        for e in self.enemies:
            p = self.proj(e.x, e.y, e.z + e.s / 2)
            if not p:
                continue
            r = FOCAL * e.s / p[2] / 2
            if math.hypot(p[0] - ax, p[1] - ay) < r * 1.3 + 4 and p[2] < bz:
                best, bz = e, p[2]
        for b in self.bullets:
            p = self.proj(b.x, b.y, b.z)
            if p and math.hypot(p[0] - ax, p[1] - ay) < FOCAL * 8 / p[2] + 4:
                b.gone = True
                self.fx.append(("pop", p[0], p[1], 0, 0, 10))
                self.score += 50
                return
        if best:
            best.hp -= 1
            best.hit = 6
            if best.hp <= 0:
                self.kill(best)
            else:
                pyxel.play(3, 8)
            return
        if self.boss and self.boss.state == "fight":
            for i in (0, 1):
                ex, ey, er = self.boss_eye_pos(i)
                if math.hypot(ex - ax, ey - ay) < er + 4:
                    self.hit_boss(1, ex, ey)
                    return
            bx, by, bw, bh = self.boss_rect()
            if bx <= ax <= bx + bw and by <= ay <= by + bh:
                pyxel.play(3, 8)
                self.fx.append(("txt", ax, ay, "カキン", 0, 20))
        self.fx.append(("splash", ax, ay, 0, 0, 10))

    def kill(self, e):
        e.gone = True
        self.kills += 1
        self.combo += 1
        self.combo_t = 100
        pts = 100 * min(5, self.combo)
        self.score += pts
        self.chime = min(100, self.chime + 9)
        p = self.proj(e.x, e.y, e.z + e.s / 2)
        if p:
            self.fx.append(("pop", p[0], p[1], 0, 0, 14))
            self.fx.append(("txt", p[0], p[1] - 8, "ポン！" if self.combo < 2 else "%dコンボ" % self.combo, 0, 30))
            self.fx.append(("soul", p[0], p[1], 0, 0, 50))
        pyxel.play(3, 4)
        if self.kills == GOAL:
            self.say("ゴゴゴ… なにかが くる！", 150)

    def hurt(self):
        if self.inv > 0 or self.state != "play":
            return
        self.hearts -= 1
        self.inv = 70
        self.shake = 12
        self.combo = 0
        pyxel.play(3, 5)
        if self.hearts <= 0:
            self.state = "over"
            self.t = 0
            self.best = max(self.best, self.score)
            pyxel.stop()

    def use_chime(self):
        self.chime = 0
        self.flash = 20
        pyxel.play(3, 6)
        self.say("キーンコーンカーンコーン♪", 90)
        for e in list(self.enemies):
            if self.cy - e.y < 330:
                self.kill(e)
        self.bullets = []
        if self.boss and self.boss.state == "fight":
            self.hit_boss(6, W / 2, H / 3)

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
                    for i in range(5 if rage else 3):
                        self.throw(b.x + random.uniform(-40, 40), b.y + 5, 30, dur=90)
                else:
                    for i in range(2):
                        self.spawn()
                        e = self.enemies[-1]
                        e.y = b.y + 10
                        e.base_x = b.x + random.uniform(-50, 50)
                b.atk = 70 if rage else 110
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

    # ---------- エンディング：夜明け→学校がもとにもどる→「あー よかった」 ----------
    def start_ending(self):
        self.state = "ending"
        self.t = 0
        self.best = max(self.best, self.score)
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
                items.append((p[2], "tree", o, p))
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
            elif kind == "enemy":
                u, v = ENEMY_SPR[o.kind]
                # かげ
                g = self.proj(o.x, o.y, 0)
                if g:
                    r = max(1, FOCAL * 6 / g[2])
                    pyxel.elli(g[0] - r, g[1] - r / 3, r * 2, r * 2 / 3, K)
                self.draw_sprite(u, v, 16, 16, p[0], p[1], o.s, zc, o.hit > 0)
            else:
                self.draw_sprite(64, 0, 8, 8, p[0], p[1], 7, zc)
        # みずでっぽうの水・エフェクト
        for f in self.fx:
            kind = f[0]
            if kind == "water":
                _, hx, hy, ax, ay, life = f
                for i in range(12):
                    t = i / 11
                    x = hx + (ax - hx) * t
                    y = hy + (ay - hy) * t - math.sin(t * math.pi) * 10
                    pyxel.circ(x, y, 2 - t, CY_ if i % 2 else WH)
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
        pyxel.rect(5, 17, int(50 * self.ammo / 30), 4, CY_ if self.ammo >= 6 else PK)
        pyxel.rectb(4, 16, 52, 6, LV)
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
        else:
            s = "のこり %d" % max(0, GOAL - self.kills)
            self.otext(W / 2 - self.font.text_width(s) / 2, 3, s, LV, K)
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
            my = 66 if self.boss else 36   # ボス戦では ボスに かぶらない位置
            pyxel.rect(W / 2 - tw / 2 - 6, my, tw + 12, 16, K)
            pyxel.rectb(W / 2 - tw / 2 - 6, my, tw + 12, 16, VI)
            self.otext(W / 2 - tw / 2, my + 3, s, WH, K)

    def draw_title(self):
        t = self.t
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
        s = "スコア %d" % self.score
        self.otext(W / 2 - self.font.text_width(s) / 2, 72, s, WH, K)
        if self.t > 60 and self.t % 60 < 40:
            s = "おして タイトルへ"
            self.otext(W / 2 - self.font.text_width(s) / 2, 86, s, GY, K)

    def draw_ending(self):
        t = self.t
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
            s = "スコア %d" % self.score
            self.otext(W / 2 - self.font.text_width(s) / 2, 26, s, K + 1, WH)
        if t > 320 and t % 60 < 40:
            s = "おして タイトルへ"
            self.otext(W / 2 - self.font.text_width(s) / 2, 40, s, K + 1, WH)

    def otext(self, x, y, s, col, bcol):
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            pyxel.text(x + dx, y + dy, s, bcol, self.font)
        pyxel.text(x, y, s, col, self.font)


Game()
