import { describe, expect, it } from 'vitest';
import { passwordStrength } from './password';

describe('passwordStrength', () => {
  it('rejects anything under Firebase\'s 6-character minimum', () => {
    expect(passwordStrength('abc12')).toMatchObject({ score: 0, label: 'Too short' });
  });
  it('rates simple passwords weak and suggests what to add', () => {
    expect(passwordStrength('abcdef')).toMatchObject({ score: 1, label: 'Weak' });
    expect(passwordStrength('abcdef').hint).toMatch(/Longer/);
  });
  it('rewards length, mixed case, digits and symbols', () => {
    expect(passwordStrength('Abcdefgh12').score).toBe(3);
    expect(passwordStrength('Abcdefgh12!x').score).toBe(4);
    expect(passwordStrength('Abcdefgh12!x').hint).toBe('');
  });
});
