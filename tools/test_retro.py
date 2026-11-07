"""Headless gameplay regression tests (no display or Pyxel installation needed)."""
import importlib.util
import base64
import io
import pathlib
import random
import re
import sys
import unittest
import zipfile
from unittest.mock import MagicMock

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.modules["pyxel"] = MagicMock()
spec = importlib.util.spec_from_file_location("retro_game", ROOT / "retro/main.py")
game = importlib.util.module_from_spec(spec)
spec.loader.exec_module(game)
game.pyxel.btn.return_value = False
game.pyxel.btnp.return_value = False
game.pyxel.mouse_x = 144
game.pyxel.mouse_y = 81


class GameplayTests(unittest.TestCase):
    def setUp(self):
        random.seed(7)
        self.g = game.Game.__new__(game.Game)
        self.g.start()
        self.g.auto = True
        self.g.touch = False
        self.g.best = 0
        self.g.font = MagicMock()
        self.g.font.text_width.return_value = 20

    def make_group(self):
        self.g.spawn_formation = lambda prog: [self.g.spawn("isu", game.X0 + x) for x in (-20, 20)]
        self.g.formation(0.1)
        return list(self.g.enemies)

    def test_formation_bonus_once_and_water_cap(self):
        a, b = self.make_group()
        self.g.ammo = 10
        self.g.kill(a)
        self.assertNotIn("+1000", self.g.msg[0])
        self.g.kill(b)
        self.assertIn("ぜんぶ ポン", self.g.msg[0])
        self.assertEqual(self.g.ammo, 18)
        score = self.g.score
        self.g.kill(b)
        self.assertEqual(self.g.score, score)

    def test_escape_cancels_formation_bonus(self):
        a, b = self.make_group()
        a.y = self.g.cy - game.PD + 1
        self.g.move_enemy(a)
        self.g.kill(b)
        self.assertNotIn("+1000", self.g.msg[0])

    def test_chime_does_not_refill_itself(self):
        self.make_group()
        self.g.chime = 100
        self.g.use_chime()
        self.assertEqual(self.g.chime, 0)

    def test_dodge_lane_is_clear_and_spawning_waits(self):
        self.g.formation_n = 2
        self.g.formation(0.4)
        self.assertTrue(self.g.enemies)
        self.assertTrue(all(e.mode == "tire" for e in self.g.enemies))
        self.assertTrue(all(abs(e.x - self.g.safe_x) > 32 for e in self.g.enemies))
        n = len(self.g.enemies)
        for _ in range(30):
            self.g.director()
        self.assertEqual(len(self.g.enemies), n)

    def test_boss_warning_precedes_fixed_lane_attack(self):
        self.g.start_boss()
        b = self.g.boss
        b.state = "fight"
        for pattern in (1, 2, 0):
            b.atk = 61
            self.g.update_boss()
            self.assertTrue(b.warn)
            self.assertEqual(b.pattern, pattern)
            self.assertFalse(self.g.bullets)
            safe_x = b.safe_x
            for _ in range(60):
                self.g.update_boss()
            self.assertTrue(self.g.bullets)
            self.assertTrue(all(abs(p.tx - safe_x) > 32 for p in self.g.bullets))
            self.g.bullets.clear()

    def test_boss_transitions_end_dodge_segment(self):
        for transition in (self.g.start_mid, self.g.start_boss):
            self.g.dodge_until = self.g.run + 155
            self.g.safe_x = game.X0
            self.g.spawn("tire", mode="tire")
            transition()
            self.assertEqual(self.g.dodge_until, 0)
            self.assertIsNone(self.g.safe_x)
            self.assertFalse(any(e.mode == "tire" for e in self.g.enemies))

    def test_safe_marker_stays_on_screen(self):
        for world_x in (game.X0 - 100, game.X0 + 100):
            game.pyxel.rectb.reset_mock()
            self.g.draw_safe_lane(world_x)
            x, y, width, height, color = game.pyxel.rectb.call_args.args
            self.assertGreaterEqual(x, 0)
            self.assertLessEqual(x + width, game.W)

    def test_dodge_safe_lane_is_reachable_at_edges(self):
        for edge in (-100, 100):
            self.g.cx = self.g.px = game.X0 + edge
            self.g.formation_n = 2
            self.g.formation(0.4)
            self.assertLessEqual(abs(self.g.safe_x - game.X0), 75)

    def test_headless_run_and_draw(self):
        # Smoke test every gameplay frame through both bosses with generous health.
        self.g.hearts = 999
        seen = set()
        for _ in range(18000):
            self.g.t += 1
            self.g.update_play()
            if self.g.t % 60 == 0:
                self.g.draw_play()
                game.pyxel.reset_mock()
            seen.add(self.g.phase)
            if self.g.state == "ending":
                break
        self.assertEqual(self.g.state, "ending")
        self.assertTrue({"road", "mid", "road2"}.issubset(seen))

    def test_embedded_browser_app_matches_source(self):
        encoded = re.search(r'base64: "([A-Za-z0-9+/=]+)"', (ROOT / "retro.html").read_text())[1]
        payload = base64.b64decode(encoded)
        self.assertEqual(payload, (ROOT / "retro.pyxapp").read_bytes())
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            for name in ("main.py", "font.bdf", "boss_school.png", "over_bg.png", "title_bg.png", "enemies.png"):
                self.assertEqual(archive.read("retro/" + name), (ROOT / "retro" / name).read_bytes())


if __name__ == "__main__":
    unittest.main()
