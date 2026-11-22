// Guard: Material Symbols icons are ligature text ("more_vert", "close"), which
// screen readers read out loud. Every icon span must be aria-hidden; buttons
// that only contain an icon need an aria-label instead.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const files = (dir: string): string[] => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') && !p.endsWith('.test.tsx') ? [p] : [];
});

describe('icons are hidden from screen readers', () => {
  it('every material-symbols <span> has aria-hidden', () => {
    const offenders: string[] = [];
    for (const file of files(join(__dirname))) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.includes('<span') && line.includes('material-symbols-outlined') && !line.includes('aria-hidden')) {
          offenders.push(`${file.split('components/')[1]}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
