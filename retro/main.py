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
TITLE_BTN = (W - 78, H - 22, 74, 16)   # ゲームオーバー画面の「タイトルへ」
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

# ---- 2面より先で出てくる おばけ・障害物・景色（画像バンク1の空いている場所） ----
# 文字→色：上の CMAP に、火のオレンジ(o)・火の黄(Y)・こげ茶(O)・雨の青(n) を足したもの
CMAP2 = dict(CMAP, o=OR, Y=OY, O=OD, n=RN)


def art2(img, x, y, rows, w=16):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r.ljust(w, ".")[:w]):
            img.pset(x + i, y + j, CMAP2.get(ch, 0))


BUCKET = [   # バケツおばけ（ろうか）
    "................",
    ".....kkkkkk.....",
    "....k......k....",
    "...k........k...",
    "..kkkkkkkkkkkk..",
    "..kwccccccccck..",
    "..kcwwccccwwck..",
    "..kcwkccccwkck..",
    "...kcccppccck...",
    "...kcccccccck...",
    "...knnnnnnnnk...",
    "....knnnnnnk....",
    "....kkkkkkkk....",
    ".....c....c.....",
    "......c..c......",
    "................",
]
ONPU = [     # おんぷおばけ（おんがくしつ）
    "..........kk....",
    "..........kyk...",
    "..........kyyk..",
    "..........kykyk.",
    "..........ky.kk.",
    "..........ky....",
    "..........ky....",
    "...kkkkkkkky....",
    "..kyyyyyyyyyk...",
    ".kyywwyyywwyyk..",
    ".kyywkyyywkyyk..",
    ".kyyyyyyyyyyyk..",
    ".kyyyyppppyyyk..",
    "..kyyyyyyyyyk...",
    "...kkkkkkkkk....",
    "................",
]
FLASK = [    # フラスコおばけ（りかしつ）
    ".....kkkkkk.....",
    "......kwwk......",
    "......kwwk......",
    "......kwwk......",
    ".....kwwwwk.....",
    "....kwwwwwwk....",
    "...kggggggggk...",
    "..kggwwggwwggk..",
    "..kggwkggwkggk..",
    ".kgggggggggggGk.",
    ".kgggggppgggGGk.",
    ".kggggggggggGGk.",
    "..kGGGGGGGGGGk..",
    "...kkkkkkkkkk...",
    "...l...l...l....",
    "................",
]
TAIKO = [    # たいこ（3面の障害物）
    "................",
    "................",
    "................",
    "...kkkkkkkkkk...",
    "..kwwwwwwwwwwk..",
    "..kkkkkkkkkkkk..",
    "..krrrrrrrrrrk..",
    "..kryrrrrrryrk..",
    "..krrrrrrrrrrk..",
    "..kryrrrrrryrk..",
    "..krrrrrrrrrrk..",
    "..kkkkkkkkkkkk..",
    "..kwwwwwwwwwwk..",
    "...kkkkkkkkkk...",
    "................",
    "................",
]
CONE = [     # そうじちゅうの コーン（2面の障害物）
    "................",
    ".......kk.......",
    "......kook......",
    "......kook......",
    ".....kwwwwk.....",
    ".....kwwwwk.....",
    "....kooooook....",
    "....kooooook....",
    "...kwwwwwwwwk...",
    "...kooooooook...",
    "..kooooooooook..",
    ".kkkkkkkkkkkkkk.",
    ".kOOOOOOOOOOOOk.",
    ".kkkkkkkkkkkkkk.",
    "................",
    "................",
]
LOCKER = [   # ロッカー（ろうかの景色、16x24。右の とびらから 目が のぞく）
    "kkkkkkkkkkkkkkkk",
    "knnnnnnkknnnnnnk",
    "knkkkknkknkkkknk",
    "knnnnnnkknnnnnnk",
    "knkkkknkknkkkknk",
    "knnnnnnkknnnnnnk",
    "knnnnnnkkkkkkkkk",
    "knnnnnnkkkpkpkkk",
    "knnnnnykkkkkkkkk",
    "knnnnnykkynnnnnk",
    "knnnnnnkkynnnnnk",
    "knnnnnnkknnnnnnk",
    "knnnnnnkknnnnnnk",
    "knnnnnnkknnnnnnk",
    "knnnnnnkknnnnnnk",
    "knnnnnnkknnnnnnk",
    "knnnnnnkknnnnnnk",
    "knnnnnnkknnnnnnk",
    "knnnnnnkknnnnnnk",
    "knnnnnnkknnnnnnk",
    "knnnnnnkknnnnnnk",
    "kkkkkkkkkkkkkkkk",
    "kk............kk",
    "kk............kk",
]
MODEL = [    # じんたいもけい（3面の景色、16x24。目が ピンクに光る）
    "......kkkk......",
    ".....kwwwwk.....",
    "....kwwwwwwk....",
    "....kwpwwpwk....",
    "....kwwwwwwk....",
    ".....kwkkwk.....",
    "......kwwk......",
    "....kkkwwkkk....",
    "...kwwwwwwwwk...",
    "..kwk.kwwk.kwk..",
    "..kwkwwwwwwkwk..",
    "..kwk.kwwk.kwk..",
    "..kwkwwwwwwkwk..",
    "..kk..kwwk..kk..",
    "......kwwk......",
    ".....kwwwwk.....",
    "....kwk..kwk....",
    "....kwk..kwk....",
    "....kwk..kwk....",
    "....kwk..kwk....",
    "......kddk......",
    "......kddk......",
    "....kkkkkkkk....",
    "....kddddddk....",
]
TOBIBAKO = [  # とびばこ（4面の景色）
    "................",
    "................",
    "...kkkkkkkkkk...",
    "...kwwwwwwwwk...",
    "..kkkkkkkkkkkk..",
    "..kOOOOOOOOOOk..",
    "..kkkkkkkkkkkk..",
    ".kOOOOOOOOOOOOk.",
    ".kkkkkkkkkkkkkk.",
    ".kOOOOkkkkOOOOk.",
    ".kkkkkkkkkkkkkk.",
    "kOOOOOOOOOOOOOOk",
    "kOOOOOOOOOOOOOOk",
    "kkkkkkkkkkkkkkkk",
    "................",
    "................",
]

# 全部の おばけの絵の場所（ENEMY_SPR の4体＋2面より先の3体）・体力
ALL_SPR = dict(ENEMY_SPR, bucket=(176, 0), onpu=(192, 0), flask=(208, 0))
ALL_HP = dict(ENEMY_HP, bucket=3, onpu=2, flask=2)
OBST_SPR = {"tire": (128, 0), "taiko": (224, 0), "cone": (240, 0)}           # よける障害物
SCEN_SPR = {"tree": (96, 0, 16, 16, 34), "locker": (32, 16, 16, 24, 40),      # 景色（u, v, w, h, 大きさ）
            "model": (48, 16, 16, 24, 34), "tobibako": (64, 16, 16, 16, 24)}

