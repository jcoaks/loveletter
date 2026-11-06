"""Genera los WebP livianos de apps/web/public/assets a partir de assets-src/ (originales, fuera de git).

Uso: python3 -I scripts/optimize-assets.py
Cada carta sale en dos tamaños: card-N.webp (grande, mano y detalles) y card-N-sm.webp (pequeño,
descartes, mazo y apartada). Requiere Pillow.
"""
from pathlib import Path
from PIL import Image

SRC = Path(__file__).resolve().parent.parent / 'assets-src'
OUT = Path(__file__).resolve().parent.parent / 'apps/web/public/assets'
OUT.mkdir(parents=True, exist_ok=True)


def save(im, name, size, q=80):
    im = im.copy()
    im.thumbnail(size, Image.LANCZOS)
    im.save(OUT / name, 'WEBP', quality=q, method=6)
    print(f'{name}: {im.size} {(OUT / name).stat().st_size // 1024} KB')


for f in sorted(SRC.glob('card-[0-9].jpg')) + [SRC / 'card-back.jpg']:
    im = Image.open(f).convert('RGB')
    save(im, f.stem + '.webp', (378, 529), 80)
    save(im, f.stem + '-sm.webp', (114, 160), 78)
save(Image.open(SRC / 'token.png').convert('RGBA'), 'token.webp', (72, 72), 85)
save(Image.open(SRC / 'logo.png').convert('RGBA'), 'logo.webp', (547, 190), 85)
save(Image.open(SRC / 'bag.png').convert('RGBA'), 'bag.webp', (280, 280), 85)

# Ilustraciones de portada y fondos (no se usan en la partida; Home, sala y fin de partida).
extras = [
    ('hero-cover.jpg', 'hero-cover.webp', (378, 529), 80, 'RGB'),
    ('hero-banner.webp', 'hero-banner.webp', (800, 400), 78, 'RGB'),
    ('princess.webp', 'princess.webp', (336, 460), 85, 'RGBA'),
    ('hero-group.webp', 'hero-group.webp', (1200, 700), 74, 'RGB'),
]
for src, name, size, q, mode in extras:
    save(Image.open(SRC / src).convert(mode), name, size, q)
# Versión estrecha del grupo para móviles (recorte a la zona de personajes).
g = Image.open(SRC / 'hero-group.webp').convert('RGB')
w, h = g.size
save(g.crop((int(w * 0.27), 0, w, h)), 'hero-group-m.webp', (640, 700), 74)
