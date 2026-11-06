import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seatChips } from './lib/seat';

const pub = (f: string) => join(__dirname, '..', 'public', f);
const root = join(__dirname, '..');

describe('PWA ligera', () => {
  const manifest = JSON.parse(readFileSync(pub('manifest.webmanifest'), 'utf8'));
  it('se instala como app independiente, en vertical y con los colores de la mesa', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait-primary');
    expect(manifest.theme_color).toBe('#2b0e1b');
    expect(manifest.background_color).toBe('#2b0e1b');
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
  });
  it('sus íconos existen (192, 512 y maskable)', () => {
    const sizes = manifest.icons.map(
      (i: { sizes: string; purpose: string }) => `${i.sizes}/${i.purpose}`,
    );
    expect(sizes).toEqual(
      expect.arrayContaining(['192x192/any', '512x512/any', '512x512/maskable']),
    );
    for (const icon of manifest.icons) expect(existsSync(pub(icon.src.slice(1)))).toBe(true);
  });
  it('no hay service worker: la app es en línea y no debe servir versiones viejas', () => {
    expect(existsSync(pub('sw.js'))).toBe(false);
    expect(readFileSync(join(root, 'index.html'), 'utf8')).not.toMatch(/serviceWorker/);
  });
});

describe('index.html para móvil y para compartir', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  it('cubre la pantalla completa y enlaza el manifiesto', () => {
    expect(html).toMatch(/viewport-fit=cover/);
    expect(html).toMatch(/rel="manifest" href="\/manifest.webmanifest"/);
    expect(html).toMatch(/name="theme-color" content="#2b0e1b"/);
    expect(html).not.toMatch(/maximum-scale|user-scalable=no/);
  });
  it('trae Open Graph y Twitter con el banner absoluto', () => {
    const banner = 'https://loveletter.jcoaks.workers.dev/assets/hero-banner.webp';
    expect(html).toContain(`property="og:image" content="${banner}"`);
    expect(html).toContain(`name="twitter:image" content="${banner}"`);
    expect(html).toMatch(/name="twitter:card" content="summary_large_image"/);
    expect(html).toMatch(/property="og:title"/);
    expect(html).toMatch(/name="description"/);
  });
});

describe('Estados de asiento para el móvil', () => {
  it('cada estado trae su tipo, para mostrar solo los que importan en la banda compacta', () => {
    const chips = seatChips({
      id: 'a',
      name: 'Ana',
      handCount: 1,
      discards: [],
      tokens: 0,
      eliminated: true,
      protected: true,
      spyPlayed: true,
      connected: false,
      bot: true,
      isTurn: true,
    });
    expect(chips.map((c) => c.kind)).toEqual(['out', 'prot', 'spy', 'off', 'bot', 'on']);
  });
});
