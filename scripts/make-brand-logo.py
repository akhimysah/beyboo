#!/usr/bin/env python3 -I
"""Génère le logo BOOZZO : lettres en métal brossé, œil bleu à la place du dernier O.
Sorties : public/assets/universe/brand-boozzo.webp (1800×600), brand-640.webp, et un PNG transparent de travail."""
import math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/assets/universe'
FONT = '/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf'
W, H = 1800, 600
SS = 2  # suréchantillonnage

def metal_gradient(size, angle_deg=100):
    w, h = size
    img = Image.new('L', size)
    px = img.load()
    a = math.radians(angle_deg)
    cx, cy = w / 2, h / 2
    for y in range(h):
        for x in range(w):
            d = ((x - cx) * math.cos(a) + (y - cy) * math.sin(a)) / max(w, h)
            # bandes de métal brossé : clair / sombre / clair
            v = 0.55 + 0.45 * math.cos(d * 9.5)
            px[x, y] = int(95 + 155 * v)
    return img.filter(ImageFilter.GaussianBlur(1))

def eye(size):
    """Œil bleu : iris dégradé, pupille, reflet, anneau métallique."""
    s = size * SS
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = s / 2
    d.ellipse([0, 0, s - 1, s - 1], fill=(170, 172, 178, 255))                 # anneau métal
    d.ellipse([s * 0.06, s * 0.06, s * 0.94, s * 0.94], fill=(230, 232, 236, 255))
    d.ellipse([s * 0.10, s * 0.10, s * 0.90, s * 0.90], fill=(20, 22, 40, 255))   # fond iris
    # iris radial
    iris = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ip = ImageDraw.Draw(iris)
    r_out, r_in = s * 0.40, s * 0.17
    steps = 60
    for i in range(steps):
        t = i / steps
        r = r_out - (r_out - r_in) * t
        col = (int(30 + 40 * t), int(90 + 60 * (1 - t)), int(230 - 60 * t), 255)
        ip.ellipse([c - r, c - r, c + r, c + r], fill=col)
    # stries de l'iris
    for k in range(72):
        ang = k * math.pi * 2 / 72
        x1, y1 = c + math.cos(ang) * r_in, c + math.sin(ang) * r_in
        x2, y2 = c + math.cos(ang) * r_out * 0.98, c + math.sin(ang) * r_out * 0.98
        ip.line([x1, y1, x2, y2], fill=(120, 170, 255, 70), width=max(1, s // 300))
    img.alpha_composite(iris)
    d.ellipse([c - r_in, c - r_in, c + r_in, c + r_in], fill=(8, 10, 18, 255))   # pupille
    hl = s * 0.075
    d.ellipse([c - r_in * 0.55 - hl, c - r_in * 0.95 - hl, c - r_in * 0.55 + hl, c - r_in * 0.95 + hl], fill=(255, 255, 255, 240))
    hl2 = s * 0.03
    d.ellipse([c + r_in * 0.35 - hl2, c + r_in * 0.55 - hl2, c + r_in * 0.35 + hl2, c + r_in * 0.55 + hl2], fill=(255, 255, 255, 150))
    return img.resize((size, size), Image.LANCZOS)

def render():
    canvas = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
    text = 'BOOZZ'
    size = int(H * SS * 0.78)
    while True:  # ajuste la taille pour tenir dans 88 % de la largeur
        font = ImageFont.truetype(FONT, size)
        bbox = font.getbbox(text)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        eye_size = int(th * 1.12)
        gap = int(th * 0.08)
        total = tw + gap + eye_size
        if total <= W * SS * 0.88 or size < 40: break
        size -= 8
    x0 = (W * SS - total) // 2
    y0 = (H * SS - th) // 2 - bbox[1]
    # masque des lettres
    mask = Image.new('L', canvas.size, 0)
    ImageDraw.Draw(mask).text((x0, y0), text, font=font, fill=255)
    # ombre portée
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 110), (0, 0), mask)
    shadow = shadow.filter(ImageFilter.GaussianBlur(14 * SS)).transform(canvas.size, Image.AFFINE, (1, 0, -6 * SS, 0, 1, -10 * SS))
    canvas.alpha_composite(shadow)
    # métal brossé
    metal = metal_gradient(canvas.size).convert('RGBA')
    # bord sombre (contour) sous le métal
    edge = mask.filter(ImageFilter.MaxFilter(9))
    edge_layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    edge_layer.paste((60, 62, 68, 255), (0, 0), edge)
    canvas.alpha_composite(edge_layer)
    letters = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    letters.paste(metal, (0, 0), mask)
    canvas.alpha_composite(letters)
    # reflet haut
    gloss_mask = ImageChops.multiply(mask, Image.linear_gradient('L').resize(canvas.size).transpose(Image.FLIP_TOP_BOTTOM))
    gloss = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    gloss.paste((255, 255, 255, 70), (0, 0), gloss_mask)
    canvas.alpha_composite(gloss)
    # œil
    e = eye(eye_size)
    ey = (H * SS - eye_size) // 2 + int(th * 0.0)
    canvas.alpha_composite(e, (x0 + tw + gap, (y0 + bbox[1]) + (th - eye_size) // 2))
    final = canvas.resize((W, H), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    (ROOT / 'public/assets/universe/brand-boozzo-transparent.png').parent.mkdir(exist_ok=True)
    final.save(OUT / 'brand-boozzo-transparent.png')
    white = Image.new('RGB', (W, H), (255, 255, 255))
    white.paste(final, (0, 0), final)
    white.save(OUT / 'brand-boozzo.webp', quality=88, method=6)
    white.resize((640, int(640 * H / W)), Image.LANCZOS).save(OUT / 'brand-boozzo-640.webp', quality=85, method=6)
    print('logo écrit :', OUT / 'brand-boozzo.webp')

if __name__ == '__main__':
    render()
