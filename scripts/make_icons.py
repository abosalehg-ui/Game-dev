"""Generate PWA icons for "من الغرفة للقمة".

Concept: an ascending neon staircase rising toward a glowing star/peak —
mirrors the game's journey from a bedroom to a skyscraper. Palette taken
straight from the game's CSS vars (#00ff88, #00ccff, #ffd700).
"""

from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import math

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)

# Brand palette (matches index.html :root)
GREEN = (0, 255, 136)
CYAN = (0, 204, 255)
GOLD = (255, 215, 0)
BG_TOP = (14, 22, 48)
BG_BOTTOM = (2, 2, 6)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def make_background(size: int, rounded: bool = True) -> Image.Image:
    """Dark radial-ish gradient + subtle grid + rounded corners."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    cx, cy = size / 2, size * 0.45
    max_d = math.hypot(size, size)
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy) / max_d
            t = min(1.0, d * 1.4)
            r, g, b = lerp(BG_TOP, BG_BOTTOM, t)
            px[x, y] = (r, g, b, 255)

    # Subtle pixel grid (very faint cyan dots)
    draw = ImageDraw.Draw(img, "RGBA")
    step = max(8, size // 32)
    for y in range(0, size, step):
        for x in range(0, size, step):
            draw.point((x, y), fill=(0, 204, 255, 18))

    if rounded:
        radius = int(size * 0.22)
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, size - 1, size - 1), radius=radius, fill=255
        )
        img.putalpha(mask)
    return img


def glow_layer(size: int, draw_fn, blur_radius: int, alpha: int = 200) -> Image.Image:
    """Render `draw_fn` onto a transparent canvas and blur it for a neon halo."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer, "RGBA"))
    layer = layer.filter(ImageFilter.GaussianBlur(blur_radius))
    # Boost alpha
    r, g, b, a = layer.split()
    a = a.point(lambda v: min(255, int(v * (alpha / 255))))
    return Image.merge("RGBA", (r, g, b, a))


def draw_stairs_and_star(size: int, safe_inset: float = 0.0) -> Image.Image:
    """Draw the foreground (three glowing steps + star).

    safe_inset shrinks the artwork to fit inside the maskable safe zone.
    """
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Geometry — three ascending blocks anchored to the lower-right area
    # so the composition reads as "rising toward the top-left peak".
    inset = size * safe_inset
    work = size - 2 * inset

    # Each step: (x, y, w, h, color)
    step_w = work * 0.22
    step_h = work * 0.13
    base_y = inset + work * 0.72
    base_x = inset + work * 0.18

    steps = [
        (base_x + step_w * 1.6, base_y, step_w, step_h, GREEN),
        (base_x + step_w * 0.8, base_y - step_h * 1.05, step_w, step_h * 1.25, CYAN),
        (base_x, base_y - step_h * 2.5, step_w, step_h * 1.55, GOLD),
    ]

    # Glow halo behind the steps
    def _halo(d):
        for x, y, w, h, color in steps:
            d.rounded_rectangle(
                (x - 6, y - 6, x + w + 6, y + h + 6),
                radius=int(step_h * 0.35),
                fill=color + (180,),
            )

    halo = glow_layer(size, _halo, blur_radius=int(size * 0.06), alpha=180)
    canvas.alpha_composite(halo)

    # Solid steps on top of halo
    draw = ImageDraw.Draw(canvas, "RGBA")
    for x, y, w, h, color in steps:
        # Subtle vertical gradient by stacking two rects
        top_color = lerp(color, (255, 255, 255), 0.25)
        draw.rounded_rectangle(
            (x, y, x + w, y + h),
            radius=int(step_h * 0.28),
            fill=color + (255,),
        )
        # highlight stripe on top edge
        draw.rounded_rectangle(
            (x + w * 0.08, y + h * 0.12, x + w * 0.92, y + h * 0.38),
            radius=int(step_h * 0.18),
            fill=top_color + (140,),
        )

    # Star/peak above the top step
    top_x, top_y, top_w, _, _ = steps[2]
    star_cx = top_x + top_w / 2
    star_cy = top_y - step_h * 1.05
    star_r = step_h * 1.05

    def _star_pts(cx, cy, r_out, r_in, points=5, rot=-math.pi / 2):
        pts = []
        for i in range(points * 2):
            r = r_out if i % 2 == 0 else r_in
            a = rot + i * math.pi / points
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        return pts

    star_pts = _star_pts(star_cx, star_cy, star_r, star_r * 0.45)

    def _star_glow(d):
        d.polygon(star_pts, fill=GOLD + (220,))

    star_halo = glow_layer(size, _star_glow, blur_radius=int(size * 0.05), alpha=220)
    canvas.alpha_composite(star_halo)
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.polygon(star_pts, fill=GOLD + (255,))
    # Inner highlight
    inner_pts = _star_pts(star_cx, star_cy - star_r * 0.05, star_r * 0.55, star_r * 0.22)
    draw.polygon(inner_pts, fill=(255, 248, 200, 220))

    # Connecting accent line (dotted) from base to star — like a journey path
    line_color = (0, 204, 255, 90)
    n_dots = 6
    sx, sy = base_x + step_w * 1.6 + step_w / 2, base_y + step_h / 2
    ex, ey = star_cx, star_cy
    for i in range(1, n_dots + 1):
        t = i / (n_dots + 1)
        cx = sx + (ex - sx) * t
        cy = sy + (ey - sy) * t
        r = max(2, int(size * 0.006))
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=line_color)

    return canvas


def render(size: int, rounded: bool = True, maskable: bool = False) -> Image.Image:
    bg = make_background(size, rounded=rounded and not maskable)
    if maskable:
        # Fill full square (no rounded corners) and shrink art to 80% safe zone
        full = Image.new("RGBA", (size, size), (0, 0, 0, 255))
        full.alpha_composite(make_background(size, rounded=False))
        bg = full
        fg = draw_stairs_and_star(size, safe_inset=0.12)
    else:
        fg = draw_stairs_and_star(size, safe_inset=0.05)
    bg.alpha_composite(fg)
    return bg


def main():
    targets = [
        ("icon-192.png", 192, True, False),
        ("icon-512.png", 512, True, False),
        ("icon-maskable-512.png", 512, False, True),
        ("icon-apple-180.png", 180, True, False),
        ("favicon-32.png", 32, True, False),
        ("favicon-16.png", 16, True, False),
    ]
    for name, size, rounded, maskable in targets:
        img = render(size, rounded=rounded, maskable=maskable)
        path = OUT / name
        img.save(path, "PNG", optimize=True)
        print(f"  wrote {path.relative_to(OUT.parent)}  ({size}x{size})")

    # Also save a high-res master for archival / store listings
    master = render(1024, rounded=True, maskable=False)
    master.save(OUT / "icon-1024.png", "PNG", optimize=True)
    print(f"  wrote icons/icon-1024.png  (1024x1024)")


if __name__ == "__main__":
    main()
