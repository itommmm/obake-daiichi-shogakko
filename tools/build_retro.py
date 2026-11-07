"""Rebuild the subset font, Pyxel archive, and embedded browser app together.

Run with Python from an environment containing pyxel==3.0.0.
"""
import base64
import pathlib
import re
import zipfile

import pyxel

ROOT = pathlib.Path(__file__).resolve().parents[1]


def build():
    font_path = pathlib.Path(pyxel.__file__).parent / "examples/assets/umplus_j10r.bdf"
    source = font_path.read_text()
    needed = {ord(c) for c in (ROOT / "retro/main.py").read_text()}
    glyphs = []
    for glyph in re.findall(r"STARTCHAR .*?ENDCHAR", source, re.S):
        encoding = re.search(r"^ENCODING (\d+)$", glyph, re.M)
        if encoding and int(encoding[1]) in needed:
            glyphs.append(glyph)
    header = source.split("STARTCHAR", 1)[0]
    header = re.sub(r"(?m)^CHARS \d+$", f"CHARS {len(glyphs)}", header)
    (ROOT / "retro/font.bdf").write_text(header + "\n".join(glyphs) + "\nENDFONT\n")
    with zipfile.ZipFile(ROOT / "retro.pyxapp", "w", zipfile.ZIP_DEFLATED) as archive:
        files = {".pyxapp_startup_script": b"main.py"}
        for name in ("main.py", "font.bdf", "boss_school.png", "over_bg.png", "title_bg.png"):
            files[name] = (ROOT / "retro" / name).read_bytes()
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo("retro/" + name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    encoded = base64.b64encode((ROOT / "retro.pyxapp").read_bytes()).decode()
    html_path = ROOT / "retro.html"
    html, count = re.subn(r'base64: "[A-Za-z0-9+/=]+"', f'base64: "{encoded}"', html_path.read_text())
    if count != 1:
        raise RuntimeError(f"Expected one embedded app, found {count}")
    html_path.write_text(html)
    print(f"Built retro.pyxapp and retro.html; {len(glyphs)} font glyphs")


if __name__ == "__main__":
    build()
