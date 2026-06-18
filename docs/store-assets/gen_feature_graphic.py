# -*- coding: utf-8 -*-
"""Генератор feature graphic 1024x500 для Google Play — стиль Solar Dacha.
Запуск: C:\\Python314\\python.exe gen_feature_graphic.py
Шрифты — Nunito из android/app/src/main/res/font. Без альфа-канала (RGB)."""
import math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1024, 500
ROOT = r"C:\Projects\Dacha\Календарь дачника"
FONT_DIR = os.path.join(ROOT, "android", "app", "src", "main", "res", "font")
OUT = [os.path.join(ROOT, "docs", "store-assets", "feature-graphic.png"),
       r"C:\Users\e-kru\Downloads\feature-graphic.png"]

def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)

# ── Диагональный градиент (оранжевый → янтарный) ───────────────────────────
c1 = (243, 110, 0)    # глубокий оранжевый
c2 = (255, 173, 71)   # тёплый янтарь
img = Image.new("RGB", (W, H))
px = img.load()
maxd = float(W + H)
for y in range(H):
    for x in range(W):
        t = (x + y) / maxd
        px[x, y] = (int(c1[0] + (c2[0] - c1[0]) * t),
                    int(c1[1] + (c2[1] - c1[1]) * t),
                    int(c1[2] + (c2[2] - c1[2]) * t))

draw = ImageDraw.Draw(img, "RGBA")

# ── Мягкое радиальное свечение справа-сверху ───────────────────────────────
glow = Image.new("L", (W, H), 0)
gd = ImageDraw.Draw(glow)
gd.ellipse([W - 560, -260, W + 200, 360], fill=110)
glow = glow.filter(ImageFilter.GaussianBlur(120))
white = Image.new("RGB", (W, H), (255, 255, 255))
img = Image.composite(white, img, glow.point(lambda v: int(v * 0.55)))
draw = ImageDraw.Draw(img, "RGBA")

# ── Полупрозрачные «точки» (текстура) ──────────────────────────────────────
for (dx, dy, r, a) in [(120, 120, 6, 40), (210, 70, 4, 36), (90, 360, 5, 34),
                       (300, 300, 4, 30), (640, 420, 5, 30), (760, 90, 4, 30)]:
    draw.ellipse([dx - r, dy - r, dx + r, dy + r], fill=(255, 255, 255, a))

# ── Подсолнух справа ───────────────────────────────────────────────────────
cx, cy = 820, 250
petal = Image.new("RGBA", (78, 150), (0, 0, 0, 0))
pd = ImageDraw.Draw(petal)
pd.ellipse([8, 6, 70, 144], fill=(255, 216, 110, 255), outline=(244, 176, 58, 255), width=3)
for i in range(13):
    ang = i * (360.0 / 13)
    rot = petal.rotate(-ang, expand=True, resample=Image.BICUBIC)
    rad = math.radians(ang)
    dist = 96
    ox = cx + int(dist * math.sin(rad)) - rot.width // 2
    oy = cy - int(dist * math.cos(rad)) - rot.height // 2
    img.paste(rot, (ox, oy), rot)
draw = ImageDraw.Draw(img, "RGBA")
draw.ellipse([cx - 66, cy - 66, cx + 66, cy + 66], fill=(120, 72, 32), outline=(90, 52, 22), width=5)
# семечки — мелкие точки на сердцевине
for ang in range(0, 360, 30):
    for rr in (22, 40):
        sx = cx + int(rr * math.cos(math.radians(ang)))
        sy = cy + int(rr * math.sin(math.radians(ang)))
        draw.ellipse([sx - 3, sy - 3, sx + 3, sy + 3], fill=(70, 40, 16))

# ── Текст слева ────────────────────────────────────────────────────────────
def text_shadow(xy, s, fnt, fill=(255, 255, 255), shadow=(120, 40, 0, 110), off=(0, 3)):
    draw.text((xy[0] + off[0], xy[1] + off[1]), s, font=fnt, fill=shadow)
    draw.text(xy, s, font=fnt, fill=fill)

f_title = font("nunito_black.ttf", 78)
f_tag = font("nunito_extrabold.ttf", 31)
f_sub = font("nunito_bold.ttf", 23)