# ---- 面（ステージ）。1面は今までの校庭そのまま（数値は上の定数と同じ） ----
#  pats：進み具合（はじめ25%・60%まで・のこり）ごとの 隊列の種類
STAGES = [
    dict(name="こうてい", goal="こうしゃまで", tm=0, music=0, length=STAGE_LEN, mid_at=MID_AT,
         pats=(("single", "pair", "line"), ("line", "v", "circle", "dive", "tire", "pair"),
               ("line", "v", "circle", "dive", "dive", "tire", "mix")),
         single=tuple(ENEMY_SPR), pair=("randoseru", "isu"), line=("randoseru", "isu", "ball"),
         v="randoseru", circle="ball", dive="uwabaki", obst="tire", obst_with=("randoseru", "ball"),
         mid=("randoseru", "ランドセルだいおう", MID_HP), scen=("tree", "lamp"),
         boss=dict(name="おばけこうしゃ", hp=BOSS_HP, src=(0, 0), angry=(0, 64), minions=None)),
    dict(name="ろうか", goal="ろうかの おくへ", tm=1, music=2, length=60 * 70, mid_at=60 * 35,
         pats=(("single", "pair", "line"), ("line", "dive", "pair", "v", "tire"),
               ("line", "v", "dive", "dive", "tire", "mix", "circle")),
         single=("bucket", "uwabaki", "isu", "randoseru"), pair=("bucket", "isu"),
         line=("bucket", "isu", "randoseru"), v="bucket", circle="ball", dive="uwabaki",
         obst="cone", obst_with=("bucket", "randoseru"),
         mid=("bucket", "バケツだいおう", 20), scen=("locker", "lamp"),
         boss=dict(name="ロッカーだいおう", hp=60, src=(96, 0), angry=None, eyes=((18, 24), (78, 24)),
                   minions=("bucket", "uwabaki", "isu"))),
    dict(name="おんがくしつ・りかしつ", goal="りかしつの おくへ", tm=2, music=3, length=60 * 70, mid_at=60 * 35,
         pats=(("single", "pair", "line"), ("line", "circle", "pair", "v", "tire"),
               ("line", "v", "circle", "circle", "dive", "tire", "mix")),
         single=("onpu", "flask", "ball", "isu"), pair=("onpu", "flask"), line=("onpu", "flask", "isu"),
         v="onpu", circle="onpu", dive="uwabaki", obst="taiko", obst_with=("flask", "onpu"),
         mid=("flask", "フラスコだいおう", 20), scen=("model", "lamp"),
         boss=dict(name="おばけピアノ", hp=65, src=(96, 64), angry=None, eyes=((32, 31), (64, 31)),
                   minions=("onpu", "onpu", "flask"))),
    dict(name="たいいくかん", goal="ぶたいまで", tm=3, music=4, length=60 * 70, mid_at=60 * 35,
         pats=(("single", "pair", "line", "circle"), ("line", "v", "circle", "dive", "tire", "pair"),
               ("line", "v", "circle", "dive", "dive", "tire", "mix")),
         single=("randoseru", "isu", "ball", "uwabaki", "bucket", "onpu", "flask"), pair=("ball", "randoseru"),
         line=("ball", "bucket", "onpu", "randoseru"), v="randoseru", circle="ball", dive="uwabaki",
         obst="tire", obst_with=("ball", "onpu"),
         mid=("ball", "ボールだいおう", 22), scen=("tobibako", "lamp"),
         boss=dict(name="おばけとびばこ", hp=80, src=(96, 128), angry=None, eyes=((34, 27), (62, 27)),
                   minions=("ball", "randoseru", "onpu", "bucket"))),
]


def build_images():
    img = pyxel.images[1]
    img.cls(0)
    art(img, 0, 0, RANDOSERU)
    art(img, 16, 0, ISU)
    art(img, 32, 0, BALL)
    art(img, 48, 0, UWABAKI)
    load_enemy_sheet(img)
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
    load_title_image()
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
# 目（弱点）は生成画像の白い窓：左 x19-27・右 x68-76、y36-44（中心は BOSS_EYE_C）。
# "angry" は目の中のピンクを赤に置きかえる。画像が無いときは draw_school の絵と目の位置のまま。
BOSS_PNG = "boss_school.png"
BOSS_EYES = ((19, 36, 9, 9), (68, 36, 9, 9))
BOSS_EYE_C = [(25, 34), (73, 34)]   # 当たり判定の中心（96x64 の絵の上の座標）。draw_school の絵の位置


# 生成画像の敵4体（64x16、NIGHT パレットに減色ずみ。ENEMY_SPR と同じ順）。
# 無いとき・読めないとき・マスが空（全部 色0）のキャラは、上の文字のドット絵のまま
ENEMY_PNG = "enemies.png"


def load_enemy_sheet(img):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ENEMY_PNG)
    if not os.path.exists(path):
        return
    try:
        img.load(0, 0, path)
    except Exception:
        pass
    for (u, v), rows in zip(ENEMY_SPR.values(), (RANDOSERU, ISU, BALL, UWABAKI)):
        if all(img.pget(u + x, v + y) == 0 for y in range(16) for x in range(16)):
            art(img, u, v, rows)


# 生成画像のタイトル背景（288x162、NIGHT パレットに減色ずみ）。無いときは今までどおり校庭の景色
TITLE_PNG = "title_bg.png"
TITLE_IMG = []
TITLE_LAMPS = ((35, 70), (252, 86))   # 絵の中の かぼちゃ外灯の頭


# 生成画像のゲームオーバー背景（288x162）。無いときは今までどおりゲーム画面の上に帯だけ
OVER_PNG = "over_bg.png"
OVER_IMG = []


def load_title_image():
    here = os.path.dirname(os.path.abspath(__file__))
    for name, box in ((TITLE_PNG, TITLE_IMG), (OVER_PNG, OVER_IMG)):
        path = os.path.join(here, name)
        if os.path.exists(path):
            try:
                box.append(pyxel.Image.from_image(path))
            except Exception:
                pass


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
    BOSS_EYE_C[:] = [(ex + ew / 2, ey + eh / 2) for ex, ey, ew, eh in BOSS_EYES]
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


def build_stage_images():
    # 2面より先の絵。バンク1：x176〜255,y0〜15（おばけ3体＋障害物2つ）と y16〜39 の x32〜79（景色）
    img = pyxel.images[1]
    art2(img, 176, 0, BUCKET)
    art2(img, 192, 0, ONPU)
    art2(img, 208, 0, FLASK)
    art2(img, 224, 0, TAIKO)
    art2(img, 240, 0, CONE)
    art2(img, 32, 16, LOCKER)
    art2(img, 48, 16, MODEL)
    art2(img, 64, 16, TOBIBAKO)
    # ボス（バンク2の x96〜191）：ろうか・おんがくしつ・たいいくかん
    b = pyxel.images[2]
    draw_locker_boss(b, 96, 0)
    draw_piano_boss(b, 96, 64)
    draw_tobibako_boss(b, 96, 128)
    # 床のタイル（バンク0 の y8〜31。1面のタイルは y0〜7）
    g = pyxel.images[0]
    # ろうか（y=8）：木の床（板の継ぎ目）・かべぎわ
    g.rect(0, 8, 8, 8, SD); g.line(7, 8, 7, 15, GD); g.pset(3, 10, GY); g.pset(2, 14, GD)
    g.rect(8, 8, 8, 8, SD); g.line(15, 8, 15, 15, GD); g.line(8, 12, 14, 12, GD)
    g.rect(16, 8, 8, 8, DK); g.pset(18, 10, D1); g.pset(21, 13, D1)
    g.rect(24, 8, 8, 8, D1); g.line(24, 8, 31, 8, GD)
    # おんがくしつ・りかしつ（y=16）：むらさきの市松もよう
    g.rect(0, 16, 8, 8, PU); g.pset(2, 18, VI)
    g.rect(8, 16, 8, 8, DK); g.pset(12, 21, D1)
    g.rect(16, 16, 8, 8, D1); g.pset(19, 19, DK)
    # たいいくかん（y=24）：明るい木の床とコートの線
    g.rect(0, 24, 8, 8, OD); g.line(7, 24, 7, 31, GD)
    g.rect(8, 24, 8, 8, OD); g.rect(11, 24, 2, 8, GO)
    g.rect(16, 24, 8, 8, OD); g.rect(16, 27, 8, 2, GO)
    g.rect(24, 24, 8, 8, DK); g.pset(26, 26, D1)
    g.rect(32, 24, 8, 8, OD); g.rect(35, 24, 2, 8, WH)
    g.rect(40, 24, 8, 8, OD); g.line(47, 24, 47, 31, GD); g.pset(43, 27, OR)
    for n in (1, 2, 3):
        tm = pyxel.tilemaps[n]
        tm.imgsrc = 0
        # 32行（256ドット）ごとのくり返し（ずらす量1024の約数）。1行を文字列にして まとめて書く
        rows = [" ".join("%02x%02x" % stage_tile(n, tx - 128, ty) for tx in range(256)) for ty in range(32)]
        for y in range(0, 256, 32):
            tm.set(0, y, rows)


