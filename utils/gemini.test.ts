import { describe, it, expect } from 'vitest';
import { toModelArgs } from './gemini';

describe('toModelArgs', () => {
  it('passes a text prompt through', () => {
    expect(toModelArgs({ model: 'm', contents: 'hi' })).toEqual({ params: { model: 'm' }, input: 'hi' });
  });

  it('maps parts, JSON output and tools', () => {
    const parts = [{ inlineData: { mimeType: 'image/jpeg', data: 'abc' } }, { text: 'read it' }];
    expect(toModelArgs({
      model: 'm',
      contents: { parts },
      config: { responseMimeType: 'application/json', tools: [{ googleSearch: {} }] },
    })).toEqual({
      params: { model: 'm', generationConfig: { responseMimeType: 'application/json' }, tools: [{ googleSearch: {} }] },
      input: parts,
    });
  });
});