x0 = 70
text_shadow((x0, 96), "Календарь", f_title)
text_shadow((x0, 178), "дачника", f_title)
draw.text((x0 + 2, 286), "Сад и огород под контролем", font=f_tag, fill=(255, 255, 255))
draw.text((x0 + 2, 336), "Полив · Подкормка · Посадки · Урожай",
          font=f_sub, fill=(255, 255, 255, 235))

# ── Детали: грядка, ростки, пчёлки, бабочки ────────────────────────────────
def draw_sprout(x, y, s=1.0, col=(86, 170, 78)):
    draw.line([(x, y), (x, y - int(30 * s))], fill=(70, 140, 64), width=max(2, int(4 * s)))
    draw.ellipse([x - int(17 * s), y - int(28 * s), x + 1, y - int(10 * s)], fill=col)
    draw.ellipse([x - 1, y - int(32 * s), x + int(17 * s), y - int(14 * s)], fill=col)

def draw_bee(x, y, s=1.0):
    draw.ellipse([x - int(12 * s), y - int(13 * s), x + int(3 * s), y - int(1 * s)], fill=(255, 255, 255, 200))
    draw.ellipse([x - int(3 * s), y - int(13 * s), x + int(12 * s), y - int(1 * s)], fill=(255, 255, 255, 200))
    bw, bh = int(24 * s), int(15 * s)
    draw.ellipse([x - bw // 2, y - bh // 2, x + bw // 2, y + bh // 2], fill=(54, 38, 20))
    for ox in (-6, 0, 6):
        draw.line([(x + int(ox * s), y - bh // 2 + 2), (x + int(ox * s), y + bh // 2 - 2)],
                  fill=(255, 206, 71), width=max(2, int(3 * s)))
    draw.ellipse([x + bw // 2 - 3, y - int(4 * s), x + bw // 2 + int(6 * s), y + int(4 * s)], fill=(38, 26, 14))

def draw_butterfly(x, y, s=1.0, col=(255, 120, 150), col2=(255, 173, 71)):
    draw.ellipse([x - int(22 * s), y - int(20 * s), x - int(1 * s), y + int(3 * s)], fill=col)
    draw.ellipse([x + int(1 * s), y - int(20 * s), x + int(22 * s), y + int(3 * s)], fill=col)
    draw.ellipse([x - int(17 * s), y, x - int(1 * s), y + int(18 * s)], fill=col2)
    draw.ellipse([x + int(1 * s), y, x + int(17 * s), y + int(18 * s)], fill=col2)
    draw.line([(x, y - int(18 * s)), (x, y + int(16 * s))], fill=(60, 40, 30), width=max(2, int(3 * s)))
    draw.line([(x, y - int(16 * s)), (x - int(6 * s), y - int(24 * s))], fill=(60, 40, 30), width=2)
    draw.line([(x, y - int(16 * s)), (x + int(6 * s), y - int(24 * s))], fill=(60, 40, 30), width=2)

# зелёный холм по низу
hill = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(hill).ellipse([-220, H - 70, W + 220, H + 300], fill=(96, 176, 80, 255))
img.paste(hill, (0, 0), hill)
draw = ImageDraw.Draw(img, "RGBA")

# грядка (приподнятая, справа-снизу) + рядки + ростки
bx0, by0, bx1, by1 = 600, 446, 992, 500
draw.rounded_rectangle([bx0, by0, bx1, by1], radius=16, fill=(124, 86, 50))
draw.rounded_rectangle([bx0, by0, bx1, by0 + 12], radius=8, fill=(150, 108, 66))
for rx in range(bx0 + 30, bx1 - 16, 52):
    draw.line([(rx, by0 + 14), (rx, by1 - 6)], fill=(98, 66, 38), width=4)
    draw_sprout(rx, by0 + 16, 0.95)

# ростки слева-снизу (баланс)
draw_sprout(96, 474, 1.05)
draw_sprout(150, 482, 0.85)
draw_sprout(196, 470, 0.95)

# пчёлки у подсолнуха
draw_bee(700, 138, 1.15)
draw_bee(742, 352, 0.95)

# бабочки
draw_butterfly(596, 92, 1.05, col=(255, 120, 150), col2=(255, 188, 90))
draw_butterfly(912, 168, 0.95, col=(150, 120, 235), col2=(120, 200, 240))

for p in OUT:
    os.makedirs(os.path.dirname(p), exist_ok=True)
    img.save(p, "PNG")
    print("saved", p, img.size, img.mode)