def stage_tile(n, dx, ty):
    if n == 1:      # ろうか
        if abs(dx) > 17:
            return (2, 1)
        if abs(dx) == 17:
            return (3, 1)
        return (1, 1) if (ty + (dx % 5) * 7) % 12 == 0 else (0, 1)
    if n == 2:      # おんがくしつ・りかしつ
        if abs(dx) > 17:
            return (2, 2)
        return (0, 2) if ((dx // 2) + (ty // 2)) % 2 == 0 else (1, 2)
    # たいいくかん
    if abs(dx) > 17:
        return (3, 3)
    if dx in (-14, 13):
        return (1, 3)
    if ty % 32 == 0 and abs(dx) < 14:
        return (2, 3)
    if dx == 0 and ty % 8 < 4:
        return (4, 3)
    return (5, 3) if (ty + dx * 3) % 9 == 0 else (0, 3)


def boss_eye(img, cx, cy):
    # ボスの目（弱点）。ピンクのひとみ。おこると えがく時に赤へ置きかえる
    img.rect(cx - 5, cy - 5, 10, 10, WH)
    img.rect(cx - 2, cy - 3, 5, 6, PK)
    img.rectb(cx - 5, cy - 5, 10, 10, D1)
    img.line(cx - 7, cy - 8, cx + 6, cy - 7 + (1 if cx < 48 else -1), D1)


def boss_teeth(img, x, y, n, down=True):
    for t in range(n):
        if down:
            img.tri(x + t * 4, y, x + 4 + t * 4, y, x + 2 + t * 4, y + 5, WH)
        else:
            img.tri(x + t * 4, y, x + 4 + t * 4, y, x + 2 + t * 4, y - 5, WH)


def draw_locker_boss(img, ox, oy):
    img.rect(ox, oy, 96, 64, 0)
    img.rect(ox + 2, oy + 1, 92, 4, D1)
    for i in range(3):
        x = ox + 4 + i * 30
        img.rect(x, oy + 4, 28, 58, RN)
        img.rectb(x, oy + 4, 28, 58, D1)
        img.line(x + 1, oy + 5, x + 26, oy + 5, GY)
        if i != 1:
            for v in range(3):
                img.line(x + 6, oy + 38 + v * 3, x + 21, oy + 38 + v * 3, D1)
            img.rect(x + (2 if i == 2 else 23), oy + 48, 2, 6, GO)
    # まん中の とびらが あいて 口に（中は まっくら、歯つき）
    img.rect(ox + 36, oy + 12, 24, 48, D1)
    boss_teeth(img, ox + 38, oy + 12, 5)
    boss_teeth(img, ox + 38, oy + 59, 5, down=False)
    img.rect(ox + 44, oy + 44, 8, 8, PK)
    img.rect(ox + 60, oy + 10, 3, 52, GY)     # ひらいた とびら
    boss_eye(img, ox + 18, oy + 24)
    boss_eye(img, ox + 78, oy + 24)


def draw_piano_boss(img, ox, oy):
    img.rect(ox, oy, 96, 64, 0)
    img.tri(ox + 8, oy + 20, ox + 86, oy + 20, ox + 70, oy + 1, DK)      # ふた
    img.line(ox + 8, oy + 20, ox + 70, oy + 1, PU)
    img.line(ox + 70, oy + 1, ox + 86, oy + 20, D1)
    img.line(ox + 70, oy + 1, ox + 60, oy + 20, D1)                      # つっかえ棒
    img.rect(ox + 6, oy + 20, 84, 22, DK)
    img.rectb(ox + 6, oy + 20, 84, 22, D1)
    img.line(ox + 7, oy + 21, ox + 88, oy + 21, PU)
    # けんばん＝口（白けんが歯）
    img.rect(ox + 8, oy + 40, 80, 11, WH)
    img.rectb(ox + 7, oy + 39, 82, 13, D1)
    for k in range(20):
        img.line(ox + 8 + k * 4, oy + 40, ox + 8 + k * 4, oy + 50, GY)
        if k % 7 not in (2, 6) and k < 19:
            img.rect(ox + 10 + k * 4, oy + 40, 2, 6, D1)
    img.rect(ox + 12, oy + 52, 4, 11, DK)
    img.rect(ox + 80, oy + 52, 4, 11, DK)
    img.rect(ox + 44, oy + 58, 8, 3, GO)                                 # ペダル
    img.circ(ox + 24, oy + 16, 2, OR)                                    # ふたの上の ろうそく
    img.pset(ox + 24, oy + 13, OY)
    boss_eye(img, ox + 32, oy + 31)
    boss_eye(img, ox + 64, oy + 31)


def draw_tobibako_boss(img, ox, oy):
    img.rect(ox, oy, 96, 64, 0)
    img.rect(ox + 26, oy + 6, 44, 9, WH)                                 # 上の白い クッション
    img.rectb(ox + 26, oy + 6, 44, 9, D1)
    img.line(ox + 28, oy + 8, ox + 67, oy + 8, GY)
    for i in range(5):
        y = oy + 14 + i * 10
        x0, w = ox + 22 - i * 4, 52 + i * 8
        img.rect(x0, y, w, 10, OD)
        img.rectb(x0, y, w, 10, D1)
        img.line(x0 + 1, y + 1, x0 + w - 2, y + 1, OR)
    # 手をかける あな＝口
    img.rect(ox + 32, oy + 44, 32, 9, D1)
    boss_teeth(img, ox + 32, oy + 44, 8)
    boss_eye(img, ox + 34, oy + 27)
    boss_eye(img, ox + 62, oy + 27)


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
    # 2面より先の曲：低音と心臓の音は同じで、旋律だけ かえる（たいいくかんは 少し速い）
    s[16].set(sp("a3rrr c4rrr e4rrr d#4rrr d4rrr c4rrr b3rrr rrrr"), "t", "5", "v", 22)
    s[17].set(sp("e4rd#4r e4rrr b3rc4r a3rrr f4re4r d#4rrr e4rb3r a3rrr"), "p", "4", "v", 22)
    s[18].set(sp("a3ra3r c4ra3r e4rd#4r d4rc4r a3ra3r c4ra3r f4re4r d#4rrr"), "t", "5", "v", 18)
    s[19].set(sp(bas), "t", "6", "n", 18)
    s[20].set(sp(drm), "n", "3", "f", 18)
    pyxel.musics[0].set([0], [1], [2])
    pyxel.musics[1].set([12], [13], [14])
    pyxel.musics[2].set([16], [1], [2])
    pyxel.musics[3].set([17], [1], [2])
    pyxel.musics[4].set([18], [19], [20])


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
        build_stage_images()
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
        self.set_stage(0)
        self.cx, self.cy = X0, 1900.0
        self.px = X0
        self.objs = []
        self.scenery = []
        self.fx = []
        self.reset_scenery()
        pyxel.colors[:] = NIGHT
        pyxel.stop()

    def set_stage(self, n):
        # n面（0から）の数値と見た目をえらぶ。1面は今までの定数と同じ値
        self.stage = n
        self.look = n          # 地面・景色の見た目（エンディングは校庭にもどる）
        self.st = STAGES[n]
        self.slen = self.st["length"]
        self.mid_at = self.st["mid_at"]
        self.mid_hp = self.st["mid"][2]
        self.boss_hp = self.st["boss"]["hp"]
        self.phase = "road"

    def start(self):
        # はじめから。OBAKE_STAGE=2 などで その面から始める（動作確認用）
        self.score = 0
        self.pw = 1           # みずでっぽうのレベル（1〜3）
        self.conts = 0        # つづけた回数
        try:
            n = int(os.environ.get("OBAKE_STAGE", "1")) - 1
        except ValueError:
            n = 0
        self.begin_stage(max(0, min(len(STAGES) - 1, n)))

    def continue_stage(self):
        # ゲームオーバーのあと、その面の はじめから（スコアと パワーは 面の はじめに もどす）
        self.conts += 1
        self.score = self.score0
        self.pw = self.pw0
        self.begin_stage(self.stage)

    def begin_stage(self, n):
        self.set_stage(n)
        self.score0 = self.score
        self.pw0 = self.pw
        self.state = "play"
        self.t = 0
        self.hearts = 5
        self.ammo = float(AMMO_MAX)
        self.kills = 0
        self.run = 0          # 進んだ道のり（中ボス中は止まる）
        self.phase = "road"   # road → mid → road2 → boss
        self.mid = None
        self.gold_next = 14   # 何体たおしたら光るおばけが出るか
        self.dda = 0.0        # やられたら上がる「やさしさ」（ボスと弾がゆるくなる）
        self.form_t = 120
        self.formation_n = 0
        self.dodge_until = 0
        self.safe_x = None
        self.dmg_taken = 0
        self.combo = 0
        self.combo_t = 0
        self.chime = 0
        self.inv = 0
        self.cool = 0
        self.rest = 0
        self.shake = 0
        self.flash = 0
        self.msg = None       # 面の名前は 大きな帯で出す（draw_banner）
        self.boss = None
        self.enemies = []
        self.shots = []
        self.bullets = []
        self.fx = []
        self.aim = [W / 2, H / 2 - 10]
        self.cx, self.cy, self.px = X0, 1900.0, X0
        self.reset_scenery()
        pyxel.colors[:] = NIGHT
        pyxel.playm(self.st["music"], loop=True)
        if getattr(self, "auto", None):
            print("STAGE", n + 1, self.st["name"], "score", self.score, flush=True)

    def reset_scenery(self):
        self.scenery = []
        for i in range(14):
            for side in (-1, 1):
                o = Obj()
                o.x = X0 + side * random.uniform(150, 175)
                o.y = self.cy - i * 48 - (24 if side > 0 else 0)
                o.kind = STAGES[self.look]["scen"][1 if (i + (side > 0)) % 3 == 0 else 0]
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
            if self.t > (120 if self.auto else 60):   # 自動プレイは 画面を確かめられるよう少し待つ
                if (pyxel.btnp(pyxel.KEY_X) or pyxel.btnp(pyxel.GAMEPAD1_BUTTON_B)
                        or (pyxel.btnp(pyxel.MOUSE_BUTTON_LEFT) and self.in_title_btn())):
                    self.title()
                elif self.pressed():
                    self.continue_stage()
            return
        if self.state == "clear":
            self.update_clear()
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
        # 動作確認用オートも、新しい予告の安全地帯へ移動する。
        safe = self.safe_x if self.run < self.dodge_until else None
        if self.boss and self.boss.state == "fight" and (self.boss.warn or self.bullets):
            safe = getattr(self.boss, "safe_x", None)
        if safe is not None:
            self.aim[0] = max(4, min(W - 4, W / 2 + (safe - self.px) * W / 9))
            # 安全地帯に着いていたら、そこから近いほうのボスの目をねらう（人がするのと同じく、よけながら うつ）
            if self.boss and self.boss.state == "fight" and abs(safe - self.px) < 10:
                eyes = [self.boss_eye_pos(i) for i in range(2) if getattr(self.boss, "shut", None) != i]
                ex, ey, er = min(eyes, key=lambda e: abs(e[0] - self.aim[0]))
                self.aim[0], self.aim[1] = ex, ey
            return
        best = None
        for e in self.enemies:
            if e.mode == "tire":
                continue
            p = self.proj(e.x, e.y, e.z + e.s / 2)
            if p and (best is None or p[2] < best[2]):
                best = p
        if self.boss and self.boss.state == "fight":
            open_eyes = [i for i in (0, 1) if getattr(self.boss, "shut", None) != i]
            best = self.boss_eye_pos(open_eyes[int(self.t / 90) % len(open_eyes)])
        if best:
            self.aim[0] += (best[0] - self.aim[0]) * 0.25
            self.aim[1] += (best[1] - self.aim[1]) * 0.25

    def tap_bell(self):
        return (pyxel.btnp(pyxel.MOUSE_BUTTON_LEFT) and pyxel.mouse_x < 30 and pyxel.mouse_y > H - 30)

    def say(self, s, d=90):
        self.msg = (s, d)

    def showing_msg(self):
        return bool(self.msg and self.msg[1] > 0)

    # ---------- てきの出し方（ディレクター） ----------
    def director(self):
        if self.boss:
            return
        if self.phase in ("road", "road2"):
            self.run += 1
            if self.phase == "road" and self.run >= self.mid_at:
                self.start_mid()
                return
            if self.run >= self.slen:
                if not [e for e in self.enemies if e.mode != "tire"]:
                    self.start_boss()
                return
            prog = self.run / self.slen
            self.form_t -= 1
            alive = len([e for e in self.enemies if e.mode != "tire"])
            if self.run < self.dodge_until:
                return
            if self.form_t <= 0 and alive < 5:   # 隊列は最大6体なので、同時に10体前後までにおさえる
                if prog > 0.25 and (self.formation_n + 1) % 3 == 0 and self.enemies:
                    self.form_t = 10
                    return
                self.formation(prog)
                self.form_t = int(random.uniform(95, 125) - prog * 45)
            elif alive == 0 and self.form_t > 20:
                self.form_t = 20          # 画面が からっぽの時間を つくらない
            elif alive <= 2 and self.form_t > 50:
                self.form_t = 50          # のこりが少なくなったら 次を早めに
        elif self.phase == "mid":
            self.update_mid()

    def formation(self, prog):
        self.formation_n += 1
        if prog > 0.25 and self.formation_n % 3 == 0:
            self.safe_x = max(X0 - 75, min(X0 + 75, self.cx + random.choice((-55, 0, 55))))
            for b in self.bullets:
                p = self.proj(b.x, b.y, b.z)
                if p:
                    self.fx.append(("pop", p[0], p[1], 0, 0, 10))
            self.bullets.clear()
            self.dodge_until = self.run + 155
            self.form_t = 100
            for dx in (-90, -45, 0, 45, 90):
                x = self.cx + dx
                if abs(x - self.safe_x) > 32:
                    self.spawn(self.st["obst"], x, self.cy - 230, mode="tire")
            self.say("よける！ みずいろの すきまへ", 100)
            return
        before = len(self.enemies)
        self.spawn_formation(prog)
        members = [e for e in self.enemies[before:] if e.mode != "tire"]
        if len(members) >= 2:
            group = {"left": len(members), "failed": False}
            for e in members:
                e.formation = group
        if self.formation_n <= 2:   # 何度も出ると じゃまなので、はじめの2回だけ
            self.say("ねらって ぜんぶ ポン！", 65)

    def spawn_formation(self, prog):
        r = random.random()
        cx = self.px + random.uniform(-40, 40)
        far = self.cy - 300
        st = self.st          # 面ごとの 隊列と おばけの種類（1面は今までと同じ）
        pats = st["pats"][0 if prog < 0.25 else 1 if prog < 0.6 else 2]
        pat = random.choice(pats)
        if pat == "single":
            self.spawn(random.choice(st["single"]), cx, far)
        elif pat == "pair":
            for dx in (-30, 30):
                self.spawn(random.choice(st["pair"]), cx + dx, far)
        elif pat == "line":
            n = 4 if prog < 0.5 else 5
            k = random.choice(st["line"])
            for i in range(n):
                self.spawn(k, cx + (i - (n - 1) / 2) * 26, far, mode="line")
        elif pat == "v":
            for i in range(5):
                d = abs(i - 2)
                self.spawn(st["v"], cx + (i - 2) * 24, far - d * 30, mode="line")
        elif pat == "circle":
            for i in range(6):
                e = self.spawn(st["circle"], cx, far, mode="circle")
                e.ang = i * math.pi / 3
        elif pat == "dive":
            for dx in (-50, 50):
                self.spawn(st["dive"], cx + dx, far, mode="dive")
        elif pat == "tire":
            for i in range(random.randint(2, 3)):
                self.spawn(st["obst"], self.px + random.uniform(-70, 70), far - i * 50, mode="tire")
            self.spawn(random.choice(st["obst_with"]), cx, far - 40)
        else:
            for dx in (-30, 0, 30):   # 1面は main と同じ（ランドセロ3体）。ほかの面は その面の v のおばけ
                self.spawn(st["v"], cx + dx, far, mode="line")
            self.spawn(st["dive"], cx, far - 60, mode="dive")

    def spawn(self, kind=None, x=None, y=None, mode="sway"):
        e = Obj()
        e.kind = kind or random.choices(list(ENEMY_SPR), weights=(4, 2, 3, 3))[0]
        e.mode = mode
        e.hp = 999 if mode == "tire" else ALL_HP.get(e.kind, 1)
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
                prog = self.run / self.slen
                e.throw = int(random.randint(110, 200) * (1 + self.dda * 0.8) - prog * 40)
        if dist < PD:
            e.gone = True
            if hasattr(e, "formation"):
                e.formation["failed"] = True
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
        self.dodge_until = 0
        self.safe_x = None
        self.enemies = [e for e in self.enemies if e.mode != "tire"]
        self.bullets.clear()
        self.phase = "mid"
        kind, name, hp = self.st["mid"]
        m = self.spawn(kind, self.px, self.cy - 260, mode="mid")
        m.big = True
        m.gold = True
        m.hp = hp
        m.s = 44
        m.z = 6
        m.vy = 0
        m.dist = 260.0
        m.atk = 90
        m.mt = 0          # 中ボスの時計（ガードの周期）
        m.max_hp = hp
        self.mid = m
        pyxel.playm(1, loop=True)
        pyxel.play(3, 7)
        self.say("%s が きた！" % name, 140)

    def update_mid(self):
        m = self.mid
        if m.gone:
            self.mid = None
            self.phase = "road2"
            pyxel.playm(self.st["music"], loop=True)
            self.say("%sを たおした！" % self.st["mid"][1], 120)
            return
        m.dist = max(140, m.dist - 1.2)
        m.y = self.cy - m.dist
        goal = self.cx + math.sin(self.t * 0.015) * 55   # 画面の中を 左右に ゆれる
        m.base_x += (goal - m.base_x) * 0.03
        m.atk -= 1
        # ガード：220フレームごとに 70フレーム かたくなる（その前の20フレームは「！」で予告）。ガード中は水が きかない
        m.mt += 1
        ph = m.mt % 220
        m.guard = ph >= 150
        m.guard_warn = 130 <= ph < 150
        if ph == 150:
            self.say("ガード！ いまは きかない", 50)
        angry = m.hp <= m.max_hp / 2
        if m.atk <= 0:
            if random.random() < 0.5:
                for dx in ((-48, -24, 0, 24, 48) if angry else (-30, 0, 30)):   # おこると 5つ
                    self.throw(m.x + dx, m.y, 24)
            else:
                for dx in (-36, 36):
                    self.spawn(self.st["mid"][0], m.x + dx, m.y + 5)
            m.atk = int(110 * (1 + self.dda * 0.8))

    def throw(self, x, y, z, dur=None):
        if dur is None:
            dur = 70 - 18 * min(1, self.run / self.slen)
        dur = int(dur * (1 + self.dda * 0.45))
        b = Obj()
        b.sx, b.sy, b.sz = x, y, z
        b.tx, b.ty, b.tz = self.px + random.uniform(-6, 6), self.cy - PD, 6
        b.x, b.y, b.z = x, y, z
        b.t, b.dur, b.gone = 0, dur, False
        self.bullets.append(b)

    def fire(self):
        self.ammo -= 1
        self.fire_t = 6   # 主人公の はんどう・水しぶきの光（見た目だけ）
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
                if e.mode == "mid" and getattr(e, "guard", False):
                    pyxel.play(3, 8)
                    self.fx.append(("txt", ax, ay, "カキン", 0, 20))
                    continue
                e.hp -= dmg
                e.hit = 6
                if e.hp <= 0:
                    self.kill(e)
                else:
                    pyxel.play(3, 8)
            return
        if self.boss and self.boss.state == "fight":
            for i in (0, 1):
                if getattr(self.boss, "shut", None) == i:   # とじた目は きかない（下の カキン へ）
                    continue
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
        if e.gone:
            return
        e.gone = True
        if hasattr(e, "formation"):
            group = e.formation
            group["left"] -= 1
            if group["left"] == 0 and not group["failed"]:
                self.score += 1000
                self.ammo = min(AMMO_MAX, self.ammo + 8)
                self.chime = min(100, self.chime + (0 if getattr(self, "chiming", False) else 10))
                self.fx.append(("txt", W / 2, 26, "ぜんぶ ポン！ +1000", 0, 40))
                pyxel.play(2, 10)
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
        if os.environ.get("OBAKE_NODIE") or (self.auto and os.environ.get("OBAKE_GOD")):   # 動作確認用：やられない
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
        self.dodge_until = 0
        self.safe_x = None
        self.enemies.clear()
        self.bullets.clear()
        b = Obj()
        b.dist = 520.0
        b.y = self.cy - b.dist
        b.x = X0
        b.hp = self.boss_hp
        b.state = "come"
        b.t = 0
        b.atk = 120
        b.hit = 0
        b.pattern = 0
        b.warn = False
        b.shut = None      # おこったら 片方の目を とじる（とじた目は きかない）
        self.boss = b
        pyxel.playm(1, loop=True)
        pyxel.play(3, 7)
        self.say(("チャイムで おばけこうしゃが おきた！" if self.stage == 0
                  else "%s が あらわれた！" % self.st["boss"]["name"]), 150)

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

    def boss_eyes(self):
        return self.st["boss"].get("eyes") or BOSS_EYE_C   # 1面は生成画像に合わせた位置

    def boss_eye_pos(self, i):
        bx, by, bw, bh = self.boss_rect()
        sc = bw / 96
        ex = bx + self.boss_eyes()[i][0] * sc
        ey = by + self.boss_eyes()[i][1] * sc
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
            rage = b.hp < self.boss_hp / 2
            if b.atk <= 60 and not b.warn:
                b.warn = True
                b.pattern = (b.pattern + 1) % 3
                b.safe_x = max(X0 - 75, min(X0 + 75, self.cx + (55 if b.pattern == 0 else -55 if b.pattern == 1 else 0)))
                self.say(("ひだりめ！ みぎへ よけよう", "みぎめ！ ひだりへ よけよう", "りょうめ！ まんなかが あんぜん")[b.pattern], 65)
                pyxel.play(3, 7)
            if b.atk <= 0:
                for dx in (-90, -45, 0, 45, 90):
                    tx = self.cx + dx
                    if abs(tx - b.safe_x) > 32:
                        self.throw(b.x + dx * 0.4, b.y + 5, 30, dur=80 if rage else 95)
                        self.bullets[-1].tx = tx
                b.atk = int((125 if rage else 155) * (1 + self.dda * 0.8))
                b.warn = False
                if rage and random.random() < 0.5:   # おこると ときどき 手下を 2体 よぶ
                    mk = self.st["boss"].get("minions")
                    for i in range(2):
                        self.spawn(random.choice(mk) if mk else None, b.x + random.uniform(-50, 50), b.y + 10)
            if rage:
                ns = 0 if (b.t // 150) % 2 == 0 else 1
                if b.shut != ns:
                    b.shut = ns
                    self.say(("ひだりめ", "みぎめ")[1 - ns] + "が あいた！", 50)
            if rage and b.t % 240 == 0:
                self.say("おこった！ めが まっかだ！", 90)
        elif b.state == "die":
            b.dist += 0.3
            if b.t % 6 == 0:
                bx, by, bw, bh = self.boss_rect()
                self.fx.append(("pop", bx + random.uniform(0, bw), by + random.uniform(0, bh), 0, 0, 16))
                pyxel.play(3, 4)
            if b.t > 150:
                if self.stage < len(STAGES) - 1:
                    self.start_clear()
                else:
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
            self.say("やった！ %sを たいじ！" % self.st["boss"]["name"], 150)

    def get_rank(self):
        n = self.stage + 1    # すすんだ面の数だけ 基準を上げる（1面だけなら今までと同じ）
        for th, r in RANKS:
            if self.score >= th * n:
                return r
        return "C"

    # ---------- 面クリア → 次の面へ ----------
    def start_clear(self):
        self.state = "clear"
        self.t = 0
        self.boss = None
        self.enemies = []
        self.bullets = []
        self.best = max(self.best, self.score)
        pyxel.stop()
        pyxel.play(3, 9)

    def update_clear(self):
        self.cy -= 0.6
        self.scroll_world()
        self.update_fx()
        if self.t > 150 and (self.pressed() or self.t > 600):
            self.begin_stage(self.stage + 1)

    def in_title_btn(self):
        x, y, w, h = TITLE_BTN
        return x <= pyxel.mouse_x <= x + w and y <= pyxel.mouse_y <= y + h

    # ---------- エンディング：夜明け→学校がもとにもどる→「あー よかった」 ----------
    def start_ending(self):
        self.state = "ending"
        self.t = 0
        self.look = 0         # 外（校庭）に出て 夜明けを見る
        self.cx = self.px = X0
        self.reset_scenery()
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
            if f[0] == "dust":       # 主人公の 土けむり：うしろへ ながれて 少し上がる
                f[1] += f[3]
                f[2] += 0.5
            if f[5] > 0:
                out.append(tuple(f))
        self.fx = out

    # ---------- 描画 ----------
    def kid_screen(self):
        return W / 2 - 8 + (self.px - self.cx) * 1.6, H - 26

    def draw(self):
        sx = random.randint(-2, 2) if getattr(self, "shake", 0) else 0
        pyxel.camera(sx, 0)
        if not (self.state == "title" and TITLE_IMG):   # タイトルは生成画像の背景を使う
            self.draw_world()
        if self.state == "title":
            self.draw_title()
        elif self.state in ("play", "over", "clear"):
            self.draw_play()
            if self.state == "over":
                self.draw_over()
            elif self.state == "clear":
                self.draw_clear()
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
        if self.look:
            self.draw_room(hz)
        else:
            self.draw_sky(hz)
        # 地面（Pyxel 3.0 の bltm3d）。面ごとに別のタイルマップ
        pyxel.bltm3d(0, 0, W, H, STAGES[self.look]["tm"], (self.cx, self.cy, CAM_Z), (PITCH, 0, 0), fov=FOV, colkey=None)
        # 遠くを くらく（きりの代わりに 横線を ちらす）
        for y in range(int(hz), int(hz) + 10, 2):
            pyxel.line(0, y, W, y, K if self.state != "ending" else GY)

    def draw_sky(self, hz):
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

    def draw_room(self, hz):
        # 校舎の中：地平線より上を かべ・天井・まど にする（景色は横に少し ずれる）
        ox = -(self.cx - X0) * 0.3
        t = self.t
        lit = self.lflash in (7, 6, 3)
        if self.look == 1:      # ろうか：天井の蛍光灯・雨の まど・おくの とびら
            pyxel.rect(0, 0, W, hz, DK)
            pyxel.rect(0, 0, W, 7, D1)
            for i in range(-1, 6):
                x = i * 60 + ox % 60
                on = (t // 6 + i * 5) % 37 != 0
                pyxel.rect(x, 2, 28, 3, WH if on else GY)
            for i in range(-1, 8):
                x = i * 44 + (ox * 1.4) % 44
                pyxel.rect(x, 12, 32, 26, GY)
                pyxel.rect(x + 2, 14, 28, 22, WH if lit else K)
                for j in range(3):
                    rx = x + 4 + (j * 9 + t * 2) % 24
                    ry = 15 + (j * 7 + t * 3) % 18
                    pyxel.line(rx, ry, rx + 1, ry + 3, RN)
                pyxel.line(x + 16, 14, x + 16, 35, GY)
                pyxel.line(x + 2, 24, x + 29, 24, GY)
            pyxel.rect(0, hz - 12, W, 12, GD)
            pyxel.line(0, hz - 12, W, hz - 12, SD)
            dx = W / 2 + ox * 0.5
            pyxel.rect(dx - 16, hz - 34, 32, 34, D1)
            pyxel.rectb(dx - 16, hz - 34, 32, 34, SD)
            pyxel.line(dx, hz - 34, dx, hz, SD)
            pyxel.rect(dx - 9, hz - 42, 18, 6, DG)
            pyxel.rect(dx - 3, hz - 41, 3, 4, WH)
            if t % 90 < 45:   # とびらの まどから 目が のぞく
                pyxel.pset(dx - 8, hz - 26, PK)
                pyxel.pset(dx - 5, hz - 26, PK)
        elif self.look == 2:    # おんがくしつ（中ボスまで）→ りかしつ
            music = self.phase in ("road", "mid")
            pyxel.rect(0, 0, W, hz, D1)
            pyxel.rect(0, hz - 9, W, 9, GD)
            bx = W / 2 - 60 + ox * 0.5
            pyxel.rect(bx, 8, 120, 34, DG)
            pyxel.rectb(bx - 1, 7, 122, 36, OD)
            pyxel.rect(bx + 10, 42, 100, 2, OD)
            if music:
                for j in range(5):
                    pyxel.line(bx + 6, 14 + j * 5, bx + 113, 14 + j * 5, GY)
                for k in range(7):
                    nx = bx + 16 + k * 14
                    ny = 14 + ((k * 3 + t // 30) % 5) * 5
                    pyxel.circ(nx, ny, 2, WH)
                    pyxel.line(nx + 2, ny, nx + 2, ny - 8, WH)
                for side in (-1, 1):   # 音楽家の しょうぞう画（目が ピンクに光る）
                    px = W / 2 + side * 100 - 11 + ox * 0.6
                    pyxel.rect(px, 10, 22, 28, OD)
                    pyxel.rect(px + 2, 12, 18, 24, DK)
                    pyxel.circ(px + 11, 22, 6, SD)
                    pyxel.rect(px + 4, 28, 14, 8, D1)
                    c = PK if (t + side * 40) % 120 < 60 else D1
                    pyxel.pset(px + 9, 21, c)
                    pyxel.pset(px + 13, 21, c)
            else:
                pyxel.text(bx + 10, 14, "H2O + ?", WH)
                pyxel.text(bx + 10, 26, "O O O ->", GY)
                pyxel.circb(bx + 90, 24, 9, WH)
                for side in (-1, 1):   # くすりの たな（フラスコが ぶくぶく）
                    sx = W / 2 + side * 104 - 18 + ox * 0.6
                    for j in range(3):
                        y = 14 + j * 13
                        pyxel.rect(sx, y + 9, 36, 2, OD)
                        for k in range(4):
                            fx = sx + 3 + k * 9
                            col = (CY_, GR, PK, GO)[(j + k) % 4]
                            pyxel.rect(fx + 1, y, 2, 4, GY)
                            pyxel.circ(fx + 2, y + 6, 3, col)
                            if (t // 8 + j + k * 3) % 11 == 0:
                                pyxel.pset(fx + 2, y - 2, WH)
        else:                   # たいいくかん：高い まど・木のかべ・ぶたいの 赤いまく
            pyxel.rect(0, 0, W, hz, DK)
            for i in range(-1, 26):   # 天井の はり
                x = i * 12 + (ox * 1.6) % 12
                pyxel.line(x, 0, x + 3, 12, D1)
            pyxel.line(0, 12, W, 12, D1)
            for i in range(-1, 10):
                x = i * 34 + (ox * 1.2) % 34
                pyxel.rect(x, 15, 26, 10, GY)
                pyxel.rect(x + 1, 16, 24, 8, WH if lit else K)
                pyxel.line(x + 6 + (t * 2 + i * 5) % 14, 17, x + 7 + (t * 2 + i * 5) % 14, 21, RN)
            pyxel.rect(0, 27, W, hz - 27, OD)
            for i in range(-1, 26):
                x = i * 12 + (ox * 1.2) % 12
                pyxel.line(x, 27, x, hz, GD)
            sx = W / 2 + ox * 0.5
            pyxel.rect(sx - 54, hz - 36, 108, 36, K)
            pyxel.rect(sx - 54, hz - 40, 108, 7, RD)
            pyxel.rect(sx - 54, hz - 36, 20, 30, RD)
            pyxel.rect(sx + 34, hz - 36, 20, 30, RD)
            for k in range(4):
                pyxel.line(sx - 50 + k * 5, hz - 33, sx - 50 + k * 5, hz - 7, PK)
                pyxel.line(sx + 38 + k * 5, hz - 33, sx + 38 + k * 5, hz - 7, PK)
            pyxel.rect(sx - 56, hz - 6, 112, 6, GD)
            for side in (-1, 1):   # バスケットゴール
                gx = sx + side * 100
                pyxel.rect(gx - 10, 22, 20, 13, WH)
                pyxel.rectb(gx - 10, 22, 20, 13, GY)
                pyxel.rectb(gx - 4, 27, 8, 6, RD)
                pyxel.line(gx - 5, 35, gx + 5, 35, OR)
                pyxel.line(gx - 4, 36, gx - 2, 41, WH)
                pyxel.line(gx + 4, 36, gx + 2, 41, WH)

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
            for c in range(1, len(NIGHT)):
                pyxel.pal(c, WH)
        pyxel.blt(cx - w / 2, cy - h / 2, 1, u, v, w, h, 0, scale=sc)
        if flash:
            pyxel.pal()

    def draw_safe_lane(self, world_x):
        p = self.proj(world_x, self.cy - PD, 1)
        if not p:
            return
        x = max(18, min(W - 18, p[0]))
        pyxel.rectb(x - 16, H - 30, 32, 19, CY_)
        if p[0] < 18 or p[0] > W - 18:
            self.otext(x - 3, H - 25, "<" if p[0] < 18 else ">", CY_, K)

    def draw_play(self):
        if self.run < self.dodge_until and self.safe_x is not None:
            self.draw_safe_lane(self.safe_x)
        if self.boss and self.boss.state == "fight" and (self.boss.warn or self.bullets):
            self.draw_safe_lane(self.boss.safe_x)
        # ボス
        if self.boss:
            b = self.boss
            bx, by, bw, bh = self.boss_rect()
            sc = bw / 96
            bs = self.st["boss"]
            rage = b.hp < self.boss_hp / 2
            u, v = bs["angry"] if rage and bs["angry"] else bs["src"]
            if rage and not bs["angry"]:
                pyxel.pal(PK, RD)        # おこると 目が まっか
            if b.state == "die" and b.t % 8 < 4:
                for c in range(1, len(NIGHT)):
                    pyxel.pal(c, WH)
            if b.hit and b.hit % 2:
                for c in range(1, len(NIGHT)):
                    pyxel.pal(c, PK)
            pyxel.blt(bx + bw / 2 - 48, by + bh / 2 - 32, 2, u, v, 96, 64, 0, scale=sc)
            pyxel.pal()
            if b.state == "fight":
                for i in (0, 1):
                    ex, ey, er = self.boss_eye_pos(i)
                    if getattr(b, "shut", None) == i:   # とじた目：まぶた（こげ茶の板と線）
                        pyxel.rect(ex - er - 1, ey - er - 1, er * 2 + 3, er * 2 + 3, OD)
                        pyxel.line(ex - er, ey, ex + er, ey, K)
                        continue
                    if self.t % 30 < 15:
                        pyxel.circb(ex, ey, er + 3, GO)
                    if b.warn and (b.pattern == 2 or i == b.pattern):
                        pyxel.circ(ex, ey, max(2, er * 0.5), WH if self.t % 12 < 6 else GO)
                        pyxel.circb(ex, ey, er + 5, GO)
        # 木・おばけ・紙くず（奥から順に）
        for zc, kind, o, p in self.sprites():
            if kind in SCEN_SPR:
                u, v, w, h, size = SCEN_SPR[kind]
                self.draw_sprite(u, v, w, h, p[0], p[1], size, zc)
            elif kind == "lamp":
                self.draw_lamp(o, p, zc)
            elif kind == "enemy":
                if o.mode == "tire":
                    u, v = OBST_SPR[o.kind]
                    self.draw_sprite(u, v, 16, 16, p[0], p[1] + FOCAL * 4 / zc, 16, zc)
                    self.otext(p[0] - 2, p[1] - FOCAL * 16 / zc - 8, "!", RD, WH)
                    continue
                u, v = ALL_SPR[o.kind]
                # かげ
                g = self.proj(o.x, o.y, 0)
                if g:
                    r = max(1, FOCAL * o.s * 0.38 / g[2])
                    pyxel.elli(g[0] - r, g[1] - r / 3, r * 2, r * 2 / 3, K)
                if o.gold and self.t % 10 < 6:   # 光るおばけ（たおすと パワーアップ）
                    rr = FOCAL * o.s / zc * 0.65 + 2
                    pyxel.circb(p[0], p[1] - FOCAL * o.s / zc / 2, rr, GO)
                self.draw_sprite(u, v, 16, 16, p[0], p[1], o.s, zc, o.hit > 0)
                if o.mode == "mid" and (getattr(o, "guard", False) or (getattr(o, "guard_warn", False) and self.t % 6 < 3)):
                    rr = FOCAL * o.s / zc * 0.62
                    cy_ = p[1] - FOCAL * o.s / zc / 2
                    pyxel.circb(p[0], cy_, rr, CY_ if o.guard else GO)
                    if o.guard:
                        pyxel.dither(0.3)
                        pyxel.circ(p[0], cy_, rr, CY_)
                        pyxel.dither(1)
                if o.mode == "dive" and 0 < o.dive < 40 and self.t % 8 < 5:
                    self.otext(p[0] - 3, p[1] - FOCAL * o.s / zc - 12, "!", RD, WH)
            else:
                self.draw_sprite(64, 0, 8, 8, p[0], p[1], 7, zc)
                pyxel.circb(p[0], p[1] - FOCAL * 3 / zc, max(3, FOCAL * 5 / zc), RD)
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
            elif kind == "dust":
                _, x, y, _, _, life = f
                pyxel.dither(life / 20)
                pyxel.circ(x, y, (14 - life) * 0.35 + 1, GY)
                pyxel.dither(1)
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
        self.draw_kid()
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

    def draw_kid(self):
        """主人公（うしろすがた）。走る足ぶみ・上下のゆれ・かたむき・うったときの はんどうと光・
        土けむり・パワーアップのオーラ。どれも見た目だけで、当たり判定は今までと同じ"""
        kx, ky = self.kid_screen()
        t = self.t
        lpx = getattr(self, "kid_lpx", self.px)
        vx = self.px - lpx
        self.kid_lpx = self.px
        self.kid_lean = getattr(self, "kid_lean", 0.0) * 0.8 + vx * 0.6
        lean = max(-2, min(2, round(self.kid_lean)))
        fire_t = getattr(self, "fire_t", 0)
        if fire_t > 0:
            self.fire_t = fire_t - 1
        moving = self.state == "play" and not (self.boss and self.boss.state == "die")
        win = bool(self.boss and self.boss.state == "die")
        step = (t // 5) % 2 if moving else 0
        bob = -abs(math.sin(t * 0.32)) * 2 if moving else 0
        if win:                                    # ボスを たおしたら ぴょんぴょん
            bob = -abs(math.sin(t * 0.18)) * 9
        y = ky + bob
        # かげ（とんだら小さく）
        sr = 7 + bob * 0.3
        pyxel.dither(0.6)
        pyxel.elli(kx + 8 - sr, ky + 22, sr * 2, 3, K)
        pyxel.dither(1)
        # 土けむり（走ると 足もとから うしろへ）
        if moving and t % 6 == 0:
            self.fx.append(("dust", kx + 8 + random.uniform(-4, 4), ky + 22, random.uniform(-0.4, 0.4), 0, 14))
        # パワーアップのオーラ（Lv2：水色の星が まわる、Lv3：金色の光と星）
        if self.pw >= 2:
            n = 3 if self.pw == 2 else 5
            for i in range(n):
                a = t * 0.12 + i * math.tau / n
                ox, oy = math.cos(a) * 12, math.sin(a) * 5
                col = (CY_, WH)[(t // 4 + i) % 2] if self.pw == 2 else (GO, OY, WH)[(t // 3 + i) % 3]
                pyxel.pset(kx + 8 + ox, y + 12 + oy, col)
                if (t + i * 7) % 12 < 4:   # ときどき きらっと 十字に光る
                    pyxel.pset(kx + 8 + ox - 1, y + 12 + oy, col); pyxel.pset(kx + 8 + ox + 1, y + 12 + oy, col)
                    pyxel.pset(kx + 8 + ox, y + 11 + oy, col); pyxel.pset(kx + 8 + ox, y + 13 + oy, col)
            if self.pw >= 3:
                pyxel.dither(0.25 + 0.15 * math.sin(t * 0.3))
                pyxel.elli(kx - 3, y - 3, 22, 30, GO)
                pyxel.dither(1)
        if self.inv and t % 6 < 3:
            return
        # からだ（上18行）は かたむき・はんどうで ずらし、足（下6行）は 1歩ずつ 交互に上げる
        kick = 1 if fire_t > 3 else 0
        pyxel.blt(kx + lean, y + kick, 1, 0, 16, 16, 18, 0)
        pyxel.blt(kx + 4, y + 18 - step, 1, 4, 34, 4, 6, 0)          # 左足
        pyxel.blt(kx + 8, y + 18 - (1 - step if moving else 0), 1, 8, 34, 4, 6, 0)   # 右足
        # みずでっぽう（うつと 少し下がる）と 先っぽの光
        gx, gy = kx + 11 + lean, y + 9 + kick * 2
        pyxel.blt(gx, gy, 1, 80, 0, 8, 6, 0)
        if fire_t > 2:
            r = fire_t - 1
            pyxel.circ(gx + 6, gy, r, WH)
            pyxel.circb(gx + 6, gy, r + 2, CY_)
            for i in range(4):
                a = i * math.pi / 2 + t * 0.5
                pyxel.pset(gx + 6 + math.cos(a) * (r + 4), gy + math.sin(a) * (r + 4), CY_)
        # コンボ中は あたまの上に 小さな ほのお
        if self.combo >= 5 and t % 4 < 3:
            fx_ = kx + 8 + lean
            pyxel.tri(fx_ - 3, y - 1, fx_ + 3, y - 1, fx_, y - 7 - (t // 3) % 3, OR)
            pyxel.tri(fx_ - 1, y - 1, fx_ + 1, y - 1, fx_, y - 4, OY)

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
            pyxel.rect(x + 1, 5, int((w - 2) * max(0, self.boss.hp) / self.boss_hp), 4, RD)
            pyxel.rectb(x, 4, w, 6, GO)
            s = self.st["boss"]["name"]
            if not self.showing_msg():
                self.otext(W / 2 - self.font.text_width(s) / 2, 12, s, GO, K)
        elif self.phase == "mid" and self.mid:
            w = 110
            x = W / 2 - w / 2
            pyxel.rect(x, 4, w, 6, K)
            pyxel.rect(x + 1, 5, int((w - 2) * max(0, self.mid.hp) / self.mid_hp), 4, PK)
            pyxel.rectb(x, 4, w, 6, GO)
            s = self.st["mid"][1]
            if not self.showing_msg():
                self.otext(W / 2 - self.font.text_width(s) / 2, 12, s, GO, K)
        else:
            # こうしゃまでの道のり（中ボスの位置に しるし）
            w = 120
            x = W / 2 - w / 2
            pyxel.rect(x, 5, w, 4, K)
            pyxel.rect(x, 5, int(w * min(1, self.run / self.slen)), 4, LV)
            pyxel.rectb(x - 1, 4, w + 2, 6, PU)
            mx = x + w * self.mid_at / self.slen
            pyxel.line(mx, 3, mx, 10, PK)
            pyxel.blt(x + w - 4, 1, 1, 72, 0, 6, 6, 0)
            s = self.st["goal"]
            if not self.showing_msg():
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
        if self.state == "play" and self.t < 100:
            self.draw_banner()
        # メッセージ
        if self.msg and self.msg[1] > 0:
            s, d = self.msg
            self.msg = (s, d - 1)
            # 画面上の「名前・ゴール」の行に出す（おばけが出てくる まん中を かくさない）。地は うすく
            tw = self.font.text_width(s)
            my = 11
            pyxel.dither(0.5)
            pyxel.rect(W / 2 - tw / 2 - 4, my - 1, tw + 8, 13, K)
            pyxel.dither(1)
            self.otext(W / 2 - tw / 2, my, s, WH, K)

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
        # 雨（エンディングの 夜明けで やむ）。校舎の中では まどの中だけ（draw_room）
        if self.state == "ending" and self.t > 120:
            return
        for d in (self.rain if not self.look else ()):
            d[1] += d[2]
            d[0] -= d[2] * 0.3
            if d[1] > H or d[0] < 0:
                d[1] = random.uniform(-20, 0)
                d[0] = random.uniform(0, W + 40)
            pyxel.line(d[0], d[1], d[0] + d[3] * 0.3, d[1] - d[3], RN)
        hz = H / 2 - math.tan(math.radians(90 - PITCH)) * FOCAL
        for _ in range(0 if self.look else 5):   # 地面の しぶき
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
            if self.bolt and self.lflash > 3 and not self.look:
                for (x1, y1), (x2, y2) in zip(self.bolt, self.bolt[1:]):
                    pyxel.line(x1, y1, x2, y2, WH)
                    pyxel.line(x1 + 1, y1, x2 + 1, y2, LV)

    def draw_title(self):
        t = self.t
        if TITLE_IMG:
            pyxel.blt(0, 0, TITLE_IMG[0], 0, 0, W, H)
            for i, (lx, ly) in enumerate(TITLE_LAMPS):   # 外灯の光のゆらぎと火の粉
                f = 0.25 + 0.12 * math.sin(t * 0.17 + i * 2) + 0.06 * math.sin(t * 0.53 + i)
                pyxel.dither(f)
                pyxel.circ(lx, ly, 13, OR)
                pyxel.dither(f * 0.8)
                pyxel.circ(lx, ly, 7, OY)
                pyxel.dither(1)
                if random.random() < 0.25:
                    self.sparks.append([lx + random.uniform(-4, 4), ly - 5, random.uniform(-0.15, 0.15),
                                        random.uniform(-0.6, -0.3), random.randint(20, 45)])
        self.draw_weather()
        if TITLE_IMG:
            pyxel.dither(0.6)
            pyxel.rect(0, 16, W, 66, K)
            pyxel.dither(1)
        else:
            pyxel.rect(0, 16, W, 66, K)
        pyxel.line(0, 16, W, 16, VI)
        pyxel.line(0, 81, W, 81, VI)
        s1 = "2ねん1くみ わすれものの よる"
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
        s3 = "4つの ステージ ＋ ボス"
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
        if OVER_IMG:   # 生成画像の背景を ゆっくり重ねる（はじめの1秒はディザで だんだん）
            pyxel.dither(min(1, self.t / 60))
            pyxel.blt(0, 0, OVER_IMG[0], 0, 0, W, H)
            pyxel.dither(0.6)
            pyxel.rect(0, 50, W, 50, K)
            pyxel.dither(1)
        else:
            pyxel.rect(0, 50, W, 50, K)
        s = "やられた… がっこうは おばけの もの…"
        self.otext(W / 2 - self.font.text_width(s) / 2, 58, s, PK, K)
        s = "スコア %d   ランク %s" % (self.score, self.rank)
        self.otext(W / 2 - self.font.text_width(s) / 2, 72, s, WH, K)
        if self.t > 60 and self.t % 60 < 40:
            s = "おして つづきから（ステージ%d）" % (self.stage + 1)
            self.otext(W / 2 - self.font.text_width(s) / 2, 86, s, WH, K)
        if self.t > 60:
            x, y, w, h = TITLE_BTN
            pyxel.rect(x, y, w, h, K)
            pyxel.rectb(x, y, w, h, GY)
            s = "タイトルへ" if self.touch else "X：タイトルへ"
            self.otext(x + w / 2 - self.font.text_width(s) / 2, y + 3, s, GY, K)

    def big_text(self, s, y, col, edge):
        # 大きな文字：画像バンク2の すみに書いて 2倍で出す（タイトルと同じ やり方。場所は別）
        tw = min(120, self.font.text_width(s) + 4)
        img = pyxel.images[2]
        img.rect(0, 216, 124, 14, 0)
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (1, 1)):
            img.text(2 + dx, 218 + dy, s, edge, self.font)
        img.text(2, 218, s, col, self.font)
        pyxel.blt(W / 2 - 62, y, 2, 0, 216, 124, 14, 0, scale=2)
        return tw

    def draw_banner(self):
        # 面の はじまり：「ステージ2」と 面の名前を 大きく
        t = self.t
        y = 34 if t > 12 else 34 - (12 - t) * 4
        pyxel.dither(0.7)
        pyxel.rect(0, y, W, 44, K)
        pyxel.dither(1)
        pyxel.line(0, y, W, y, VI)
        pyxel.line(0, y + 44, W, y + 44, VI)
        last = self.stage == len(STAGES) - 1
        s = "さいごの ステージ" if last else "ステージ %d / %d" % (self.stage + 1, len(STAGES))
        self.otext(W / 2 - self.font.text_width(s) / 2, y + 4, s, PK if last else LV, K)
        self.big_text(self.st["name"], y + 16, GO, PU)

    def draw_clear(self):
        t = self.t
        pyxel.dither(min(0.75, t / 40))
        pyxel.rect(0, 36, W, 88, K)
        pyxel.dither(1)
        pyxel.line(0, 36, W, 36, GO)
        pyxel.line(0, 124, W, 124, GO)
        self.big_text("ステージクリア！", 42, GO, PU)
        s = "スコア %d" % self.score
        self.otext(W / 2 - self.font.text_width(s) / 2, 72, s, WH, K)
        if t > 60:
            if self.stage == 0:
                s = "こうしゃの かおは しずまった！"
                self.otext(W / 2 - self.font.text_width(s) / 2, 83, s, CY_, K)
                s = "でも こわれた とけいが まだ なる…"
                self.otext(W / 2 - self.font.text_width(s) / 2, 96, s, CY_, K)
            else:
                s = "つぎは %s" % STAGES[self.stage + 1]["name"]
                self.otext(W / 2 - self.font.text_width(s) / 2, 88, s, CY_, K)
        if t > 150 and t % 60 < 40:
            s = "おして つぎの ステージへ"
            self.otext(W / 2 - self.font.text_width(s) / 2, 112, s, WH, K)

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
            s = "あー よかった… あっ わすれもの！"
            tw = self.font.text_width(s)
            bx, by = W / 2 - tw / 2 - 6, ky - 22
            pyxel.rect(bx, by, tw + 12, 15, WH)
            pyxel.rectb(bx, by, tw + 12, 15, K + 1)
            pyxel.tri(W / 2 - 3, by + 14, W / 2 + 3, by + 14, W / 2, by + 19, WH)
            pyxel.text(bx + 6, by + 3, s, K + 1, self.font)
        if t > 240:
            s = "ぜんぶ クリア！ がっこうが もとに もどった！"
            self.otext(W / 2 - self.font.text_width(s) / 2, 12, s, K + 1, WH)
            s = "スコア %d   ランク %s" % (self.score, self.rank)
            if self.conts:
                s += "   やりなおし %dかい" % self.conts
            self.otext(W / 2 - self.font.text_width(s) / 2, 26, s, K + 1, WH)
        if t > 320 and t % 60 < 40:
            s = "おして タイトルへ"
            self.otext(W / 2 - self.font.text_width(s) / 2, 40, s, K + 1, WH)

    def otext(self, x, y, s, col, bcol):
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            pyxel.text(x + dx, y + dy, s, bcol, self.font)
        pyxel.text(x, y, s, col, self.font)


if __name__ == "__main__":
    Game()
