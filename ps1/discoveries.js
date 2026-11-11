/* PS1版 小さな発見（任意）
 * 各部屋に1つずつ、調べると何かが起こる場所を足す。メインの謎解きには関係しない。
 *  ・はじめて調べたときだけ「見つけた！」（音・光・ひとこと）。2回目からは短い別の反応。
 *  ・場所によって反応のしかたが違う：ヒント／ユーモア／怪奇現象のあとで変わる／何もない。
 *  ・発見済みは G.flags.found（既存セーブの flags に入る。セーブ形式は変えない）。
 *  ・小さな怪奇現象（comic-horror.js の hot）が起こると、その場所のマーカーが遠くからも見える。
 * 読み込み順：rooms.js・adventure-ui.js のあと、logic.js の前。
 * logic.js が init で build() を呼び、SPOTS に spots を足す。 */
'use strict';

const Discoveries = (() => {
  let hot = null, hotUntil = 0;
  const times = {}; // この起動中に調べた回数（2回目以降の文章を変えるため。保存しない）

  const isFound = id => !!(G.flags.found && G.flags.found.includes(id));
  function mark(id) {
    if (!Array.isArray(G.flags.found)) G.flags.found = [];
    if (!G.flags.found.includes(id)) G.flags.found.push(id);
  }
  function setHot(id) { hot = id; hotUntil = G.time + 30; }
  const isHot = id => hot === id && G.time < hotUntil;
  const found = () => (G.flags.found || []).length;

  // はじめての発見：音と光と、ひとこと。保存もする
  function discover(id, text, tone) {
    mark(id);
    SFX.found();
    if (tone) SFX.comicScare(tone);
    if (G.fx && activeRoom) addSparks(G.p.x, 1.1, G.p.z, 0xbfe6ff, 8);
    talk(text, 4.2);
    saveGame();
  }
  // 2回目からの反応。同じ文が続かないよう、順にめぐる
  function again(id, lines) {
    const n = times[id] = (times[id] || 0) + 1;
    talk(lines[(n - 1) % lines.length], 3);
  }
  const talk = (text, dur) => say(foldMsg(text), dur);
  const fixed = id => G.fixed.includes(id);
  const allFixed = () => G.fixed.length >= FIX_ROOMS.length;

  // 発見の定義。room/x/z/r で置き場所、label と act で反応。
  const DEFS = {
    // 教室：かすかな物音（classroom-desk）の出どころ。ユーモアの発見
    paper: {
      room: 'classroom', x: -3.3, z: -1.6, r: 1.0,
      label: () => isFound('paper') ? 'おちていた かみを みる' : 'おちている かみを ひろう',
      act() {
        if (!isFound('paper')) return discover('paper', 'かみに「ぼくも しゅくだい わすれた。 おばけ」と かいてある！');
        if (fixed('classroom')) return talk('かみの もじは きえている。おばけは かえったのかな。', 3);
        again('paper', ['おばけの てがみ。うらに へたな えが ある。', 'もう よんだよ。「ぼくも」の ところが すき。']);
      },
    },
    // 廊下：ロッカーが揺れたあとだけ発見できる。揺れる前は「何もない」反応
    locker: {
      room: 'corridor', x: .7, z: -1.55, r: 1.0,
      label: () => isFound('locker') ? 'ロッカーを みる' : 'ロッカーを しらべる',
      act() {
        if (!isFound('locker')) {
          if (!G.flags.lockerHeard) return again('locker-quiet', ['ロッカーを コンコン。…へんじは ない。', 'ロッカーは しずかだ。']);
          return discover('locker', 'あけたら くつしたが いっぱい！ ひとつ ぴょんと とびだした！', 'boing');
        }
        if (allFixed()) return talk('ロッカーの なかは からっぽ。くつしたは どこかへ にげた。', 3);
        again('locker', ['くつしたの におい…。もう いいや。', 'ロッカーは しずか。くつしたは ねている。']);
      },
    },
    // 職員室：別の場所のヒントが見つかる。いまの進み具合で内容が変わる
    drawer: {
      room: 'staff', x: 0, z: 1.15, r: 1.0,
      label: () => isFound('drawer') ? 'ひきだしを みる' : 'あいている ひきだしを みる',
      act() {
        if (!isFound('drawer')) {
          const text = !fixed('classroom') ? 'メモ「こくばんけしは 2ねん1くみの きょうたく」'
            : (!fixed('staff') && !has('battery')) ? 'メモ「でんちは ろうかの おくで みたよ」'
            : !fixed('staff') ? 'メモ「とけいに でんちを いれてみよう」'
            : !G.flags.gymOpen ? 'メモ「ばんごうは 3か所。こくばん・とけい・ろうか」'
            : 'メモ「ステージで ふえを ふくと おばけが しずまるよ」';
          return discover('drawer', 'ひきだしに ' + text);
        }
        again('drawer', ['ひきだしは からっぽ。おかしの ふくろが ひとつ。', 'ふくろに「おばけが たべた」と かいてある。']);
      },
    },
    // 体育館：ボールの音（gym-ball）の出どころ。ちょっと怖くて笑える
    balls: {
      room: 'gym', x: 4.8, z: 5.0, r: 1.1,
      label: () => isFound('balls') ? 'ボールを みる' : 'ボールの かごを しらべる',
      act() {
        if (!isFound('balls')) return discover('balls', 'ボールを もちあげたら おばけの かおが かいてあった！ ニコッ。', 'ghost');
        if (fixed('gym')) return talk('ボールの かおが ねむっている。おやすみ。', 3);
        again('balls', ['ボールが こっちを みている きがする。', 'ボールを もどした。 …いま ころがった？']);
      },
    },
    // 玄関：何もないのに笑える。学校が元に戻ると反応が変わる
    umbrella: {
      room: 'entrance', x: -3.2, z: 2.8, r: 1.1,
      label: () => isFound('umbrella') ? 'かさを みる' : 'かさたてを しらべる',
      act() {
        if (!isFound('umbrella')) return discover('umbrella', 'かさが ポンッ！と ひとりでに ひらいた！ びっくり！', 'boing');
        if (allFixed()) return talk('かさが きちんと とじている。いいこ。', 3);
        again('umbrella', ['かさは ひらいたまま。しずくが ぽたぽた。', 'かさを とじた。…また ポンッ！']);
      },
    },
  };

  // 目印になる小物。暗い部屋でも見えるよう、光に左右されない色を使う
  function props() {
    const C = ROOMS.classroom, K = ROOMS.corridor, S = ROOMS.staff, Y = ROOMS.gym, E = ROOMS.entrance;
    if (C) {
      const a = box(.3, .012, .4, bm(0xf2ecd2), -3.3, .03, -1.6, C.scene); a.rotation.y = .5;
      const b = box(.26, .012, .34, bm(0xe6dfc0), -3.18, .035, -1.7, C.scene); b.rotation.y = -.3;
    }
    if (K) {
      const sock = box(.06, .24, .09, bm(0xe7e2d6), 1.12, .95, -1.55, K.scene); sock.rotation.z = .35;
    }
    if (S) {
      box(.5, .1, .3, pm(0x8a6a42), 0, .55, .74, S.scene);
      box(.3, .02, .2, bm(0xefe9cf), 0, .62, .74, S.scene);
    }
    if (Y) {
      cyc(.4, .32, .4, 8, pm(0x7a5b3a), 4.8, .2, 5.6, Y.scene);
      sph(.17, pm(0xd3612a), 4.7, .5, 5.6, Y.scene);
      sph(.17, pm(0xe0b030), 4.95, .48, 5.5, Y.scene);
      sph(.17, pm(0x3a6ad8), 4.85, .55, 5.75, Y.scene);
    }
    if (E) cyc(.02, .07, .8, 6, pm(0x2f4f9a), -4.0, .75, 3.1, E.scene);
  }
  function build() {
    for (const [id, d] of Object.entries(DEFS)) {
      const R = ROOMS[d.room];
      if (R && !R.spots.some(s => s.id === id)) addSpot(R, { id, x: d.x, z: d.z, r: d.r, optional: true });
    }
    props();
  }
  const spots = {};
  for (const [id, d] of Object.entries(DEFS)) spots[id] = { optional: true, label: d.label, act: d.act };

  return { build, spots, setHot, isHot, isFound, found, DEFS };
})();

Object.assign(SFX, {
  // 「見つけた！」：短く明るい上がり音
  found() {
    tone(784, .1, 'triangle', .05); tone(1047, .12, 'triangle', .05, 0, .09); tone(1568, .2, 'sine', .04, 0, .19);
  },
});
